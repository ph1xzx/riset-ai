import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { searchPapers } from "@/lib/academic";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: { id: string } };

export async function POST(req: NextRequest, { params }: Ctx) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON body tidak valid" }, { status: 400 });
  }
  const candidate = body?.candidate || {};
  const authors = Array.isArray(candidate.authors) ? candidate.authors.filter((x: any) => typeof x === "string") : [];
  const year = typeof candidate.year === "number" ? candidate.year : null;
  const context = typeof candidate.context === "string" ? candidate.context.slice(0, 160) : "";
  const query = [authors.join(" "), year || "", context].filter(Boolean).join(" ").trim();
  if (!query) return NextResponse.json({ error: "Data sitasi tidak cukup untuk pencarian ulang" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  try {
    const result = await searchPapers({
      query,
      yearFrom: year ? year - 1 : null,
      yearTo: year ? year + 1 : null,
      limit: 4,
    });
    return NextResponse.json({ query, results: result.results, sources: result.sources });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Pencarian sumber pengganti gagal" }, { status: 502 });
  }
}

export const dynamic = "force-dynamic";
