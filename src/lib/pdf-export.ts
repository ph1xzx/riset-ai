import PDFDocument from "pdfkit";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { CampusStyle, parseCampusStyle } from "./campus";
import type { Section } from "./types";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");

/**
 * Native server-side PDF export (no LibreOffice required).
 *
 * The original app shelled out to LibreOffice, which is unavailable in
 * serverless environments and returned HTTP 502. This implementation renders
 * the document directly with pdfkit, honouring the campus style:
 *  - page size + margins (mm)
 *  - body font + size, line spacing, first-line indent
 *  - H1: page break, uppercase, centered
 *  - hanging-indent references
 */
export async function exportPdf(
  project: { title: string; type: string; method: string },
  sections: Section[],
  campusRaw: string | null,
  references: string[] = []
): Promise<Buffer> {
  const style = parseCampusStyle(campusRaw);
  const font = mapFont(style.body.font);
  const bodySize = style.body.size;
  const lineH = bodySize * style.body.lineSpacing * 1.15;
  const indentMm = style.body.firstLineIndentMm;

  const doc = new PDFDocument({
    size: style.pageSize === "Letter" ? "LETTER" : "A4",
    margins: {
      top: mm(style.margins.top),
      right: mm(style.margins.right),
      bottom: mm(style.margins.bottom),
      left: mm(style.margins.left),
    },
    bufferPages: true,
    info: { Title: project.title, Author: "Riset AI" },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));

  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const indentPt = indentMm > 0 ? (indentMm / 25.4) * 72 : 0;

  doc.font(font).fontSize(bodySize);

  // Title
  doc
    .moveTo(doc.page.margins.left, doc.page.margins.top)
    .font(font)
    .fontSize(bodySize + 2)
    .text(project.title, { align: "center", width: pageW });
  doc
    .font(font)
    .fontSize(bodySize)
    .text(`${project.type}${project.method ? ` — ${project.method}` : ""}`, { align: "center", width: pageW });
  doc.moveDown(0.5);

  const writeParagraph = (text: string, opts: { indent?: boolean; size?: number; bold?: boolean } = {}) => {
    if (!text.trim()) return;
    doc
      .font(opts.bold ? boldFont(font) : font)
      .fontSize(opts.size ?? bodySize)
      .text(text, {
        indent: opts.indent ? indentPt : 0,
        width: pageW,
        lineGap: lineH - bodySize,
        align: "justify",
      });
  };

  for (const sec of sections) {
    if (sec.level === 1 && style.heading1.pageBreakBefore) {
      doc.addPage();
      doc.moveDown(0.2);
    }
    const hSize = bodySize;
    doc
      .font(boldFont(font))
      .fontSize(hSize)
      .text(sec.level === 1 && style.heading1.uppercase ? sec.title.toUpperCase() : sec.title, {
        align: sec.level === 1 && style.heading1.centered ? "center" : "left",
        width: pageW,
        lineGap: lineH - bodySize,
      });
    doc.moveDown(0.3);

    const $ = cheerio.load(sec.content || "", null, false);
    // fragment mode: iterate root children, not <body>
    $.root().children().each((_, el: any) => {
      const tag = el.name;
      if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
        doc.font(boldFont(font)).fontSize(bodySize).text($(el).text().trim(), { width: pageW, lineGap: lineH - bodySize });
        return;
      }
      if (tag === "ul" || tag === "ol") {
        let i = 1;
        $(el).find("> li").each((__, li: any) => {
          const prefix = tag === "ol" ? `${i++}. ` : "• ";
          writeParagraph(prefix + $(li).text().trim(), { indent: true });
        });
        return;
      }
      if (tag === "table") {
        const rows = $(el).find("tr");
        rows.each((__, tr) => {
          const cells = $(tr).find("td, th").map((___, td) => $(td).text().trim()).get();
          writeParagraph(cells.join("  |  "));
        });
        doc.moveDown(0.3);
        return;
      }
      if (tag === "p" || tag === "div" || tag === "blockquote") {
        const img = $(el).find("img").first();
        if (img.length) {
          const src = img.attr("src") || "";
          if (src.startsWith("/files/") || src.startsWith("files/")) {
            const p = path.join(STORAGE_DIR, src.split("/").pop()!);
            if (fs.existsSync(p)) {
              try {
                doc.image(p, { fit: [pageW * 0.8, 300], align: "center" });
              } catch {
                /* skip */
              }
            }
          }
        }
        writeParagraph($(el).text().trim(), { indent: true });
        return;
      }
    });
    doc.moveDown(0.4);
  }

  if (references.length) {
    doc.addPage();
    doc.font(boldFont(font)).fontSize(bodySize).text("DAFTAR PUSTAKA", { align: "center", width: pageW });
    doc.moveDown(0.5);
    doc.font(font).fontSize(bodySize);
    for (const ref of references) {
      doc.text(ref, { indent: (style.references.hangingIndentMm / 25.4) * 72, width: pageW, lineGap: 4, align: "left" });
      doc.moveDown(0.4);
    }
  }

  doc.end();
  await new Promise<void>((resolve) => doc.on("end", resolve));
  return Buffer.concat(chunks);
}

function mm(cm: number): number {
  return (cm / 2.54) * 72;
}
function mapFont(f: string): string {
  const n = f.toLowerCase();
  if (n.includes("times") || n.includes("roman")) return "Times-Roman";
  if (n.includes("courier") || n.includes("mono")) return "Courier";
  return "Helvetica";
}
function boldFont(f: string): string {
  return f.replace("-Roman", "-Bold").replace("-Oblique", "-BoldOblique");
}
