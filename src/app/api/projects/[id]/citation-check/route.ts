import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkCitations, checkCitationConsistency } from "@/lib/citation-check";
import { stripHtml } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 300;

type Ctx = { params: { id: string } };

/**
 * Cek sitasi dokumen (skripsi impor) — ala Jenni:
 * ekstrak kandidat sitasi dari seluruh teks proyek, verifikasi terhadap
 * Crossref (keyless) + daftar pustaka dokumen sendiri.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Project tidak ditemukan" }, { status: 404 });

  // ubah </p> → baris sebelum strip; jangan pakai stripHtml (menyatukan semua
  // whitespace) — cukup strip tag tanpa menyetel baris baru
  const toLines = (html: string) =>
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<h\d[^>]*>/gi, "\n# ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/[ \t]+/g, " ")
      .trim();
  const refSection = project.sections.filter((s) => /daftar pustaka|references?/i.test(s.title));
  const refList = (refSection.map((s) => toLines(s.content)).join("\n").trim() || undefined);
  const bodyText = project.sections
    .filter((s) => !/daftar pustaka|references?/i.test(s.title))
    .map((s) => toLines(s.content))
    .join("\n\n");

  const results = await checkCitations(bodyText, refList);
  const consistency = refList ? checkCitationConsistency(bodyText, refList) : null;

  // simpan hasil
  await prisma.citation.deleteMany({ where: { projectId: params.id } });
  await prisma.citation.createMany({
    data: results.map((r) => ({
      projectId: params.id,
      sourceId: null,
      inText: r.candidate.raw,
      style: r.candidate.kind,
      status: r.status,
      matchedTitle: r.matchedTitle ?? null,
      matchedYear: r.matchedYear ?? null,
      matchedJournal: r.matchedJournal ?? null,
      doi: r.doi ?? null,
      url: r.url ?? null,
      note: r.note ?? null,
    })),
  });

  return NextResponse.json({
    total: results.length,
    verified: results.filter((r) => r.status === "VERIFIED_METADATA").length,
    metadataOnly: results.filter((r) => r.status === "METADATA_ONLY").length,
    notFound: results.filter((r) => r.status === "NOT_FOUND").length,
    consistency,
    results,
  });
}
