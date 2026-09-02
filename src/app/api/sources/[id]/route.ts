import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await prisma.$transaction([
    prisma.citationUsage.deleteMany({ where: { sourceId: params.id } }),
    prisma.citation.updateMany({ where: { sourceId: params.id }, data: { sourceId: null } }),
    prisma.source.delete({ where: { id: params.id } }),
  ]);
  return NextResponse.json({ ok: true });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
