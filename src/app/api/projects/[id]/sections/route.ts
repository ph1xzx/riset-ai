import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const sections = await prisma.section.findMany({
    where: { projectId: params.id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(sections);
}

// tambah section baru
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const max = await prisma.section.aggregate({ where: { projectId: params.id }, _max: { order: true } });
  const section = await prisma.section.create({
    data: {
      projectId: params.id,
      parentId: b.parentId ?? null,
      title: b.title || "Section baru",
      level: b.level === 2 ? 2 : 1,
      order: (max._max.order ?? -1) + 1,
      prompt: b.prompt || "",
    },
  });
  return NextResponse.json(section, { status: 201 });
}
