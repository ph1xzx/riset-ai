import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, extractJson, AIConfigError } from "@/lib/ai/provider";
import { reviewMessages } from "@/lib/ai/prompts";
import { stripHtml, parseJsonArray } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: { id: string } };

/**
 * Cek penulisan (ala Jenni Reviews):
 * 1) rule-based: konsistensi antar bab (responden, sample), section kosong,
 *    paragraf terlalu panjang
 * 2) LLM: grammar, tone, koherensi, unsupported claims
 * Hasil disimpan sebagai Review + ReviewIssue.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { memory: true, sections: { orderBy: { order: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  const sections = project.sections.map((s) => ({
    id: s.id,
    title: s.title,
    contentText: stripHtml(s.content),
  }));

  const issues: { severity: string; category: string; sectionId: string | null; message: string; suggestion: string }[] = [];

  // ---- 1) RULE-BASED ----
  // konsistensi "N responden"
  const respMap = new Map<string, Set<string>>();
  for (const s of sections) {
    for (const m of s.contentText.matchAll(/(\d{1,4})\s+responden/gi)) {
      const k = m[1];
      if (!respMap.has(k)) respMap.set(k, new Set());
      respMap.get(k)!.add(s.id);
    }
  }
  if (respMap.size > 1) {
    issues.push({
      severity: "critical",
      category: "Research Consistency",
      sectionId: null,
      message: `Jumlah responden tidak konsisten: ditemukan ${[...respMap.keys()].join(" vs ")} responden di bab berbeda.`,
      suggestion: "Seragamkan jumlah sampel di seluruh dokumen dan perbarui ResearchMemory (sample/sampleSize).",
    });
  }
  // section kosong
  for (const s of sections) {
    if (s.contentText.trim().length < 30) {
      issues.push({
        severity: "suggestion",
        category: "Coverage",
        sectionId: s.id,
        message: `"${s.title}" masih kosong atau sangat pendek.`,
        suggestion: "Generate draf AI atau tulis manual sebelum final.",
      });
    }
  }
  // paragraf panjang
  for (const s of sections) {
    for (const p of s.contentText.split(/\n\s*\n+/)) {
      if (p.split(/\s+/).length > 150) {
        issues.push({
          severity: "warning",
          category: "Coherence",
          sectionId: s.id,
          message: `Terdapat paragraf sangat panjang (>150 kata) di "${s.title}".`,
          suggestion: "Pecah menjadi 2-3 paragraf agar alur argumen lebih mudah diikuti.",
        });
        break;
      }
    }
  }

  // ---- 2) LLM (opsional, jalan bila ada key) ----
  let llmNote = "LLM review dilewati.";
  try {
    const withContent = sections.filter((s) => s.contentText.length >= 30);
    if (withContent.length) {
      const { system, user } = reviewMessages({ project, memory: project.memory, sections: withContent.slice(0, 10) });
      const res = await aiChat(
        "review",
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { projectId: project.id, json: true }
      );
      const data = extractJson<any>(res.content);
      if (Array.isArray(data?.issues)) {
        for (const it of data.issues.slice(0, 30)) {
          issues.push({
            severity: ["critical", "warning", "suggestion"].includes(it.severity) ? it.severity : "suggestion",
            category: it.category || "General",
            sectionId: typeof it.sectionId === "string" ? it.sectionId : null,
            message: it.message || "",
            suggestion: it.suggestion || "",
          });
        }
      }
      if (data?.summary) llmNote = data.summary;
    }
  } catch (e: any) {
    if (e instanceof AIConfigError) llmNote = "LLM review tidak dijalankan (API key belum diset) — hanya cek berbasis aturan.";
    else llmNote = `LLM review gagal: ${e.message?.slice(0, 120)}`;
  }

  const review = await prisma.review.create({
    data: {
      projectId: params.id,
      summary: llmNote,
      issues: { create: issues },
    },
    include: { issues: true },
  });

  return NextResponse.json(review);
}
