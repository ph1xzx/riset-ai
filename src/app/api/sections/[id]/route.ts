import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body tidak valid" }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (typeof b.title === "string") data.title = b.title;
  if (typeof b.content === "string") data.content = b.content;
  if (typeof b.status === "string") data.status = b.status;
  if (typeof b.prompt === "string") data.prompt = b.prompt;
  if (typeof b.order === "number") data.order = b.order;
  const section = await prisma.section.update({ where: { id: params.id }, data });
  return NextResponse.json(section);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await prisma.section.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

// POST /move — reorder: { sectionId, targetIndex }
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const sections = await prisma.section.findMany({ where: { projectId: b.projectId }, orderBy: { order: "asc" } });
  const ids = sections.map((s) => s.id);
  const from = ids.indexOf(b.sectionId);
  if (from < 0) return NextResponse.json({ error: "section tidak ditemukan" }, { status: 404 });
  ids.splice(from, 1);
  const to = Math.max(0, Math.min(ids.length, b.targetIndex ?? 0));
  ids.splice(to, 0, b.sectionId);
  await prisma.$transaction(
    ids.map((id, i) => prisma.section.update({ where: { id }, data: { order: i } }))
  );
  return NextResponse.json({ ok: true });
}
