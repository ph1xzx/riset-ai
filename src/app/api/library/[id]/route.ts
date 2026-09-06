import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const row = db.prepare("SELECT * FROM library WHERE id = ?").get(id) as any;
  if (!row || row.user_id !== u.user.id) return NextResponse.json({ error: "Item tidak ditemukan" }, { status: 404 });
  db.prepare("DELETE FROM library WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
