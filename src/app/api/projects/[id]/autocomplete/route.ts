import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, AIConfigError } from "@/lib/ai/provider";
import { autocompleteMessages } from "@/lib/ai/prompts";
import { retrieveSources } from "@/lib/retrieval";
import { renderCitations, validateSourceTokens } from "@/lib/citations";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: { id: string } };

// body: { sectionId, paragraph }
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const sectionId: string = b.sectionId;
  const paragraph: string = b.paragraph || "";
  if (!sectionId || paragraph.trim().length < 30) {
    return NextResponse.json({ error: "paragraph terlalu pendek untuk autocomplete" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { memory: true, sections: true, sources: true },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  const section = project.sections.find((s) => s.id === sectionId);
  if (!section) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });

  const sources = retrieveSources(project.sources, { section, memory: project.memory, project, max: 6 });
  const { system, user, allowed } = autocompleteMessages({ project, memory: project.memory, section, paragraph, sources });

  try {
    const res = await aiChat(
      "autocomplete",
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { projectId: project.id }
    );

    const tokens = validateSourceTokens(res.content, allowed);
    const rejected = tokens.filter((t) => !t.valid).map((t) => t.marker);
    const { text } = renderCitations(res.content, allowed, project.citationStyle);

    return NextResponse.json({ suggestion: text, rejectedTokens: rejected, model: res.model });
  } catch (e: any) {
    if (e instanceof AIConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
