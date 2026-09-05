import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { deleteStoredFile } from "@/lib/storage";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const source = await prisma.source.findUnique({ where: { id: params.id } });
  if (!source) return NextResponse.json({ error: "Sumber tidak ditemukan" }, { status: 404 });
  await prisma.$transaction([
    prisma.citationUsage.deleteMany({ where: { sourceId: params.id } }),
    prisma.citation.updateMany({ where: { sourceId: params.id }, data: { sourceId: null } }),
    prisma.source.delete({ where: { id: params.id } }),
  ]);
  if (source.provider === "pdf" && source.pdfUrl) {
    await deleteStoredFile(source.pdfUrl).catch(() => {});
  }
  return NextResponse.json({ ok: true });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
