import { NextResponse } from "next/server";
import { chat, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject } from "@/lib/api";
import { defenseQaMessages } from "@/lib/prompts";
import { safeError, stripHtml } from "@/lib/util";

/**
 * Simulasi sidang: the model plays a tough-but-constructive thesis examiner.
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

  const question = String(body.question || "Tanyakan soal latar belakang dan kebaruan penelitian ini.").trim();
  const secs = (db.prepare("SELECT title, content FROM sections WHERE project_id = ? AND content != '' ORDER BY \"order\"").all(id) as any[]);
  const context = secs.map((s) => `${s.title}\n${stripHtml(s.content).slice(0, 500)}`).join("\n\n").slice(0, 12000);

  try {
    const out = await chat(settings, defenseQaMessages(rowToProject(proj), question, context), { maxTokens: 1500, temperature: 0.7 });
    return NextResponse.json({ answer: out });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Simulasi sidang gagal.") }, { status: 502 });
  }
}
