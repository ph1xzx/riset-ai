import { NextResponse } from "next/server";
import { apiUser } from "@/lib/api";
import { importDocx } from "@/lib/docx-import";
import fs from "fs";
import path from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");

/**
 * Parse an uploaded guideline/skripsi DOCX and return its detected structure
 * (headings) + campus style. The client then creates a project with these.
 * Body: { fileUrl: "/files/xxx.docx" } or { fileName: "xxx.docx" }
 */
export async function POST(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const fileUrl = String(body.fileUrl || body.fileName || "");
  const name = path.basename(fileUrl);
  if (!name || !name.toLowerCase().endsWith(".docx")) {
    return NextResponse.json({ error: "File harus berformat .docx" }, { status: 400 });
  }
  const full = path.join(STORAGE_DIR, name);
  if (!fs.existsSync(full)) return NextResponse.json({ error: "File tidak ditemukan — unggah ulang" }, { status: 404 });

  try {
    const buffer = fs.readFileSync(full);
    const result = await importDocx(buffer);
    return NextResponse.json({
      structure: result.sections,
      campusStyle: result.campusStyle,
      title: result.title,
      imageCount: result.imageCount,
      warning: result.sections.length < 3 ? "Struktur heading minim — dokumen mungkin memakai format manual" : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: `Gagal membaca DOCX: ${String(e.message).slice(0, 150)}` }, { status: 422 });
  }
}
