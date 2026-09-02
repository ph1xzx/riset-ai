import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePdf, chunkText } from "@/lib/pdf";
import { fetchFileBytes } from "@/lib/storage";
import { toJsonArray } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: { id: string } };

/**
 * Lampirkan PDF ke library proyek (RAG source):
 * - parse teks → simpan sebagai Source (provider: pdf)
 * - chunk 1200 karakter → SourceChunk (dipakai AI Chat + retrieval)
 * body: { fileUrl, title?, author? }
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const fileUrl: string = b.fileUrl;
  if (!fileUrl) return NextResponse.json({ error: "fileUrl wajib" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  let buffer: Buffer;
  try {
    buffer = await fetchFileBytes(fileUrl);
  } catch (e: any) {
    return NextResponse.json({ error: `Gagal membaca file: ${e.message}` }, { status: 400 });
  }

  try {
    const pdfInfo = await parsePdf(buffer);
    if (!pdfInfo.text.trim()) {
      return NextResponse.json(
        { error: "PDF tidak memiliki teks yang bisa diekstrak (mungkin scan gambar — butuh OCR)." },
        { status: 422 }
      );
    }
    const title =
      b.title ||
      pdfInfo.info.Title ||
      fileUrl
        .split("/")
        .pop()
        ?.replace(/\.pdf$/i, "")
        .replace(/^[^a-zA-Z]*\d{10,}-?/, "") // buang prefix timestamp upload
        .replace(/[-_]+/g, " ") ||
      "Dokumen PDF";
    const chunks = chunkText(pdfInfo.text);

    const source = await prisma.source.create({
      data: {
        projectId: params.id,
        title: title.slice(0, 300),
        authors: toJsonArray(b.author ? [b.author] : []),
        year: new Date().getFullYear(),
        journal: `PDF — ${pdfInfo.numpages} halaman`,
        doi: null,
        abstract: pdfInfo.text.slice(0, 600),
        url: fileUrl,
        pdfUrl: fileUrl,
        citationCount: 0,
        openAccess: true,
        provider: "pdf",
        type: "pdf",
        keywords: toJsonArray([]),
        verified: "METADATA_ONLY",
      },
    });

    if (chunks.length) {
      await prisma.sourceChunk.createMany({
        data: chunks.map((text) => ({ sourceId: source.id, text })),
      });
    }

    return NextResponse.json(
      { source, chunks: chunks.length, pages: pdfInfo.numpages, chars: pdfInfo.text.length },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: `Parse PDF gagal: ${e.message}` }, { status: 400 });
  }
}
