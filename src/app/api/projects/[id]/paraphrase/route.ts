import { NextResponse } from "next/server";
import { chat, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject, rowToSource } from "@/lib/api";
import { enforceCitations } from "@/lib/ai-routes";
import { paraphraseMessages } from "@/lib/prompts";
import { safeError, stripHtml, genId, nowIso } from "@/lib/util";

/**
 * Paraphrase a section (or selection) keeping meaning, data, and citation tags.
 * Returns replacement HTML and updates the section to AI_DRAFT.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const u = await apiUser();
  if ("res" in u) return u.res;
  const proj = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, u.user.id) as any;
  if (!proj) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  const sectionId = String(body.sectionId || "");
  const section = sectionId ? (db.prepare("SELECT * FROM sections WHERE id = ? AND project_id = ?").get(sectionId, id) as any) : null;
  if (!section) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });
  const settings = getAiSettings(u.user.id);
  if (!settings) return NextResponse.json({ error: "API key belum diset — buka Settings." }, { status: 400 });
  const sources = (db.prepare("SELECT * FROM sources WHERE project_id = ?").all(id) as any[]).map((r) => rowToSource(r));

  const content = String(body.content || section.content || "");
  if (stripHtml(content).length < 30) {
    return NextResponse.json({ error: "Konten terlalu pendek untuk diparafrase" }, { status: 400 });
  }

  try {
    const out = await chat(settings, paraphraseMessages(rowToProject(proj), { title: section.title }, content, sources), {
      maxTokens: 6000,
      retries: 1,
    });
    const before = (content.match(/data-source-id="([^"]+)"/g) || []).length;
    const after = (out.match(/data-source-id="([^"]+)"/g) || []).length;
    const allowed = new Set(sources.map((s) => s.id));
    const { html, rejectedTokens } = enforceCitations(out, allowed);
    db.prepare("UPDATE sections SET content = ?, status = 'AI_DRAFT', updated_at = ? WHERE id = ?").run(html, nowIso(), section.id);
    db.prepare("INSERT INTO activity (id, project_id, section_id, action, before_text, after_text) VALUES (?,?,?,?,?,?)")
      .run(genId("act"), id, section.id, "paraphrase", content.slice(0, 500), html.slice(0, 500));
    return NextResponse.json({ result: html, status: "AI_DRAFT", citationsKept: Math.min(before, after), rejectedTokens });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Parafrase gagal. Coba lagi.") }, { status: 502 });
  }
}
