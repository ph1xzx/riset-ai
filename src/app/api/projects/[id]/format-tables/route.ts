import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { countTables, normalizeTableHtml } from "@/lib/table-format";

export const runtime = "nodejs";

/** Menyamakan struktur tabel seluruh section sebelum ditinjau atau diekspor. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });

  let tables = 0;
  let sections = 0;
  await prisma.$transaction(async (tx) => {
    for (const section of project.sections) {
      const content = section.content || "";
      const tableCount = countTables(content);
      if (!tableCount) continue;
      tables += tableCount;
      const normalized = normalizeTableHtml(content);
      if (normalized !== content) {
        await tx.section.update({
          where: { id: section.id },
          data: { content: normalized, status: "USER_EDITED" },
        });
        sections++;
      }
    }
  });

  return NextResponse.json({ ok: true, tables, sections });
}

export const dynamic = "force-dynamic";
