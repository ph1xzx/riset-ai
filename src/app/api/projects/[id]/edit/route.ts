import { NextResponse } from "next/server";
import { chat, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject, rowToSource } from "@/lib/api";
import { enforceCitations } from "@/lib/ai-routes";
import { editMessages } from "@/lib/prompts";
import { safeError, stripHtml } from "@/lib/util";

/**
 * AI Edit: apply a command to a text selection and return replacement HTML.
 * The client shows a before/after diff and applies it on accept.
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
  const settings = getAiSettings(u.user.id);
  if (!settings) return NextResponse.json({ error: "API key belum diset — buka Settings." }, { status: 400 });
  const sources = (db.prepare("SELECT * FROM sources WHERE project_id = ?").all(id) as any[]).map((r) => rowToSource(r));

  const selection = String(body.selection || "");
  const command = String(body.command || "").slice(0, 300);
  if (!selection.trim()) return NextResponse.json({ error: "Tidak ada teks terpilih" }, { status: 400 });
  if (!command.trim()) return NextResponse.json({ error: "Perintah kosong" }, { status: 400 });

  try {
    const out = await chat(settings, editMessages(rowToProject(proj), { title: section?.title || id }, selection, command), {
      maxTokens: 2500,
      retries: 1,
    });
    const allowed = new Set(sources.map((s) => s.id));
    const { html } = enforceCitations(out, allowed);
    return NextResponse.json({ result: stripHtml(html).trim() || html, raw: html });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "AI edit gagal. Coba lagi.") }, { status: 502 });
  }
}
