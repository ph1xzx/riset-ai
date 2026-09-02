import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDocx, extractStructureDocx } from "@/lib/docx-import";
import { extractCampusStyle } from "@/lib/docx-style";
import { fetchFileBytes } from "@/lib/storage";
import { DEFAULT_CAMPUS_STYLE } from "@/lib/research";
import { stripHtml } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * IMPOR SKRIPSI (docx) → proyek baru dengan struktur CUSTOM dari heading dokumen.
 * body: { fileUrl, title?, type? }
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
    const doc = await parseDocx(buffer);
    if (!doc.sections.length) {
      return NextResponse.json({ error: "Tidak ada section terdeteksi di dokumen" }, { status: 400 });
    }
    // ambil juga struktur heading untuk sanity (custom structure)
    const style = await extractCampusStyle(buffer);

    const fileStem = decodeURIComponent(
      fileUrl
        .split("/")
        .pop()
        ?.replace(/\.[a-z0-9]+$/i, "")
        ?.replace(/^\d{10,}-?/, "") // buang prefix timestamp upload
        ?.replace(/[-_]+/g, " ") || ""
    );
    const title =
      b.title ||
      (/(^|\/)bab[\s\u00A0]*(1|I)\b/i.test(doc.sections[0]?.title || "")
        ? `Skripsi Impor${fileStem ? ` — ${fileStem.slice(0, 40)}` : ""}`
        : doc.title);

    const project = await prisma.project.create({
      data: {
        title,
        type: b.type || "Skripsi (Impor)",
        topic: doc.title,
        campusStyle: JSON.stringify(style),
        sections: {
          create: doc.sections.map((s, i) => ({
            title: s.title || `Bagian ${i + 1}`,
            level: s.level,
            order: i,
            content: s.html,
            status: "USER_EDITED",
          })),
        },
      },
      include: { sections: { orderBy: { order: "asc" } }, memory: true },
    });

    const words = project.sections.reduce((acc, s) => acc + stripHtml(s.content).split(/\s+/).length, 0);
    return NextResponse.json({ project, sections: project.sections.length, words }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: `Parse DOCX gagal: ${e.message}` }, { status: 400 });
  }
}


