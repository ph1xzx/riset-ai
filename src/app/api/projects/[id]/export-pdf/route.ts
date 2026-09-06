import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject, rowToSource } from "@/lib/api";
import { exportPdf } from "@/lib/pdf-export";
import { formatReference } from "@/lib/cite";
import type { CitationStyle } from "@/lib/cite";

/**
 * Export the whole project as a .pdf.
 *
 * FIX vs the original app: the original shelled out to LibreOffice, which is
 * not available in serverless runtimes and returned HTTP 502. This endpoint
 * renders the PDF natively with pdfkit (no external binary), honouring the
 * campus style.
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
  const sources = (db.prepare("SELECT * FROM sources WHERE project_id = ? ORDER BY added_at ASC").all(id) as any[]).map((s) => rowToSource(s));
  const style = (r.project.citationStyle as CitationStyle) || "APA7";
  const references = sources.map((s) => formatReference(s as any, style));

  try {
    const buf = await exportPdf(r.project, sections as any, r.project.campusStyle, references);
    const filename = `${r.project.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase().slice(0, 60) || "dokumen"}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Gagal membuat PDF: " + String(e.message).slice(0, 150) }, { status: 500 });
  }
}
