import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";
import { nowIso, safeError } from "@/lib/util";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const row = db
    .prepare("SELECT s.*, p.user_id FROM sections s JOIN projects p ON p.id = s.project_id WHERE s.id = ?")
    .get(id) as any;
  if (!row || row.user_id !== u.user.id) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });
  return NextResponse.json({
    id: row.id, projectId: row.project_id, parentId: row.parent_id, title: row.title,
    order: row.order, level: row.level, content: row.content, status: row.status,
    prompt: row.prompt, updatedAt: row.updated_at,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const owned = db
    .prepare("SELECT s.id, p.user_id FROM sections s JOIN projects p ON p.id = s.project_id WHERE s.id = ?")
    .get(id) as any;
  if (!owned || owned.user_id !== u.user.id) {
    return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const sets: string[] = [];
  const vals: any[] = [];
  if (body.title !== undefined) {
    sets.push("title = ?");
    vals.push(String(body.title).slice(0, 300));
  }
  if (body.content !== undefined) {
    sets.push("content = ?");
    vals.push(String(body.content));
  }
  if (body.status !== undefined) {
    const allowed = ["EMPTY", "DRAFTING", "AI_DRAFT", "USER_EDITED", "APPROVED"];
    if (allowed.includes(body.status)) {
      sets.push("status = ?");
      vals.push(body.status);
    }
  }
  if (body.prompt !== undefined) {
    sets.push("prompt = ?");
    vals.push(String(body.prompt).slice(0, 2000));
  }
  if (body.level !== undefined) {
    sets.push("level = ?");
    vals.push(Math.min(4, Math.max(1, Number(body.level) || 2)));
  }
  if (!sets.length) return NextResponse.json({ error: "Tidak ada field" }, { status: 400 });
  sets.push("updated_at = ?");
  vals.push(nowIso(), id);
  db.prepare(`UPDATE sections SET ${sets.join(", ")} WHERE id = ?`).run(...vals);
  const row = db.prepare("SELECT * FROM sections WHERE id = ?").get(id) as any;
  return NextResponse.json({
    id: row.id, projectId: row.project_id, parentId: row.parent_id, title: row.title,
    order: row.order, level: row.level, content: row.content, status: row.status,
    prompt: row.prompt, updatedAt: row.updated_at,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const owned = db
    .prepare("SELECT s.id, p.user_id FROM sections s JOIN projects p ON p.id = s.project_id WHERE s.id = ?")
    .get(id) as any;
  if (!owned || owned.user_id !== u.user.id) {
    return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });
  }
  db.prepare("DELETE FROM sections WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
