import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, AIConfigError } from "@/lib/ai/provider";
import { citationScanMessages } from "@/lib/ai/prompts";
import { searchPapers, type AcademicSource } from "@/lib/academic";
import { parseJsonArray } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 180;

type Ctx = { params: { id: string } };

function toCleanText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<h\d[^>]*>/gi, "\n# ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function formatInText(authors: string[], year: number | null, style = "APA"): string {
  if (style === "IEEE") return "[Sitasi]";
  const yr = year ? String(year) : "s.t.";
  if (!authors.length) return `(Anonim, ${yr})`;
  const first = authors[0].replace(/,\s*[A-Z\.]+.*$/, "").trim();
  if (authors.length === 1) return `(${first}, ${yr})`;
  if (authors.length === 2) {
    const second = authors[1].replace(/,\s*[A-Z\.]+.*$/, "").trim();
    return `(${first} & ${second}, ${yr})`;
  }
  return `(${first} et al., ${yr})`;
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const b = await req.json().catch(() => ({}));
  const scope: "all" | "chapter" | "section" = b.scope || "all";
  const targetId: string = b.targetId || "";

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { sections: { orderBy: { order: "asc" } } },
  });

  if (!project) {
    return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  }

  const allSections = project.sections;
  let targetSections: typeof allSections = [];
  let scopeLabel = "Seluruh Dokumen";

  if (scope === "section" && targetId) {
    const sec = allSections.find((s) => s.id === targetId);
    if (sec) {
      targetSections = [sec];
      scopeLabel = sec.title;
    }
  } else if (scope === "chapter" && targetId) {
    const chapIndex = allSections.findIndex((s) => s.id === targetId);
    if (chapIndex !== -1) {
      const chap = allSections[chapIndex];
      scopeLabel = chap.title;
      targetSections.push(chap);
      // Masukkan semua sub-bab di bawahnya sampai bertemu Bab berikutnya (level 1)
      for (let i = chapIndex + 1; i < allSections.length; i++) {
        const next = allSections[i];
        if (next.level === 1) break;
        targetSections.push(next);
      }
    }
  }

  // Jika all atau fallback
  if (!targetSections.length) {
    targetSections = allSections.filter((s) => !/daftar pustaka|references?/i.test(s.title));
    scopeLabel = "Seluruh Dokumen";
  }

  // Siapkan teks per section
  const prepared = targetSections
    .map((s) => ({
      id: s.id,
      title: s.title,
      text: toCleanText(s.content || ""),
    }))
    .filter((s) => s.text.length > 20);

  if (!prepared.length) {
    return NextResponse.json({
      scope,
      scopeLabel,
      scannedCount: 0,
      opportunities: [],
      message: "Tidak ada teks yang cukup untuk dipindai pada cakupan ini.",
    });
  }

  // 1. Jalankan AI untuk mendeteksi klaim tanpa sitasi
  let rawOpportunities: Array<{
    sectionId: string;
    sectionTitle: string;
    claim: string;
    reason: string;
    academicQuery: string;
  }> = [];

  try {
    const { system, user } = citationScanMessages({
      project,
      sections: prepared,
    });

    const aiRes = await aiChat(
      "citation_scan",
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { projectId: project.id, json: true }
    );

    rawOpportunities = parseJsonArray(aiRes.content);
  } catch (e: any) {
    if (e instanceof AIConfigError) {
      return NextResponse.json({ error: "API Key AI belum diset. Silakan konfigurasi di menu Settings." }, { status: 400 });
    }
    return NextResponse.json({ error: `Gagal memindai teks: ${e.message}` }, { status: 500 });
  }

  // 2. Untuk setiap peluang sitasi, cari jurnal ilmiah riil di OpenAlex / Crossref
  const opportunities = await Promise.all(
    rawOpportunities.slice(0, 8).map(async (opp, idx) => {
      let papers: AcademicSource[] = [];
      const query = opp.academicQuery || opp.claim.slice(0, 80);

      try {
        const { results } = await searchPapers({
          query,
          limit: 3,
        });
        papers = results || [];
      } catch {
        // Fallback: cari dengan frasa klaim singkat
        try {
          const fallbackQuery = opp.claim.split(/\s+/).slice(0, 6).join(" ");
          const { results } = await searchPapers({ query: fallbackQuery, limit: 3 });
          papers = results || [];
        } catch {
          papers = [];
        }
      }

      // Format rekomendasi jurnal
      const suggestedPapers = papers.slice(0, 2).map((p) => {
        const authors = p.authors || [];
        const inText = formatInText(authors, p.year, project.citationStyle);
        return {
          id: p.id,
          title: p.title,
          authors,
          year: p.year,
          journal: p.journal || "Publikasi Akademik",
          doi: p.doi,
          url: p.doi ? `https://doi.org/${p.doi}` : p.url,
          citationCount: p.citationCount || 0,
          inTextCitation: inText,
          metadata: p,
        };
      });

      return {
        id: `opp-${idx + 1}`,
        sectionId: opp.sectionId || targetSections[0]?.id || "",
        sectionTitle: opp.sectionTitle || targetSections[0]?.title || "Dokumen",
        claim: opp.claim,
        reason: opp.reason,
        academicQuery: opp.academicQuery,
        suggestedPapers,
      };
    })
  );

  return NextResponse.json({
    scope,
    scopeLabel,
    scannedCount: targetSections.length,
    totalFound: opportunities.length,
    opportunities,
  });
}

export const dynamic = "force-dynamic";
