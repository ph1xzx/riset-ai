import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";
import { genId, nowIso } from "@/lib/util";
import fs from "fs";
import path from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");
const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export async function GET() {
  const u = await apiUser();
  if ("res" in u) return u.res;
  const rows = db.prepare("SELECT * FROM uploads WHERE user_id = ? ORDER BY created_at DESC LIMIT 100").all(u.user.id) as any[];
  return NextResponse.json({
    files: rows.map((f) => ({
      id: f.id,
      name: f.name,
      url: `/files/${f.name}`,
      size: f.size,
      createdAt: f.created_at,
    })),
  });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Unggah gagal — bukan form data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File terlalu besar (maks 25 MB)" }, { status: 413 });
  }

  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6) || "bin";
  const stamp = Date.now();
  const base = `${stamp}-${sanitize(file.name)}`;
  const storedName = `${stamp}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dir = path.join(STORAGE_DIR);
  fs.mkdirSync(dir, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(dir, storedName), buf);

  const id = genId("up");
  db.prepare("INSERT INTO uploads (id, user_id, name, path, size, created_at) VALUES (?,?,?,?,?,?)")
    .run(id, u.user.id, storedName, storedName, buf.length, nowIso());

  return NextResponse.json({
    id,
    name: storedName,
    originalName: file.name,
    url: `/files/${storedName}`,
    size: buf.length,
    createdAt: nowIso(),
  }, { status: 201 });
}

export async function DELETE(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const id = String(body.id || "");
  const row = db.prepare("SELECT * FROM uploads WHERE id = ?").get(id) as any;
  if (!row || row.user_id !== u.user.id) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  try {
    fs.unlinkSync(path.join(STORAGE_DIR, row.name));
  } catch {
    /* ignore */
  }
  db.prepare("DELETE FROM uploads WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
}
