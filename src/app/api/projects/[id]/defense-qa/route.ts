import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, extractJson, AIConfigError } from "@/lib/ai/provider";
import { defenseQaMessages } from "@/lib/ai/prompts";
import { stripHtml } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: { id: string } };

// body: { count? } (default 15)
// Simulasi sidang: LLM membaca ResearchMemory + isi dokumen →
// pertanyaan penguji + poin jawaban berbasis isi dokumen.
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const count = Math.min(25, Math.max(5, b.count ?? 15));

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { memory: true, sections: { orderBy: { order: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  const withContent = project.sections.filter((s) => stripHtml(s.content).length >= 30);
  if (!withContent.length) {
    return NextResponse.json(
      { error: "Belum ada isi dokumen yang cukup. Tulis/generate beberapa section dulu." },
      { status: 400 }
    );
  }

  const { system, user } = defenseQaMessages({
    project,
    memory: project.memory,
    sections: withContent.slice(0, 10).map((s) => ({ title: s.title, contentText: stripHtml(s.content) })),
    count,
  });

  try {
    const res = await aiChat(
      "defense_qa",
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { projectId: project.id, json: true }
    );
    const data = extractJson<any>(res.content);
    if (!Array.isArray(data?.questions)) throw new Error("Respons AI tidak valid");
    return NextResponse.json({ questions: data.questions.slice(0, count), model: res.model });
  } catch (e: any) {
    if (e instanceof AIConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
