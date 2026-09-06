import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject, rowToSource } from "@/lib/api";
import { chat, getAiSettings } from "@/lib/ai";
import { safeError } from "@/lib/util";

/**
 * Build a short contextual sentence (with the citation token) for inserting a
 * source into a section. AI-powered when a key is configured; otherwise a
 * deterministic fallback from the section's own text.
 * Body: { sourceId, sectionId } → { sentence, display }
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const sourceId = String(body.sourceId || "");
  const sectionId = String(body.sectionId || "");
  const source = db.prepare("SELECT * FROM sources WHERE id = ? AND project_id = ?").get(sourceId, id) as any;
  if (!source) return NextResponse.json({ error: "Sumber tidak ditemukan" }, { status: 404 });
  const section = db.prepare("SELECT * FROM sections WHERE id = ? AND project_id = ?").get(sectionId, id) as any;
  if (!section) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });

  const src = rowToSource(source);
  const display = formatAuthorYear(src);
  const token = `<sup class="citation" data-source-id="${source.id}">${display}</sup>`;

  // Deterministic fallback: last real sentence of the section + token
  const text: string = (section.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 25);
  const base = sentences.length ? sentences[sentences.length - 1].replace(/[.!?]$/, "") : "Penelitian terkait ini telah dibahas pada studi terdahulu";
  const fallbackSentence = `${base}${display ? ` ${display}` : ""} ${token}.`;

  const settings = getAiSettings(r.project.userId);
  if (!settings) return NextResponse.json({ sentence: fallbackSentence, display, usedAi: false });

  try {
    const reply = await chat(
      settings,
      [
        {
          role: "system",
          content:
            "Kamu membantu peneliti menulis satu kalimat kontekstual dalam Bahasa Indonesia yang merujuk sumber yang diberikan. Balas HANYA satu kalimat (maks. 30 kata), tanpa tanda kutip, tanpa penjelasan. Kalimat itu akan diberi token sitasi [CIT] di posisi yang tepat.",
        },
        {
          role: "user",
          content: `Sumber: ${src.title} (${src.authors?.join(", ") || "penulis tidak diketahui"}, ${src.year || "t.t."})\nKonteks sub-bab "${section.title}": ${text.slice(0, 900)}\n\nTulis satu kalimat rujukan dengan token [CIT] di posisi sitasi.`,
        },
      ],
      { maxTokens: 200, temperature: 0.3 }
    );
    let sentence = reply.trim().replace(/^["']|["']$/g, "");
    if (!sentence) throw new Error("empty");
    sentence = sentence.includes("[CIT]")
      ? sentence.replace("[CIT]", token)
      : `${sentence}${/[.!?]$/.test(sentence) ? "" : "."} ${token}`;
    return NextResponse.json({ sentence, display, usedAi: true });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Gagal membuat kalimat sitasi"), sentence: fallbackSentence, display, usedAi: false });
  }
}

function formatAuthorYear(s: any): string {
  const last = (a: string) => a.trim().split(/\s+/).pop() || a;
  const y = s.year ?? "t.t.";
  if (!s.authors?.length) return `(Anonim, ${y})`;
  if (s.authors.length === 1) return `(${last(s.authors[0])}, ${y})`;
  if (s.authors.length === 2) return `(${last(s.authors[0])} & ${last(s.authors[1])}, ${y})`;
  return `(${last(s.authors[0])} et al., ${y})`;
}
