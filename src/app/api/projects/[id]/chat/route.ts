import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, AIConfigError } from "@/lib/ai/provider";
import { chatMessages } from "@/lib/ai/prompts";
import { renderCitations } from "@/lib/citations";
import { stripHtml } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: { id: string } };

// body: { threadId?, message, contexts: {sectionId?, selection?, useDocument?, useLibrary?} }
export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json();
  const message: string = b.message || "";
  if (!message.trim()) return NextResponse.json({ error: "message wajib" }, { status: 400 });

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { memory: true, sections: { orderBy: { order: "asc" } }, sources: true },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  // kumpulkan konteks
  const contexts: { label: string; content: string }[] = [];
  if (b.contexts?.sectionId) {
    const sec = project.sections.find((s) => s.id === b.contexts.sectionId);
    if (sec) contexts.push({ label: `Section: ${sec.title}`, content: stripHtml(sec.content) });
  }
  if (b.contexts?.selection) {
    contexts.push({ label: "Teks terpilih", content: b.contexts.selection });
  }
  if (b.contexts?.useDocument) {
    contexts.push({
      label: "Dokumen (ringkas per section)",
      content: project.sections.map((s) => `## ${s.title}\n${stripHtml(s.content).slice(0, 600)}`).join("\n"),
    });
  }
  if (b.contexts?.useLibrary) {
    contexts.push({
      label: "Library",
      content: project.sources
        .slice(0, 15)
        .map((s) => `- ${s.title} (${s.year ?? "s.t."}) — ${s.abstract.slice(0, 200)}`)
        .join("\n"),
    });
  }
  if (b.contexts?.usePdfs) {
    // RAG: chunk PDF paling relevan dengan pesan user (keyword overlap)
    const pdfSources = project.sources.filter((s) => s.provider === "pdf");
    if (pdfSources.length) {
      const chunks = await prisma.sourceChunk.findMany({
        where: { sourceId: { in: pdfSources.map((s) => s.id) } },
        include: { source: true },
        orderBy: { id: "asc" },
      });
      const tokens = new Set(
        message
          .toLowerCase()
          .replace(/[^a-z0-9à-öø-ÿ\s]/gi, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3)
      );
      const scored = chunks
        .map((c) => {
          const ct = c.text.toLowerCase();
          let sc = 0;
          for (const t of tokens) if (ct.includes(t)) sc += 1;
          return { c, sc };
        })
        .sort((a, b2) => b2.sc - a.sc);
      const top = scored.filter((x) => x.sc > 0).slice(0, 6);
      const picked = (top.length ? top : scored.slice(0, 3)).map(
        ({ c }) => `— ${c.source.title} —\n${c.text.slice(0, 900)}`
      );
      if (picked.length) {
        contexts.push({ label: "Isi PDF (chunk relevan)", content: picked.join("\n\n") });
      }
    }
  }

  let thread = b.threadId
    ? await prisma.chatThread.findFirst({ where: { id: b.threadId, projectId: params.id }, include: { messages: { orderBy: { createdAt: "asc" } } } })
    : null;
  if (!thread) {
    thread = await prisma.chatThread.create({
      data: { projectId: params.id, title: message.slice(0, 48) },
      include: { messages: true },
    });
  }
  const history = (thread.messages ?? []).map((m) => ({ role: m.role, content: m.content }));
  await prisma.chatMessage.create({ data: { threadId: thread.id, role: "user", content: message, context: JSON.stringify(contexts.map((c) => c.label)) } });

  const sources = project.sources;
  const { system, user, allowed } = chatMessages({
    project,
    memory: project.memory,
    contexts,
    history,
    userMessage: message,
    sources,
  });

  try {
    const res = await aiChat(
      "chat",
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { projectId: project.id }
    );
    const { text } = renderCitations(res.content, allowed, project.citationStyle);
    await prisma.chatMessage.create({ data: { threadId: thread.id, role: "assistant", content: text } });
    return NextResponse.json({ reply: text, threadId: thread.id, model: res.model, tokens: res.tokens });
  } catch (e: any) {
    if (e instanceof AIConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
