import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { defaultStructure } from "@/lib/research";
import { toJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { sections: true, sources: true } } },
  });
  return NextResponse.json(projects);
}

type CreateBody = {
  title?: string;
  type?: string;
  topic?: string;
  field?: string;
  object?: string;
  caseStudy?: string;
  problem?: string;
  method?: string;
  language?: string;
  citationStyle?: string;
  yearFrom?: number;
  yearTo?: number;
  minCitations?: number;
  includePreprint?: boolean;
  campusStyle?: object;
  documentPrompt?: string;
  memory?: {
    problems?: string[];
    researchQuestions?: string[];
    objectives?: string[];
    variables?: string[];
    criteria?: string[];
    alternatives?: string[];
  };
  structure?: { title: string; level: number }[]; // custom structure (dari pedoman)
};

export async function POST(req: NextRequest) {
  const b = (await req.json()) as CreateBody;
  const project = await prisma.project.create({
    data: {
      title: b.title || b.topic || "Untitled research",
      type: b.type || "Skripsi",
      topic: b.topic || "",
      field: b.field || "",
      object: b.object || "",
      caseStudy: b.caseStudy || "",
      problem: b.problem || "",
      method: b.method || "",
      language: b.language || "id",
      citationStyle: b.citationStyle || "APA7",
      yearFrom: b.yearFrom ?? null,
      yearTo: b.yearTo ?? null,
      minCitations: b.minCitations ?? null,
      includePreprint: b.includePreprint ?? false,
      campusStyle: b.campusStyle ? JSON.stringify(b.campusStyle) : "{}",
      documentPrompt: b.documentPrompt || "",
      memory: b.memory
        ? {
            create: {
              title: b.title || b.topic || "",
              problems: toJsonArray(b.memory.problems),
              questions: toJsonArray(b.memory.researchQuestions),
              objectives: toJsonArray(b.memory.objectives),
              variables: toJsonArray(b.memory.variables),
              criteria: toJsonArray(b.memory.criteria),
              alternatives: toJsonArray(b.memory.alternatives),
            },
          }
        : undefined,
      sections: {
        create: (b.structure?.length ? b.structure : defaultStructure(b.type || "Skripsi")).map((s, i) => ({
          title: s.title,
          level: s.level === 2 ? 2 : 1,
          order: i,
        })),
      },
    },
    include: { sections: { orderBy: { order: "asc" } }, memory: true },
  });
  return NextResponse.json(project, { status: 201 });
}
