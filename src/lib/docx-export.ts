import {
  AlignmentType,
  Document,
  HeadingLevel,
  ImageRun,
  LineRuleType,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  convertInchesToTwip,
  BorderStyle,
} from "docx";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { CampusStyle, parseCampusStyle, mmToTwips } from "./campus";
import type { Section } from "./types";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");

const VALID_IMG_TYPES = ["png", "gif", "jpg", "bmp"] as const;
type ImgType = (typeof VALID_IMG_TYPES)[number];
const imgTypeOf = (t: string): ImgType =>
  t === "jpeg" ? "jpg" : (VALID_IMG_TYPES as readonly string[]).includes(t) ? (t as ImgType) : "png";

/** Convert a TipTap HTML string into an array of docx block elements. */
function htmlToBlocks(html: string): (Paragraph | Table | any)[] {
  const $ = cheerio.load(html || "", null, false);
  const blocks: (Paragraph | Table | any)[] = [];
  // fragment mode: content lives under the root, not under <body>
  const body = $.root();

  // Inline HTML -> TextRuns, accumulating style opts recursively.
  // (docx v9 keeps run options private, so styles must be applied at
  // construction time — re-wrapping a built run loses its text.)
  const inlineRuns = (el: any, style: Record<string, any> = {}): TextRun[] => {
    const runs: TextRun[] = [];
    $(el)
      .contents()
      .each((_, node: any) => {
        if (node.type === "text") {
          const t = node.data;
          if (t.length) runs.push(new TextRun({ ...style, text: t }));
          return;
        }
        if (node.type !== "tag") return;
        const tag = node.name;
        if (tag === "br") {
          runs.push(new TextRun({ ...style, break: 1 }));
          return;
        }
        if (tag === "img") {
          const src = $(node).attr("src") || "";
          const img = imageRun(src);
          if (img) runs.push(img as any);
          return;
        }
        if (tag === "strong" || tag === "b") {
          runs.push(...inlineRuns(node, { ...style, bold: true }));
          return;
        }
        if (tag === "em" || tag === "i") {
          runs.push(...inlineRuns(node, { ...style, italics: true }));
          return;
        }
        if (tag === "u" || tag === "ins") {
          runs.push(...inlineRuns(node, { ...style, underline: {} }));
          return;
        }
        if (tag === "s" || tag === "strike" || tag === "del") {
          runs.push(...inlineRuns(node, { ...style, strike: true }));
          return;
        }
        if (tag === "mark" || node.attribs?.class?.includes("highlight")) {
          runs.push(...inlineRuns(node, { ...style, highlight: "yellow" }));
          return;
        }
        if (tag === "code") {
          runs.push(...inlineRuns(node, { ...style, font: "Courier New" }));
          return;
        }
        if (tag === "sup") {
          runs.push(...inlineRuns(node, { ...style, superScript: true }));
          return;
        }
        if (tag === "sub") {
          runs.push(...inlineRuns(node, { ...style, subScript: true }));
          return;
        }
        if (tag === "a") {
          const href = $(node).attr("href");
          if (href && href.startsWith("http")) {
            runs.push(
              new TextRun({
                ...style,
                text: $(node).text(),
                style: "Hyperlink",
              })
            );
          } else {
            runs.push(...inlineRuns(node, style));
          }
          return;
        }
        // generic inline (span, div-inline, etc.)
        runs.push(...inlineRuns(node, style));
      });
    return runs;
  };

  const imageRun = (src: string): TextRun | ImageRun | null => {
    try {
      if (src.startsWith("data:image/")) {
        const m = src.match(/^data:image\/([a-z]+);base64,(.+)$/);
        if (m) return new ImageRun({ type: imgTypeOf(m[1]), data: Buffer.from(m[2], "base64"), transformation: { width: 320, height: 240 } });
      }
      if (src.startsWith("/files/") || src.startsWith("files/")) {
        const name = src.split("/").pop()!;
        const p = path.join(STORAGE_DIR, name);
        if (fs.existsSync(p)) {
          const ext = name.split(".").pop()?.toLowerCase() || "png";
          return new ImageRun({ type: imgTypeOf(ext), data: fs.readFileSync(p), transformation: { width: 340, height: 240 } });
        }
      }
    } catch {
      /* ignore broken images */
    }
    return src ? new TextRun(`[gambar: ${src.slice(0, 40)}]`) : null;
  };

  body.children().each((_, el: any) => {
    const $el = $(el);
    const tag = el.name;

    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4") {
      const level = Number(tag[1]);
      blocks.push(
        new Paragraph({
          heading: (["Heading1", "Heading2", "Heading3", "Heading4"][level - 1]) as any,
          children: $el.text().trim() ? [new TextRun($el.text().trim())] : [],
        })
      );
      return;
    }

    if (tag === "ul" || tag === "ol") {
      $el.find("> li").each((__, li: any) => {
        const ordered = tag === "ol";
        blocks.push(
          new Paragraph({
            bullet: ordered ? undefined : { level: 0 },
            numbering: undefined,
            children: inlineRuns(li),
          })
        );
      });
      return;
    }

    if (tag === "table") {
      blocks.push(convertTable($el, $));
      return;
    }

    if (tag === "p" || tag === "div" || tag === "blockquote") {
      const runs = inlineRuns(el);
      if (runs.length === 0 && !$el.text().trim()) return;
      blocks.push(new Paragraph({ children: runs.length ? runs : [new TextRun($el.text())] }));
      return;
    }
    // fallback
    if ($el.text().trim()) blocks.push(new Paragraph({ children: [new TextRun($el.text().trim())] }));
  });

  return blocks;
}

