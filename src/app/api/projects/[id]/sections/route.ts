import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject } from "@/lib/api";
import { genId, nowIso } from "@/lib/util";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;
  const rows = db.prepare('SELECT * FROM sections WHERE project_id = ? ORDER BY "order" ASC, id ASC').all(id) as any[];
  return NextResponse.json(rows.map((s) => shape(s)));
}

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
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Judul section wajib diisi" }, { status: 400 });

  const level = Math.min(4, Math.max(1, Number(body.level) || 2));
  const parentId = body.parentId ? String(body.parentId) : null;

  // Position: after a given section, or append at the end
  let order: number;
  if (body.afterSectionId) {
    const after = db.prepare('SELECT "order" o FROM sections WHERE id = ? AND project_id = ?').get(body.afterSectionId, id) as any;
    order = after ? after.o + 1 : maxOrder(id) + 1;
  } else {
    order = maxOrder(id) + 1;
  }
  renumber(id);

  const sid = genId("s");
  const content = String(body.content || "");
  const status = content.trim() ? "USER_EDITED" : "EMPTY";
  db.prepare(
    `INSERT INTO sections (id, project_id, parent_id, title, "order", level, content, status, prompt, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(sid, id, parentId, title, order, level, content, status, String(body.prompt || ""), nowIso());

  const row = db.prepare("SELECT * FROM sections WHERE id = ?").get(sid) as any;
  return NextResponse.json(shape(row), { status: 201 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Bulk reorder: body { orders: [{id, order, parentId}] }
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const orders: { id: string; order: number; parentId: string | null }[] = body.orders || [];
  const stmt = db.prepare('UPDATE sections SET "order" = ?, parent_id = ?, updated_at = ? WHERE id = ? AND project_id = ?');
  const tx = db.transaction(() => {
    for (const o of orders) {
      if (!o.id) continue;
      stmt.run(Number(o.order), o.parentId || null, nowIso(), o.id, id);
    }
  });
  tx();
  const rows = db.prepare('SELECT * FROM sections WHERE project_id = ? ORDER BY "order" ASC, id ASC').all(id) as any[];
  return NextResponse.json(rows.map(shape));
}

function maxOrder(pid: string): number {
  const row = db.prepare('SELECT MAX("order") m FROM sections WHERE project_id = ?').get(pid) as any;
  return row?.m ?? -1;
}

function renumber(pid: string) {
  const rows = db.prepare('SELECT id FROM sections WHERE project_id = ? ORDER BY "order" ASC, id ASC').all(pid) as any[];
  const stmt = db.prepare('UPDATE sections SET "order" = ? WHERE id = ?');
  const tx = db.transaction(() => rows.forEach((r, i) => stmt.run(i, r.id)));
  tx();
}

function shape(s: any) {
  return {
    id: s.id,
    projectId: s.project_id,
    parentId: s.parent_id,
    title: s.title,
    order: s.order,
    level: s.level,
    content: s.content,
    status: s.status,
    prompt: s.prompt,
    updatedAt: s.updated_at,
  };
}
