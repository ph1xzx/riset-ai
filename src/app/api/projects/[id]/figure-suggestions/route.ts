import { NextResponse } from "next/server";
import { chatJson, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject } from "@/lib/api";
import { figureSuggestionsMessages } from "@/lib/prompts";
import { safeError } from "@/lib/util";

/** Suggest figures (diagrams/illustrations/logos) that fit a section. */
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
  const sec = db.prepare("SELECT * FROM sections WHERE id = ? AND project_id = ?").get(sectionId, id) as any;
  if (!sec) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });

  try {
    const res = await chatJson<any>(settings, figureSuggestionsMessages(rowToProject(proj), { title: sec.title, content: sec.content }), {
      temperature: 0.5,
      maxTokens: 1500,
    });
    return NextResponse.json({ suggestions: res.suggestions || [] });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Gagal membuat saran gambar.") }, { status: 502 });
  }
}
