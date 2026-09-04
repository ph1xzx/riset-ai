import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { aiChat, AIConfigError } from "@/lib/ai/provider";
import { citationScanMessages } from "@/lib/ai/prompts";
import { searchPapers, type AcademicSource } from "@/lib/academic";

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

/** Robust JSON parser for AI outputs (handles root array, object wrapper, or code fences) */
function parseOpportunitiesJson(rawText: string): any[] {
  if (!rawText) return [];
  let clean = rawText.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  try {
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const foundArr = Object.values(parsed).find((v) => Array.isArray(v));
      if (foundArr && Array.isArray(foundArr)) return foundArr;
    }
  } catch {
    const matches = clean.match(/\{[\s\S]*?\}/g);
    if (matches) {
      const items = [];
      for (const m of matches) {
        try {
          const item = JSON.parse(m);
          if (item.claim) items.push(item);
        } catch {}
      }
      return items;
    }
  }
  return [];
}

/** Fallback Heuristic Scanner — bekerja tanpa butuh API key AI */
function extractHeuristicClaims(sections: Array<{ id: string; title: string; text: string }>) {
  const results: Array<{
    sectionId: string;
    sectionTitle: string;
    claim: string;
    reason: string;
    academicQuery: string;
  }> = [];

  const triggers = [
    { regex: /\b(metode|algoritma|model|framework|pendekatan|arsitektur)\b/i, reason: "Pernyataan metodologi atau model membutuhkan rujukan sumber primer." },
    { regex: /\b(penelitian terdahulu|menurut|berdasarkan studi|penelitian sebelumnya|dikemukakan oleh)\b/i, reason: "Pernyataan tinjauan pustaka membutuhkan sitasi nama peneliti dan tahun." },
    { regex: /\b(teori|konsep|prinsip|paradigma)\b/i, reason: "Landasan teoritis membutuhkan rujukan pustaka ilmiah." },
    { regex: /\b(\d+[\.,]?\d*\s*%|\d+\s+responden|\d+\s+sampel|secara signifikan|menunjukkan bahwa)\b/i, reason: "Klaim statistik atau temuan empiris memerlukan rujukan pendukung." },
    { regex: /\b(merupakan salah satu|didefinisikan sebagai|adalah suatu)\b/i, reason: "Definisi konseptual memerlukan rujukan dari buku teks atau jurnal." }
  ];

  for (const s of sections) {
    const sentences = s.text.split(/(?<=[.!?])\s+/);
    for (const sent of sentences) {
      const clean = sent.trim();
      if (clean.length < 35 || clean.length > 280) continue;
      if (/\(\s*[A-Z][a-z]+.*?\d{4}\s*\)|\[\d+\]|<sup/i.test(clean)) continue;
      if (/^[#\*\-\d\.\)]/.test(clean)) continue;

      for (const t of triggers) {
        if (t.regex.test(clean)) {
          const words = clean
            .replace(/[^\w\s]/g, "")
            .split(/\s+/)
            .filter((w) => w.length > 3 && !/^(yang|untuk|dalam|pada|dengan|adalah|sebagai|dari|akan|dapat|oleh|atau|juga|serta|tidak|karena|pada|saat)$/i.test(w))
            .slice(0, 5)
            .join(" ");

          results.push({
            sectionId: s.id,
            sectionTitle: s.title,
            claim: clean,
            reason: t.reason,
            academicQuery: words || clean.slice(0, 60),
          });
          break;
        }
      }
      if (results.length >= 8) break;
    }
    if (results.length >= 8) break;
  }

  return results;
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
      for (let i = chapIndex + 1; i < allSections.length; i++) {
        const next = allSections[i];
        if (next.level === 1) break;
        targetSections.push(next);
      }
    }
  }

  if (!targetSections.length) {
    targetSections = allSections.filter((s) => !/daftar pustaka|references?/i.test(s.title));
    scopeLabel = "Seluruh Dokumen";
  }

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
      message: "Tidak ada teks yang cukup untuk dipindai pada cakupan ini (minimal 20 karakter).",
    });
  }

  let rawOpportunities: Array<{
    sectionId: string;
    sectionTitle: string;
    claim: string;
    reason: string;
    academicQuery: string;
  }> = [];

  let usedAi = false;
  let notice: string | null = null;

  // 1. Coba pindai dengan AI (jika API Key aktif)
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

    const parsed = parseOpportunitiesJson(aiRes.content);
    if (parsed.length > 0) {
      rawOpportunities = parsed;
      usedAi = true;
    }
  } catch (e: any) {
    if (e instanceof AIConfigError) {
      notice = "Mode Cepat Heuristik (OpenAlex) aktif. Untuk pemindaian semantik mendalam, masukkan API Key (Gemini) di menu Settings.";
    } else {
      notice = `AI mengalami kendala (${e.message}). Beralih otomatis ke mode heuristik OpenAlex.`;
    }
  }

  // 2. Fallback Heuristik otomatis jika AI gagal atau API Key belum diset
  if (!rawOpportunities.length) {
    rawOpportunities = extractHeuristicClaims(prepared);
    if (!notice) {
      notice = "Hasil pemindaian otomatis berbasis heuristik akademik & OpenAlex.";
    }
  }

  // 3. Cari jurnal riil pendukung di OpenAlex & Crossref
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
        try {
          const fallbackQuery = opp.claim.split(/\s+/).slice(0, 5).join(" ");
          const { results } = await searchPapers({ query: fallbackQuery, limit: 3 });
          papers = results || [];
        } catch {
          papers = [];
        }
      }

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
    usedAi,
    notice,
    opportunities,
  });
}

export const dynamic = "force-dynamic";
