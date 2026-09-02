import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parsePedoman, mergeStyle, baseConfig } from "@/lib/template-parser";
import { DEFAULT_CAMPUS_STYLE } from "@/lib/research";

export const runtime = "nodejs";

/** Daftar template pedoman tersimpan. */
export async function GET() {
  const rows = await prisma.writingTemplate.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({
    templates: rows.map((r) => ({
      id: r.id,
      name: r.name,
      prodi: r.prodi,
      university: r.university,
      config: JSON.parse(r.config || "{}"),
      hasSource: !!r.sourceText,
      updatedAt: r.updatedAt,
    })),
  });
}

/**
 * Buat template.
 * body: { name, prodi?, university?, sourceText?, config? }
 * - sourceText: teks pedoman mentah → diparse otomatis (aturan ketemu = dipakai).
 * - config: object config langsung (menimpa hasil parse per-field).
 */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const name = (b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Nama template wajib diisi" }, { status: 400 });

  let config = baseConfig();
  let detected: string[] = [];
  let warnings: string[] = [];
  if (b.sourceText && String(b.sourceText).trim().length > 20) {
    const p = parsePedoman(String(b.sourceText));
    config = mergeStyle(config, p.config) as typeof config;
    detected = p.detected;
    warnings = p.warnings;
  }
  if (b.config && typeof b.config === "object") config = mergeStyle(config, b.config) as typeof config;
  // jaminan field inti selalu ada walau config parsial
  config = mergeStyle(mergeStyle(DEFAULT_CAMPUS_STYLE as any, config), {}) as typeof config;

  const row = await prisma.writingTemplate.create({
    data: {
      name,
      prodi: b.prodi || "",
      university: b.university || "",
      sourceText: b.sourceText || "",
      config: JSON.stringify(config),
    },
  });
  return NextResponse.json({ id: row.id, config, detected, warnings }, { status: 201 });
}
