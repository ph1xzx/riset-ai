import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";
import { nowIso } from "@/lib/util";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as any;
  if (!row || row.user_id !== u.user.id || id.startsWith("builtin-")) {
    return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  }
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const name = body.name !== undefined ? String(body.name) : row.name;
  const prodi = body.prodi !== undefined ? String(body.prodi) : row.prodi;
  const university = body.university !== undefined ? String(body.university) : row.university;
  const config = body.config !== undefined ? (typeof body.config === "string" ? body.config : JSON.stringify(body.config)) : row.config;
  const hasSource = body.hasSource !== undefined ? (body.hasSource ? 1 : 0) : row.has_source;
  db.prepare("UPDATE templates SET name=?, prodi=?, university=?, config=?, has_source=?, updated_at=? WHERE id=?")
    .run(name, prodi, university, config, hasSource, nowIso(), id);
  const upd = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as any;
  return NextResponse.json({
    id: upd.id, name: upd.name, prodi: upd.prodi, university: upd.university,
    config: safe(upd.config), hasSource: !!upd.has_source, updatedAt: upd.updated_at, builtin: false,
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id) as any;
  if (!row || row.user_id !== u.user.id || id.startsWith("builtin-")) {
    return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  }
  db.prepare("DELETE FROM templates WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

function safe(v: string): any {
  try {
    return JSON.parse(v);
  } catch {
    return {};
  }
}
