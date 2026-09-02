import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, AIConfigError } from "@/lib/ai/provider";
import { citeContextMessages } from "@/lib/ai/prompts";
import { renderInline, toSourceRef } from "@/lib/citations";
import { parseJsonArray } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 120;

type Ctx = { params: { id: string } };

// body: { sourceId, sectionId? }
// Buat SATU kalimat konteks yang sesuai judul/abstrak sumber + tanda sitasi.
// Hasil disisipkan ke editor (sudah termasuk sitasi rendered).
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const source = await prisma.source.findFirst({ where: { id: b.sourceId, projectId: params.id } });
  if (!source) return NextResponse.json({ error: "Sumber tidak ditemukan di library" }, { status: 404 });

  const project = await prisma.project.findUnique({ where: { id: params.id } });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  const section = b.sectionId
    ? await prisma.section.findFirst({ where: { id: b.sectionId, projectId: params.id } })
    : null;

  const ref = toSourceRef(source);
  const citationDisplay = renderInline(ref, project.citationStyle);

  const { system, user } = citeContextMessages({
    project,
    section: (section ?? { id: "", title: "Dokumen", prompt: "", level: 1, order: 0, content: "", status: "EMPTY", parentId: null, createdAt: new Date(), updatedAt: new Date() }) as any,
    source: {
      title: source.title,
      authors: parseJsonArray<string>(source.authors),
      year: source.year,
      journal: source.journal,
      abstract: source.abstract,
    },
    citationDisplay,
  });

  try {
    const res = await aiChat(
      "cite_context",
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { projectId: project.id }
    );
    const sentence = res.content.trim();
    if (!/(19|20)\d{2}|\[\d+\]/.test(sentence)) {
      return NextResponse.json({ error: "Model tidak menyertakan sitasi — coba lagi." }, { status: 422 });
    }
    return NextResponse.json({ sentence, citationDisplay, sourceId: source.id, model: res.model });
  } catch (e: any) {
    if (e instanceof AIConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
