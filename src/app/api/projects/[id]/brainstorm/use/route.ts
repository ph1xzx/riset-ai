import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { toJsonArray } from "@/lib/json";

export const runtime = "nodejs";

type Ctx = { params: { id: string } };

// Body: { title, rationale, recommendedMethod, memory: {...} }
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { sections: true },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  const update: Record<string, unknown> = { title: b.title || project.title };
  if (b.recommendedMethod && !project.method) update.method = b.recommendedMethod;

  // jika masih memakai struktur default kosong (belum pernah generate),
  // pastikan struktur tetap ada
  if (!project.sections.length) {
    update.sections = {
      create: [
        { title: "BAB I PENDAHULUAN", level: 1, order: 0 },
        { title: "1.1 Latar Belakang", level: 2, order: 1 },
        { title: "1.2 Rumusan Masalah", level: 2, order: 2 },
        { title: "1.3 Tujuan Penelitian", level: 2, order: 3 },
        { title: "BAB II LANDASAN TEORI", level: 1, order: 4 },
        { title: "BAB III METODOLOGI", level: 1, order: 5 },
        { title: "BAB IV HASIL DAN PEMBAHASAN", level: 1, order: 6 },
        { title: "BAB V PENUTUP", level: 1, order: 7 },
      ],
    };
  }

  const m = b.memory ?? {};
  await prisma.researchMemory.upsert({
    where: { projectId: params.id },
    create: {
      projectId: params.id,
      title: b.title || "",
      problems: toJsonArray(m.problems),
      questions: toJsonArray(m.researchQuestions ?? m.questions),
      objectives: toJsonArray(m.objectives),
      variables: toJsonArray(m.variables),
      criteria: toJsonArray(m.criteria),
      alternatives: toJsonArray(m.alternatives),
    },
    update: {
      title: b.title || "",
      ...(m.problems ? { problems: toJsonArray(m.problems) } : {}),
      ...(m.researchQuestions ?? m.questions ? { questions: toJsonArray(m.researchQuestions ?? m.questions) } : {}),
      ...(m.objectives ? { objectives: toJsonArray(m.objectives) } : {}),
      ...(m.variables ? { variables: toJsonArray(m.variables) } : {}),
      ...(m.criteria ? { criteria: toJsonArray(m.criteria) } : {}),
      ...(m.alternatives ? { alternatives: toJsonArray(m.alternatives) } : {}),
    },
  });

  const updated = await prisma.project.update({
    where: { id: params.id },
    data: update as any,
    include: { sections: { orderBy: { order: "asc" } }, memory: true },
  });
  return NextResponse.json(updated);
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
