import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject } from "@/lib/api";
import { nowIso } from "@/lib/util";

/** Adopt one of the brainstormed titles as the project title. */
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
  if (!title) return NextResponse.json({ error: "Judul wajib diisi" }, { status: 400 });
  db.prepare("UPDATE projects SET title = ?, updated_at = ? WHERE id = ?").run(title.slice(0, 300), nowIso(), id);
  return NextResponse.json({ title });
}