function convertTable($el: any, $: any): Table {
  const rows: TableRow[] = [];
  $el.find("tr").each((__: number, tr: any) => {
    const cells: TableCell[] = [];
    $(tr).find("td, th").each((___: number, td: any) => {
      cells.push(
        new TableCell({
          children: [new Paragraph({ children: [new TextRun($(td).text())] })],
        })
      );
    });
    if (cells.length) rows.push(new TableRow({ children: cells }));
  });
  if (!rows.length) {
    rows.push(new TableRow({ children: [new TableCell({ children: [new Paragraph("")] })] }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

/**
 * Build a formatted .docx for the whole project, applying the campus style
 * (margins, font, line spacing, heading treatment, page breaks).
 * Returns the binary buffer.
 */
export async function exportDocx(
  project: { title: string; type: string; method: string },
  sections: Section[],
  campusRaw: string | null,
  references: string[] = []
): Promise<Buffer> {
  const style = parseCampusStyle(campusRaw);
  const font = style.body.font;
  const bodySize = style.body.size;

  const children: any[] = [];

  // Title block
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: project.title, bold: true, size: bodySize * 2, font })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `${project.type}${project.method ? ` — ${project.method}` : ""}`, size: bodySize, font, color: "666666" })],
    })
  );

  for (const sec of sections) {
    const isH1 = sec.level === 1;
    const isFront = sec.title === "(Bagian awal)";
    if (isH1 && !isFront && style.heading1.pageBreakBefore && children.length > 2) {
      children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    }
    // Section heading (from its title) — skip the internal front-matter placeholder
    if (!isFront) children.push(
      new Paragraph({
        heading: (["Heading1", "Heading2", "Heading3", "Heading4"][Math.min(sec.level, 4) - 1]) as any,
        alignment: isH1 && style.heading1.centered ? AlignmentType.CENTER : AlignmentType.LEFT,
        pageBreakBefore: isH1 && style.heading1.pageBreakBefore && children.length > 2,
        spacing: { before: 120, after: 120 },
        children: [
          new TextRun({
            text: style.heading1.uppercase && isH1 ? sec.title.toUpperCase() : sec.title,
            bold: sec.level <= 2 ? (style as any)[`heading${sec.level}`]?.bold ?? true : (style as any)[`heading${sec.level}`]?.bold ?? false,
            size: bodySize * 2,
            font,
          }),
        ],
      })
    );
    // Content
    for (const block of htmlToBlocks(sec.content)) {
      children.push(block);
    }
  }

  // References
  if (references.length) {
    children.push(
      new Paragraph({
        pageBreakBefore: true,
        spacing: { before: 120, after: 200 },
        children: [new TextRun({ text: "DAFTAR PUSTAKA", bold: true, size: bodySize * 2, font })],
      })
    );
    for (const ref of references) {
      children.push(
        new Paragraph({
          indent: { hanging: mmToTwips(style.references.hangingIndentMm) },
          spacing: { line: 240 * style.references.lineSpacing, lineRule: LineRuleType.AUTO, after: 120 },
          children: [new TextRun({ text: ref, size: bodySize, font })],
        })
      );
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font, size: bodySize * 2 } },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font, size: bodySize * 2, bold: style.heading1.bold, color: "000000" },
          paragraph: { spacing: { before: 120, after: 120 } },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font, size: bodySize * 2, bold: style.heading2.bold, color: "000000" },
          paragraph: { spacing: { before: 120, after: 120 } },
        },
        {
          id: "Heading3",
          name: "Heading 3",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font, size: bodySize * 2, bold: style.heading3.bold, color: "000000" },
          paragraph: { spacing: { before: 120, after: 120 } },
        },
        {
          id: "Heading4",
          name: "Heading 4",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font, size: bodySize * 2, bold: true, color: "000000" },
          paragraph: { spacing: { before: 120, after: 120 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: style.pageSize === "Letter" ? 12240 : 11906,
              height: style.pageSize === "Letter" ? 15840 : 16838,
            },
            margin: {
              top: mmToTwips(style.margins.top),
              right: mmToTwips(style.margins.right),
              bottom: mmToTwips(style.margins.bottom),
              left: mmToTwips(style.margins.left),
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
