import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, extractJson, AIConfigError } from "@/lib/ai/provider";
import { brainstormMessages } from "@/lib/ai/prompts";
import { defaultStructure } from "@/lib/research";
import { toJsonArray } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: { id: string } };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  const { system, user } = brainstormMessages({
    topic: project.topic,
    field: project.field,
    object: project.object,
    caseStudy: project.caseStudy,
    problem: project.problem,
    method: project.method,
  });

  try {
    const res = await aiChat("brainstorm", [
      { role: "system", content: system },
      { role: "user", content: user },
    ], { projectId: project.id, json: true });
    const data = extractJson<any>(res.content);
    if (!data?.titles?.length) throw new Error("Respons brainstorm kosong");
    return NextResponse.json({ titles: data.titles.slice(0, 5), memory: data.memory ?? null });
  } catch (e: any) {
    if (e instanceof AIConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

