import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolvePaperById } from "@/lib/academic";
import { toJsonArray } from "@/lib/json";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const sources = await prisma.source.findMany({
    where: { projectId: params.id },
    orderBy: { addedAt: "desc" },
  });
  return NextResponse.json(sources);
}

// body: { academicId?, provider?, ...metadata }  → simpan ke library proyek
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  let data: any;
  if (b.academicId) {
    const paper = await resolvePaperById(b.academicId, params.id);
    if (!paper) return NextResponse.json({ error: "Paper tidak ditemukan" }, { status: 404 });
    data = paper;
  } else if (b.title) {
    data = {
      id: b.doi ? `doi:${b.doi}` : `manual:${Date.now()}`,
      title: b.title,
      authors: b.authors ?? [],
      year: b.year ?? null,
      journal: b.journal ?? "",
      doi: b.doi ?? null,
      abstract: b.abstract ?? "",
      url: b.url ?? "",
      pdfUrl: b.pdfUrl ?? "",
      citationCount: b.citationCount ?? 0,
      openAccess: b.openAccess ?? false,
      provider: b.provider ?? "manual",
      type: "article",
      keywords: b.keywords ?? [],
      impactFactor: b.impactFactor ?? null,
    };
  } else {
    return NextResponse.json({ error: "academicId atau metadata wajib" }, { status: 400 });
  }

  // dedup: DOI atau judul+tahun
  const existing = await prisma.source.findFirst({
    where: {
      projectId: params.id,
      OR: [
        ...(data.doi ? [{ doi: data.doi.toLowerCase() }] : []),
        { title: data.title, year: data.year ?? 0 },
      ],
    },
  });
  if (existing) return NextResponse.json({ ...existing, duplicate: true });

  const source = await prisma.source.create({
    data: {
      projectId: params.id,
      title: data.title,
      authors: toJsonArray(data.authors ?? []),
      year: data.year ?? null,
      journal: data.journal ?? "",
      doi: data.doi ?? null,
      abstract: data.abstract ?? "",
      url: data.url ?? "",
      pdfUrl: data.pdfUrl ?? "",
      citationCount: data.citationCount ?? 0,
      openAccess: data.openAccess ?? false,
      provider: data.provider ?? "openalex",
      type: data.type ?? "article",
      keywords: toJsonArray(data.keywords ?? []),
      impactFactor: data.impactFactor ?? null,
      verified: data.abstract ? "METADATA_ONLY" : "METADATA_ONLY",
    },
  });
  return NextResponse.json(source, { status: 201 });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
