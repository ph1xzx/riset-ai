import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  csv: "text/csv",
  txt: "text/plain",
  json: "application/json",
};

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  // prevent path traversal
  const safe = path.basename(name);
  if (safe !== name) return NextResponse.json({ error: "Nama file tidak valid" }, { status: 400 });
  const full = path.join(STORAGE_DIR, safe);
  if (!fs.existsSync(full)) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 404 });
  const ext = safe.split(".").pop()?.toLowerCase() || "";
  const buf = fs.readFileSync(full);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Content-Length": String(buf.length),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
