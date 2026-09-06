import { NextResponse } from "next/server";
import { chat, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject, rowToSource } from "@/lib/api";
import { enforceCitations } from "@/lib/ai-routes";
import { chatMessages } from "@/lib/prompts";
import { safeError, stripHtml } from "@/lib/util";

/**
 * Project chat: the assistant answers questions about the document with the
 * full project context attached. History is kept client-side (last 10 turns).
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
  const sources = (db.prepare("SELECT * FROM sources WHERE project_id = ?").all(id) as any[]).map((r) => rowToSource(r));

  const question = String(body.question || "").trim();
  if (!question) return NextResponse.json({ error: "Pertanyaan kosong" }, { status: 400 });
  const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

  // Compact document context: titles + first 400 chars of each filled section
  const secs = db.prepare("SELECT title, content FROM sections WHERE project_id = ? AND content != '' ORDER BY \"order\"").all(id) as any[];
  const context = secs.map((s) => `${s.title}\n${stripHtml(s.content).slice(0, 400)}`).join("\n\n").slice(0, 12000);

  try {
    const out = await chat(settings, chatMessages(rowToProject(proj), history as any, question, sources), { maxTokens: 2000 });
    const allowed = new Set(sources.map((s) => s.id));
    const { html } = enforceCitations(out, allowed);
    return NextResponse.json({ answer: html });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Chat gagal. Coba lagi.") }, { status: 502 });
  }
}
