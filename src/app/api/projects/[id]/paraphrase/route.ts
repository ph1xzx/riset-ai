import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, AIConfigError } from "@/lib/ai/provider";
import { paraphraseMessages } from "@/lib/ai/prompts";
import { extractCitationCandidates } from "@/lib/citation-check";
import { stripHtml } from "@/lib/json";
import { cleanAcademicOutput } from "@/lib/ai/clean-output";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: { id: string } };

// body: { sectionId }
// Parafrase SATU section penuh. Sitasi yang sudah ada di teks dijaga
// (dipastikan LLM menetakannya apa adanya) → hasil tetap citation-safe.
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const sectionId: string = b.sectionId;
  if (!sectionId) return NextResponse.json({ error: "sectionId wajib" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });
  const section = project
    ? await prisma.section.findFirst({ where: { id: sectionId, projectId: params.id } })
    : null;
  if (!section) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });

  const contentText = stripHtml(section.content);
  if (contentText.trim().length < 40) {
    return NextResponse.json({ error: "Section terlalu pendek untuk diparafrase" }, { status: 400 });
  }

  // kumpulkan sitasi yang sudah dirender di teks → harus dipertahankan
  const existingCitations = [
    ...new Set(extractCitationCandidates(contentText).map((c) => c.raw)),
  ].slice(0, 40);

  const { system, user } = paraphraseMessages({ project, section, contentText, existingCitations });

  try {
    const res = await aiChat(
      "paraphrase",
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { projectId: project.id }
    );
    const cleaned = cleanAcademicOutput(res.content);
    if (!cleaned) return NextResponse.json({ error: "Model mengembalikan hasil kosong." }, { status: 502 });
    const html = cleaned
      .trim()
      .split(/\n\s*\n+/)
      .map((p) => `<p>${p.trim().replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
      .join("");

    await prisma.section.update({
      where: { id: sectionId },
      data: { content: html, status: "USER_EDITED" },
    });

    return NextResponse.json({
      before: contentText,
      after: cleaned,
      html,
      preservedCitations: existingCitations,
      model: res.model,
    });
  } catch (e: any) {
    if (e instanceof AIConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
