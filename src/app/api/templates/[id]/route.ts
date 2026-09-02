import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePedoman, mergeStyle } from "@/lib/template-parser";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const row = await prisma.writingTemplate.findUnique({ where: { id: params.id } });
  if (!row) return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });
  return NextResponse.json({ ...row, config: JSON.parse(row.config || "{}") });
}

/** Update nama/prodi/universitas, atau re-analisis sourceText baru. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json();
  const row = await prisma.writingTemplate.findUnique({ where: { id: params.id } });
  if (!row) return NextResponse.json({ error: "Template tidak ditemukan" }, { status: 404 });

  let config = JSON.parse(row.config || "{}");
  let detected: string[] = [];
  if (b.sourceText !== undefined && String(b.sourceText).trim().length > 20) {
    const p = parsePedoman(String(b.sourceText));
    config = mergeStyle(config, p.config);
    detected = p.detected;
  }
  if (b.config && typeof b.config === "object") config = mergeStyle(config, b.config);

  const updated = await prisma.writingTemplate.update({
    where: { id: params.id },
    data: {
      name: b.name ?? row.name,
      prodi: b.prodi ?? row.prodi,
      university: b.university ?? row.university,
      sourceText: b.sourceText ?? row.sourceText,
      config: JSON.stringify(config),
    },
  });
  return NextResponse.json({ id: updated.id, config, detected });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  await prisma.writingTemplate.deleteMany({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
