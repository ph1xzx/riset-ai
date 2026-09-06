import { NextResponse } from "next/server";
import { chatJson, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject } from "@/lib/api";
import { reviewMessages } from "@/lib/prompts";
import { safeError, stripHtml } from "@/lib/util";

/**
 * Writing check (cek penulisan): grammar, tone, data consistency, structure.
 * Returns findings the client renders as an actionable list.
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
  const settings = getAiSettings(u.user.id);
  if (!settings) return NextResponse.json({ error: "API key belum diset — buka Settings." }, { status: 400 });

  const sectionId = String(body.sectionId || "");
  let content: string;
  let sectionTitle: string;
  if (sectionId) {
    const sec = db.prepare("SELECT * FROM sections WHERE id = ? AND project_id = ?").get(sectionId, id) as any;
    if (!sec) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });
    content = sec.content;
    sectionTitle = sec.title;
  } else {
    const secs = (db.prepare("SELECT title, content FROM sections WHERE project_id = ? AND content != '' ORDER BY \"order\"").all(id) as any[]);
    content = secs.map((s) => s.content).join("\n").slice(0, 30000);
    sectionTitle = "Seluruh dokumen";
  }
  if (stripHtml(content).length < 40) {
    return NextResponse.json({ error: "Tidak ada konten yang cukup untuk diperiksa" }, { status: 400 });
  }

  try {
    const res = await chatJson<any>(settings, reviewMessages(rowToProject(proj), content, sectionTitle), {
      temperature: 0.2,
      maxTokens: 3000,
    });
    return NextResponse.json({ findings: res.findings || [], summary: res.summary || "" });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Review gagal. Coba lagi.") }, { status: 502 });
  }
}
