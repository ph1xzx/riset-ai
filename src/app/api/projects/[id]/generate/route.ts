import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, AIConfigError } from "@/lib/ai/provider";
import { generateSectionMessages } from "@/lib/ai/prompts";
import { retrieveSources } from "@/lib/retrieval";
import { validateSourceTokens, renderCitations } from "@/lib/citations";
import { stripHtml } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: { id: string } };

/**
 * Generate satu sub-bab:
 * ResearchMemory + SectionPrompt + approved sections + retrieval sources
 * → LLM → validasi SOURCE token → render sitasi → simpan sebagai AI_DRAFT.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const sectionId: string = b.sectionId;
  if (!sectionId) return NextResponse.json({ error: "sectionId wajib" }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { memory: true, sections: { orderBy: { order: "asc" } }, sources: true },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  const section = project.sections.find((s) => s.id === sectionId);
  if (!section) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });

  const previousApproved = project.sections
    .filter((s) => s.order < section.order && (s.status === "APPROVED" || s.status === "USER_EDITED"))
    .map((s) => ({ title: s.title, contentText: stripHtml(s.content).slice(0, 1500) }))
    .slice(-4);

  const sources = retrieveSources(project.sources, { section, memory: project.memory, project });
  const { system, user, allowed } = generateSectionMessages({
    project,
    memory: project.memory,
    section,
    previousApproved,
    sources,
  });

  try {
    const res = await aiChat(
      "generate_section",
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { projectId: project.id }
    );

    // ---- CITATION SAFETY ----
    const tokens = validateSourceTokens(res.content, allowed);
    const rejected = tokens.filter((t) => !t.valid).map((t) => t.marker);
    const { text: clean, usedSourceIds } = renderCitations(res.content, allowed, project.citationStyle);
    // konversi ke HTML paragraf
    const html = clean
      .split(/\n\s*\n+/)
      .map((p) => `<p>${p.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
      .join("");

    await prisma.section.update({
      where: { id: sectionId },
      data: { content: html, status: "AI_DRAFT" },
    });

    // catat CitationUsage
    if (usedSourceIds.length) {
      await prisma.citationUsage.createMany({
        data: usedSourceIds
          .filter((sid) => allowed.has(sid))
          .map((sid) => ({ projectId: project.id, sectionId, sourceId: sid, marker: `[[SOURCE_${sid}]]`, display: "" })),
      });
    }

    return NextResponse.json({
      html,
      usedSourceIds,
      rejectedTokens: rejected,
      tokens: res.tokens,
      model: res.model,
      latencyMs: res.latencyMs,
      sourcesUsed: sources.map((s) => ({ id: s.id, title: s.title })),
    });
  } catch (e: any) {
    if (e instanceof AIConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
