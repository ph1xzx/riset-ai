import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mergeStyle } from "@/lib/template-parser";
import { normalizeHeadingTitle, reformatContent } from "@/lib/reformat";
import { parseJsonObject } from "@/lib/json";
import { DEFAULT_CAMPUS_STYLE } from "@/lib/research";

export const runtime = "nodejs";

/**
 * Terapkan template pedoman ke proyek APA PUN — baru maupun hasil impor DOCX/MD.
 * body: { templateId, reformat? }
 * - default: hanya format export yang diganti (campusStyle), isi tak disentuh.
 * - reformat=true: judul & konten section yang sudah ada SEKALIGUS dinormalkan
 *   mengikuti template (BAB Romawi+kapital, nomor tanpa titik, baris kosong
 *   manual dihapus, dst).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json();
  const tpl = await prisma.writingTemplate.findUnique({ where: { id: b.templateId } });
  if (!tpl) return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });

  const current = parseJsonObject(project.campusStyle, {});
  if (Boolean((current as any).formatLocked)) {
    return NextResponse.json({ error: "Profil format terkunci. Buka kunci dulu sebelum menerapkan template." }, { status: 409 });
  }
  const campusStyle = mergeStyle(mergeStyle(DEFAULT_CAMPUS_STYLE as any, current), JSON.parse(tpl.config || "{}"));
  const citationStyle = (campusStyle as any).citationStyle || project.citationStyle;

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: { campusStyle: JSON.stringify(campusStyle), citationStyle },
  });

  let reformatted = 0;
  if (b.reformat) {
    const secs = await prisma.section.findMany({
      where: { projectId: params.id },
      orderBy: { order: "asc" },
    });
    for (const s of secs) {
      const nt = normalizeHeadingTitle(s.title, s.level);
      const c = reformatContent(s.content || "");
      if (nt !== s.title || c.changed) {
        await prisma.section.update({ where: { id: s.id }, data: { title: nt, content: c.html } });
        reformatted++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    templateName: tpl.name,
    reformatted,
    campusStyle: JSON.parse(updated.campusStyle),
  });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
