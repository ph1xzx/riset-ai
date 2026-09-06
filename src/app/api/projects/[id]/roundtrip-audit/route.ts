import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject } from "@/lib/api";
import { splitIntoSections } from "@/lib/docx-import";
import { exportDocx } from "@/lib/docx-export";
import { importDocx } from "@/lib/docx-import";
import { wordCount, stripHtml } from "@/lib/util";

/**
 * Roundtrip audit: export the current project to DOCX, re-import it, and
 * compare structure (section count/titles) and text volume. Gives confidence
 * that "Export DOCX" faithfully preserves the document.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;

  const sections = (db.prepare('SELECT * FROM sections WHERE project_id = ? ORDER BY "order" ASC, id ASC').all(id) as any[]).map((s) => ({
    id: s.id, projectId: s.project_id, parentId: s.parent_id, title: s.title,
    order: s.order, level: s.level, content: s.content, status: s.status,
    prompt: s.prompt, updatedAt: s.updated_at,
  }));

  const before = {
    sections: sections.length,
    words: sections.reduce((n, s) => n + wordCount(s.content), 0),
    images: sections.reduce((n, s) => n + (s.content.match(/<img /g) || []).length, 0),
  };

  let docxBuffer: Buffer;
  try {
    docxBuffer = await exportDocx(r.project, sections as any, r.project.campusStyle, []);
  } catch (e: any) {
    return NextResponse.json({ error: "Gagal export untuk audit: " + String(e.message).slice(0, 120) }, { status: 500 });
  }

  let after: { sections: number; words: number; images: number } = { sections: 0, words: 0, images: 0 };
  try {
    const reimported = await importDocx(docxBuffer);
    after = {
      sections: reimported.sections.length,
      words: reimported.sections.reduce((n, s) => n + wordCount(s.content), 0),
      images: reimported.sections.reduce((n, s) => n + (s.content.match(/<img /g) || []).length, 0),
    };
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      before,
      after: null,
      verdict: "Gagal re-import DOCX hasil export: " + String(e.message).slice(0, 150),
    });
  }

  const sectionDelta = after.sections - before.sections;
  const wordDelta = Math.round(((after.words - before.words) / Math.max(1, before.words)) * 100);
  const verdict =
    Math.abs(sectionDelta) <= 2 && wordDelta >= -5 && after.images >= before.images
      ? "OK — struktur dan isi terjaga pada roundtrip export→import."
      : `PERLU DIPERIKSA — selisih section ${sectionDelta}, kata ${wordDelta}%, gambar ${after.images}/${before.images}.`;

  return NextResponse.json({ ok: wordDelta >= -5 && Math.abs(sectionDelta) <= 2, before, after, wordDeltaPct: wordDelta, verdict });
}
