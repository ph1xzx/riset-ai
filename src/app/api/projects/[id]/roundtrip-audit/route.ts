import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseDocx } from "@/lib/docx-import";
import { exportProjectToDocx } from "@/lib/docx-export";
import { countTables } from "@/lib/table-format";
import { stripHtml } from "@/lib/json";

export const runtime = "nodejs";
export const maxDuration = 120;

type AuditIssue = { severity: "error" | "warn"; code: string; msg: string };

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function wordCount(html: string): number {
  return stripHtml(html).split(/\s+/).filter(Boolean).length;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const project = await prisma.project.findUnique({
    where: { id: params.id },
    include: { sections: { orderBy: { order: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });

  try {
    const originalSections = project.sections.filter((section) => {
      return section.title !== "(Bagian awal)" && (section.title.trim() || stripHtml(section.content || "").trim());
    });
    const originalHtml = project.sections.map((section) => section.content || "").join(" ");
    const originalWords = originalSections.reduce((sum, section) => sum + wordCount(section.content || ""), 0);
    const originalTables = countTables(originalHtml);

    const { buffer, filename } = await exportProjectToDocx(params.id);
    const imported = await parseDocx(buffer);
    const importedWords = imported.sections.reduce((sum, section) => sum + wordCount(section.html), 0);
    const importedTables = countTables(imported.rawHtml);
    const importedTitles = imported.sections.map((section) => normalized(section.title)).filter(Boolean);

    const missingSections = originalSections
      .map((section) => section.title.trim())
      .filter((title) => {
        const target = normalized(title);
        return target && !importedTitles.some((candidate) => candidate === target || candidate.includes(target) || target.includes(candidate));
      });

    const issues: AuditIssue[] = [];
    if (missingSections.length) {
      issues.push({
        severity: "error",
        code: "MISSING_SECTION",
        msg: `${missingSections.length} judul section tidak terbaca saat DOCX diimpor kembali.`,
      });
    }
    if (originalTables !== importedTables) {
      issues.push({
        severity: "error",
        code: "TABLE_COUNT",
        msg: `Jumlah tabel berubah dari ${originalTables} menjadi ${importedTables}.`,
      });
    }
    if (originalWords > 0 && importedWords === 0) {
      issues.push({ severity: "error", code: "EMPTY_ROUNDTRIP", msg: "Isi section hilang seluruhnya setelah DOCX dibaca ulang." });
    } else if (originalWords > 20 && importedWords < Math.floor(originalWords * 0.85)) {
      issues.push({
        severity: "error",
        code: "WORD_LOSS",
        msg: `Jumlah kata turun dari ${originalWords} menjadi ${importedWords}. Periksa dokumen sebelum dibagikan.`,
      });
    } else if (originalWords > 0 && importedWords !== originalWords) {
      issues.push({
        severity: "warn",
        code: "WORD_DELTA",
        msg: `Jumlah kata berubah dari ${originalWords} menjadi ${importedWords}, biasanya karena heading dan elemen Word ikut terbaca.`,
      });
    }

    return NextResponse.json({
      ok: !issues.some((issue) => issue.severity === "error"),
      filename,
      original: { sections: originalSections.length, words: originalWords, tables: originalTables },
      roundtrip: { sections: imported.sections.length, words: importedWords, tables: importedTables },
      missingSections,
      issues,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Audit DOCX gagal dijalankan" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
