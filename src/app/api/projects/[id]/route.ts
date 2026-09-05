import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseJsonObject } from "@/lib/json";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

function stableValue(value: any): any {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((out, key) => {
        out[key] = stableValue(value[key]);
        return out;
      }, {} as Record<string, any>);
  }
  return value;
}

function sameFormat(a: any, b: any): boolean {
  const withoutLock = (value: any) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    const { formatLocked: _formatLocked, ...rest } = value;
    return rest;
  };
  return JSON.stringify(stableValue(withoutLock(a))) === JSON.stringify(stableValue(withoutLock(b)));
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: {
      memory: true,
      sections: { orderBy: { order: "asc" } },
      sources: { orderBy: { addedAt: "desc" } },
      collections: { include: { sources: { include: { source: true } } } },
      threads: { orderBy: { createdAt: "desc" }, take: 20, include: { messages: { orderBy: { createdAt: "asc" } } } },
      usages: true,
      runs: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const data: Record<string, unknown> = {};
  const strFields = ["title", "type", "topic", "field", "object", "caseStudy", "problem", "method", "language", "citationStyle", "documentPrompt"];
  for (const f of strFields) if (typeof b[f] === "string") data[f] = b[f];
  if (typeof b.yearFrom === "number" || b.yearFrom == null) data.yearFrom = b.yearFrom ?? null;
  if (typeof b.yearTo === "number" || b.yearTo == null) data.yearTo = b.yearTo ?? null;
  if (typeof b.minCitations === "number") data.minCitations = b.minCitations;
  if (typeof b.includePreprint === "boolean") data.includePreprint = b.includePreprint;
  if (b.campusStyle && typeof b.campusStyle === "object") {
    const currentProject = await prisma.project.findUnique({
      where: { id: params.id },
      select: { campusStyle: true },
    });
    if (!currentProject) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
    const currentStyle = parseJsonObject(currentProject.campusStyle, {});
    const currentLocked = Boolean((currentStyle as any).formatLocked);
    const nextLocked = Boolean((b.campusStyle as any).formatLocked);
    if (currentLocked && nextLocked && !sameFormat(currentStyle, b.campusStyle)) {
      return NextResponse.json({ error: "Profil format terkunci. Buka kunci dulu sebelum mengubahnya." }, { status: 409 });
    }
    data.campusStyle = JSON.stringify(b.campusStyle);
  }
  if (b.structure && Array.isArray(b.structure)) {
    // replace entire structure
    await prisma.section.deleteMany({ where: { projectId: params.id } });
    data.sections = {
      create: (b.structure as { title: string; level: number }[]).map((s, i) => ({
        title: s.title,
        level: Math.min(6, Math.max(1, Math.trunc(Number(s.level) || 1))),
        order: i,
      })),
    };
  }
  if (b.memory) {
    const m = b.memory;
    const memData: Record<string, unknown> = { title: m.title ?? "" };
    for (const f of ["problems", "questions", "objectives", "variables", "criteria", "alternatives"]) {
      if (Array.isArray(m[f])) memData[f === "questions" ? "questions" : f === "objectives" ? "objectives" : f] = JSON.stringify(m[f]);
    }
    for (const f of ["researchObject", "methodology", "population", "sample", "sampleSize", "analysisMethod"]) {
      if (typeof m[f] === "string") memData[f] = m[f];
    }
    await prisma.researchMemory.upsert({
      where: { projectId: params.id },
      create: { projectId: params.id, ...memData },
      update: memData,
    });
  }
  const project = await prisma.project.update({ where: { id: params.id }, data: data as any, include: { sections: { orderBy: { order: "asc" } }, memory: true } });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  await prisma.project.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
