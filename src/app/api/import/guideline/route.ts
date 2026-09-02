import { NextRequest, NextResponse } from "next/server";
import { extractStructureDocx } from "@/lib/docx-import";
import { extractCampusStyle } from "@/lib/docx-style";
import { fetchFileBytes } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * body: { fileUrl }
 * Ekstrak dari skripsi lama / pedoman:
 * - headings (→ custom structure)
 * - format (margin, font, size, spasi, halaman)
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const fileUrl: string = b.fileUrl;
  if (!fileUrl) return NextResponse.json({ error: "fileUrl wajib" }, { status: 400 });

  let buffer: Buffer;
  try {
    buffer = await fetchFileBytes(fileUrl);
  } catch (e: any) {
    return NextResponse.json({ error: `Gagal membaca file: ${e.message}` }, { status: 400 });
  }

  try {
    const structure = await extractStructureDocx(buffer);
    const campusStyle = await extractCampusStyle(buffer);
    return NextResponse.json({ structure, campusStyle });
  } catch (e: any) {
    return NextResponse.json({ error: `Parse DOCX gagal: ${e.message}` }, { status: 400 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
