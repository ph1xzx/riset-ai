import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, extractJson, AIConfigError } from "@/lib/ai/provider";
import { figureSuggestionsMessages } from "@/lib/ai/prompts";
import { stripHtml } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: { id: string } };

// body: {}
// Analisa dokumen → usulan gambar per section (diagram/illustrasi/foto/logo).
// Menjawab "gambar langsung masuk ke sub-bab yang membahas alur pemikiran dll".
export async function POST(_req: NextRequest, { params }: Ctx) {
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

  const { system, user } = figureSuggestionsMessages({
    project,
    sections: withContent.slice(0, 12).map((s) => ({ title: s.title, contentText: stripHtml(s.content) })),
  });

  try {
    const res = await aiChat(
      "figure_suggestions",
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { projectId: project.id, json: true }
    );
    const data = extractJson<any>(res.content);
    if (!Array.isArray(data?.figures)) throw new Error("Respons AI tidak valid");
    const figures = data.figures.slice(0, 5).map((f: any, i: number) => {
      const kind = ["diagram", "ilustrasi", "foto", "logo"].includes(f.kind) ? f.kind : "diagram";
      const caption = String(f.caption || `Gambar ${i + 1}`).slice(0, 160);
      // Fallback: jenis logo harus selalu punya query pencarian (user tidak perlu mengetik)
      let webQuery: string | null = f.webQuery ? String(f.webQuery).slice(0, 120) : null;
      if (kind === "logo" && !webQuery) {
        const derived = caption.replace(/^Gambar\s*\d+\.?\s*/i, "").trim() || String(f.sectionTitle || "").trim();
        webQuery = derived ? `${derived} logo` : null;
      }
      return {
        index: i + 1,
        sectionTitle: String(f.sectionTitle || "").slice(0, 120),
        caption,
        kind,
        prompt: f.prompt ? String(f.prompt).slice(0, 600) : null,
        webQuery,
        why: String(f.why || "").slice(0, 300),
      };
    });
    return NextResponse.json({ figures, model: res.model });
  } catch (e: any) {
    if (e instanceof AIConfigError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
