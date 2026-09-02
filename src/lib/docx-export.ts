// Ekspor proyek → DOCX asli dengan campus style + gambar (base64 → ImageRun).
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertMillimetersToTwip,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  Header,
  Footer,
  PageNumber,
  NumberFormat,
} from "docx";
import { prisma } from "./db";
import { fetchFileBytes } from "./storage";
import { DEFAULT_CAMPUS_STYLE } from "./research";
import { parseJsonObject, stripHtml } from "./json";
import { renderBibliographyEntry, toSourceRef, type SourceRef } from "./citations";

type CampusStyle = typeof DEFAULT_CAMPUS_STYLE;

/* ---------- deteksi dimensi gambar dari base64 (PNG/JPEG/GIF/BMP) ---------- */
function imageDimensions(data: Buffer): { w: number; h: number } | null {
  try {
    // PNG: offset 16 (IHDR)
    if (data[0] === 0x89 && data[1] === 0x50) {
      return { w: data.readUInt32BE(16), h: data.readUInt32BE(20) };
    }
    // GIF
    if (data[0] === 0x47 && data[1] === 0x49) {
      return { w: data.readUInt16LE(6), h: data.readUInt16LE(8) };
    }
    // BMP
    if (data[0] === 0x42 && data[1] === 0x4d) {
      return { w: data.readUInt32LE(18), h: Math.abs(data.readInt32LE(22)) };
    }
    // JPEG: cari SOF0/SOF2
    if (data[0] === 0xff && data[1] === 0xd8) {
      let off = 2;
      while (off < data.length - 9) {
        if (data[off] !== 0xff) {
          off++;
          continue;
        }
        const marker = data[off + 1];
        if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
          return { w: data.readUInt16BE(off + 7), h: data.readUInt16BE(off + 5) };
        }
        off += 2 + data.readUInt16BE(off + 2);
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function dataUriToRun(
  src: string,
  maxW = 460,
  maxH = 460
): ImageRun | null {
  const m = src.match(/^data:(image\/(png|jpeg|jpg|gif|bmp));base64,(.+)$/);
  if (!m) return null;
  const buf = Buffer.from(m[3], "base64");
  if (!buf.length) return null;
  const dim = imageDimensions(buf) ?? { w: maxW, h: maxW };
  const scale = Math.min(maxW / dim.w, maxH / dim.h, 1);
  return new ImageRun({
    data: buf,
    transformation: {
      width: Math.max(50, Math.round(dim.w * scale)),
      height: Math.max(50, Math.round(dim.h * scale)),
    },
  });
}

// Gambar apa pun (data-URI / URL lokal / URL web) → ImageRun (null jika gagal).
async function imgToRun(src: string, maxW = 460, maxH = 460): Promise<ImageRun | null> {
  try {
    let buf: Buffer;
    if (src.startsWith("data:")) {
      const m = src.match(/^data:image\/[a-z+.-]+;base64,(.+)$/);
      if (!m) return null;
      buf = Buffer.from(m[1], "base64");
    } else if (/^https?:\/\//i.test(src) || src.startsWith("/api/uploads/")) {
      buf = await fetchFileBytes(src);
    } else {
      return null;
    }
    if (!buf.length) return null;
    const dim = imageDimensions(buf) ?? { w: maxW, h: maxW };
    const scale = Math.min(maxW / dim.w, maxH / dim.h, 1);
    return new ImageRun({
      data: buf,
      transformation: {
        width: Math.max(50, Math.round(dim.w * scale)),
        height: Math.max(50, Math.round(dim.h * scale)),
      },
    });
  } catch {
    return null;
  }
}

/* ---------- HTML sederhana → children docx ---------- */
function htmlToRuns(html: string, size: number, font: string): TextRun[] {
  const runs: TextRun[] = [];
  const re = /<[^>]+>|[^<]+/g;
  let m: RegExpExecArray | null;
  let bold = false;
  let italic = false;
  let underline = false;
  while ((m = re.exec(html)) !== null) {
    const tok = m[0];
    if (tok === "<b>" || tok === "<strong>") { bold = true; continue; }
    if (tok === "</b>" || tok === "</strong>") { bold = false; continue; }
    if (tok === "<i>" || tok === "<em>") { italic = true; continue; }
    if (tok === "</i>" || tok === "</em>") { italic = false; continue; }
    if (tok === "<u>") { underline = true; continue; }
    if (tok === "</u>") { underline = false; continue; }
    if (tok === "<br>" || tok === "<br/>") { runs.push(new TextRun({ text: "", break: 1, font })); continue; }
    if (tok.startsWith("<")) continue;
    const text = tok
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, "&");
    runs.push(new TextRun({ text, bold, italics: italic, underline: underline ? {} : undefined, font, size: size * 2 }));
  }
  return runs.length ? runs : [new TextRun({ text: "", font })];
}

type Block = Paragraph | Table;

/* ---- nested-aware: scan tag berpasangan (ul/ol/li) sampai penutup seimbang ---- */
const LIST_OPEN = /<(?:ul|ol)\b[^>]*>/i;
const LIST_CLOSE = /<\/(?:ul|ol)\s*>/i;
const LI_OPEN = /<li\b[^>]*>/i;
const LI_CLOSE = /<\/li\s*>/i;

function scanBalanced(
  src: string,
  openRe: RegExp,
  closeRe: RegExp,
  from: number
): { closeStart: number; end: number } {
  const re = new RegExp(`${openRe.source}|${closeRe.source}`, "gi");
  re.lastIndex = from;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (/^\s*<\//.test(m[0])) {
      depth -= 1;
      if (depth === 0) return { closeStart: m.index, end: re.lastIndex };
    } else depth += 1;
  }
  return { closeStart: src.length, end: src.length };
}

/** Rekursi list bersarang → paragraf ber-indent + bullet/number per level. */
function listToBlocks(
  listHtml: string,
  depth: number,
  style: CampusStyle,
  bodySpacing: { line: number; after: number },
  out: Block[]
) {
  const ordered = /^\s*<ol/i.test(listHtml);
  const inner = listHtml.replace(/^\s*<(?:ul|ol)\b[^>]*>/i, "").replace(/<\/(?:ul|ol)\s*>\s*$/i, "");
  const liRe = /<li\b[^>]*>/gi;
  let counter = 0;
  let lm: RegExpExecArray | null;
  while ((lm = liRe.exec(inner)) !== null) {
    const before = inner.slice(0, lm.index);
    const depthHere =
      (before.match(/<(?:ul|ol)\b[^>]*>/gi) || []).length -
      (before.match(/<\/(?:ul|ol)\s*>/gi) || []).length;
    if (depthHere !== 0) continue; // item anak — diproses oleh rekursi induknya
    const { closeStart, end } = scanBalanced(inner, LI_OPEN, LI_CLOSE, lm.index);
    const content = inner.slice(lm.index + lm[0].length, closeStart);
    // pisahkan teks milik item dari nested list di dalamnya
    let own = "";
    const nested: string[] = [];
    const lsRe = /<(?:ul|ol)\b[^>]*>/gi;
    let sm: RegExpExecArray | null;
    let i = 0;
    while ((sm = lsRe.exec(content)) !== null) {
      if (sm.index < i) continue;
      const reg = scanBalanced(content, LIST_OPEN, LIST_CLOSE, sm.index);
      own += content.slice(i, sm.index);
      nested.push(content.slice(sm.index, reg.end));
      i = reg.end;
      lsRe.lastIndex = reg.end;
    }
    own += content.slice(i);
    counter += 1;
    const prefix = ordered ? `${counter}. ` : depth === 0 ? "• " : "◦ ";
    if (own.replace(/<[^>]+>/g, "").trim() || !nested.length) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: bodySpacing,
          indent: { left: convertMillimetersToTwip(10 + depth * 8) },
          children: [
            new TextRun({ text: prefix, font: style.body.font, size: style.body.size * 2 }),
            ...htmlToRuns(own, style.body.size, style.body.font),
          ],
        })
      );
    }
    for (const n of nested) listToBlocks(n, depth + 1, style, bodySpacing, out);
    liRe.lastIndex = end;
  }
}

async function htmlToChildren(html: string, style: CampusStyle): Promise<Block[]> {
  const out: Block[] = [];
  const bodySpacing = {
    line: Math.round(style.body.lineSpacing * 240),
    after: style.body.spacingAfterPt !== undefined ? Math.round(style.body.spacingAfterPt * 20) : 120,
  };
  const blockRe =
    /<table[\s\S]*?<\/table>|<blockquote[\s\S]*?<\/blockquote>|<h3[^>]*>[\s\S]*?<\/h3>|<p\b[^>]*>[\s\S]*?<\/p>|<li\b[^>]*>[\s\S]*?<\/li>|<ol\b[^>]*>|<ul\b[^>]*>|<\/ol>|<\/ul>|<img\b[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const blk = m[0];
    if (/^<table/i.test(blk)) {
      const rows: TableRow[] = [];
      const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let trm: RegExpExecArray | null;
      while ((trm = trRe.exec(blk)) !== null) {
        const cells: TableCell[] = [];
        const tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let tdm: RegExpExecArray | null;
        while ((tdm = tdRe.exec(trm[1])) !== null) {
          cells.push(
            new TableCell({
              children: [
                new Paragraph({
                  spacing: { after: 40 },
                  children: htmlToRuns(tdm[1], style.body.size, style.body.font),
                }),
              ],
            })
          );
        }
        if (cells.length) rows.push(new TableRow({ children: cells }));
      }
      if (rows.length) out.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }));
      continue;
    }
    if (/^<h3/i.test(blk)) {
      const inner = blk.replace(/^<h3[^>]*>/i, "").replace(/<\/h3>$/i, "");
      // heading 3 eksplisit: hitam, rata margin kiri, indent 0 (pedoman: bukan tangga)
      out.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 160, after: 80 },
          indent: { left: 0, firstLine: 0 },
          children: htmlToRuns(inner, style.heading3?.size ?? style.body.size, style.body.font),
        })
      );
      continue;
    }
    if (/^<blockquote/i.test(blk)) {
      const inner = blk
        .replace(/<\/?blockquote[^>]*>/gi, "")
        .replace(/<\/?p[^>]*>/gi, " ");
      out.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: bodySpacing,
          indent: { left: convertMillimetersToTwip(10), right: convertMillimetersToTwip(10) },
          children: htmlToRuns(`<em>${inner}</em>`, style.body.size, style.body.font),
        })
      );
      continue;
    }
    if (/^<(?:ul|ol)\b/i.test(blk)) {
      // proses list utuh (nested-aware) sekaligus, lalu lompati region-nya
      const region = scanBalanced(html, LIST_OPEN, LIST_CLOSE, m.index);
      listToBlocks(html.slice(m.index, region.end), 0, style, bodySpacing, out);
      blockRe.lastIndex = region.end;
      continue;
    }
    if (/^<\/(?:ol|ul)\s*>|^<li\b/i.test(blk)) continue; // fragmen sisa — list sudah diproses utuh
    if (/^<img/i.test(blk)) {
      const src = blk.match(/src="([^"]+)"/i)?.[1];
      if (src) {
        const run = await imgToRun(src);
        if (run) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: bodySpacing, children: [run] }));
      }
      continue;
    }
    // <p>…</p>
    const inner = blk.replace(/^<p\b[^>]*>/i, "").replace(/<\/p>$/i, "");
    const imgRe2 = /<img\b[^>]*src="([^"]+)"[^>]*>/gi;
    let im: RegExpExecArray | null;
    while ((im = imgRe2.exec(inner)) !== null) {
      const run = await imgToRun(im[1]);
      if (run) out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: bodySpacing, children: [run] }));
    }
    const textHtml = inner.replace(/<img\b[^>]*>/gi, "");
    if (stripHtml(textHtml).length > 0) {
      out.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: bodySpacing,
          indent: { firstLine: convertMillimetersToTwip(style.body.firstLineIndentMm ?? 12.7) },
          children: htmlToRuns(textHtml, style.body.size, style.body.font),
        })
      );
    }
  }
  if (!out.length && stripHtml(html).length > 0) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        spacing: bodySpacing,
        children: htmlToRuns(html, style.body.size, style.body.font),
      })
    );
  }
  return out.length ? out : [new Paragraph({ children: [] })];
}

export async function exportProjectToDocx(projectId: string): Promise<{ buffer: Buffer; filename: string }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      sections: { orderBy: { order: "asc" } },
      sources: true,
      usages: true,
    },
  });
  if (!project) throw new Error("Proyek tidak ditemukan");

  const style: CampusStyle = { ...DEFAULT_CAMPUS_STYLE, ...parseJsonObject(project.campusStyle, {}) } as CampusStyle;
  const mm = (cm: number) => convertMillimetersToTwip(cm * 10);

  // daftar pustaka: urutan CitationUsage + sisanya
  const sourceById = new Map(project.sources.map((s) => [s.id, s]));
  const orderedSourceIds: string[] = [];
  for (const u of project.usages) if (!orderedSourceIds.includes(u.sourceId)) orderedSourceIds.push(u.sourceId);
  for (const s of project.sources) if (!orderedSourceIds.includes(s.id)) orderedSourceIds.push(s.id);
  const refs: (SourceRef & { ordinal: number })[] = orderedSourceIds
    .map((id) => sourceById.get(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .map((s, i) => ({ ...toSourceRef(s), ordinal: i + 1 }));

  /* ---------- penomoran halaman standar skripsi ----------
     - Front matter (sebelum BAB I): romawi kecil (i, ii, iii…), nomor di BAWAH TENGAH.
     - Isi (BAB I dst.): arab, mulai 1; halaman PERTAMA tiap bab nomor di BAWAH TENGAH,
       halaman selanjutnya di POJOK KANAN ATAS (header).
     Diimplementasikan sebagai multi-section Word: tiap bab = section baru dengan
     titlePage (first-page header/footer berbeda). */
  const pageBase = {
    size: {
      width: style.pageSize === "Letter" ? 12240 : 11906,
      height: style.pageSize === "Letter" ? 15840 : 16838,
    },
    margin: {
      top: mm(style.margins.top),
      bottom: mm(style.margins.bottom),
      left: mm(style.margins.left),
      right: mm(style.margins.right),
    },
  };
  const numRun = () =>
    new TextRun({ children: [PageNumber.CURRENT], font: style.body.font, size: style.body.size * 2 });
  const frontFooter = new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [numRun()] })],
  });
  const bodyHeader = new Header({
    children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [numRun()] })],
  });
  const bodyFirstFooter = new Footer({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [numRun()] })],
  });
  const emptyHeadFoot = (kind: "h" | "f") =>
    kind === "h"
      ? new Header({ children: [new Paragraph({ children: [] })] })
      : new Footer({ children: [new Paragraph({ children: [] })] });

  const groups: { babStart: boolean; blocks: Block[] }[] = [{ babStart: false, blocks: [] }];

  // Cover sederhana — hanya untuk proyek yang TIDAK diimpor (impor punya cover sendiri
  // di section "(Bagian awal)"; cover sintetis bikin judul dobel)
  const hasImportedCover = (project.sections[0]?.title || "") === "(Bagian awal)";
  if (!hasImportedCover) {
    groups[0].blocks.push(
      new Paragraph({
        spacing: { before: 3000 },
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: project.title.toUpperCase(), bold: true, size: style.body.size * 2, font: style.body.font })],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `${project.type} — ${project.method || "Metode belum diset"}`, size: style.body.size * 2, font: style.body.font })],
      }),
      new Paragraph({ children: [], pageBreakBefore: true })
    );
  }

  for (const sec of project.sections) {
    const isH1 = sec.level === 1;
    // bab baru / daftar pustaka / lampiran = section Word baru (reset aturan nomor)
    const isBabStart = isH1 && /^(bab\s|daftar pustaka|lampiran)/i.test(sec.title);
    if (isBabStart) groups.push({ babStart: true, blocks: [] });
    const g = groups[groups.length - 1];
    if (sec.title !== "(Bagian awal)") {
      // kapital hanya untuk judul bab (heading1.uppercase); sub-bab dibiarkan
      // sesuai dokumen asli ("1.1 Latar Belakang", bukan "1.1 LATAR BELAKANG")
      const titleText = isH1 && style.heading1.uppercase ? sec.title.toUpperCase() : sec.title;
      g.blocks.push(
        new Paragraph({
          heading: isH1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          alignment: isH1 ? (style.heading1.centered ? AlignmentType.CENTER : AlignmentType.LEFT) : AlignmentType.LEFT,
          spacing: { before: isH1 ? 240 : 160, after: 120 },
          indent: { left: 0, firstLine: 0 }, // heading selalu di margin kiri, tanpa indentasi
          // halaman baru untuk tiap bab, kecuali yang pertama di group (section break
          // Word sudah memisah halaman)
          pageBreakBefore: isH1 && g.blocks.length > 0,
          children: [
            new TextRun({
              text: titleText,
              bold: true,
              size: (isH1 ? style.heading1.size : style.heading2.size) * 2,
              font: style.body.font,
            }),
          ],
        })
      );
    }
    const content = sec.content.replace(/\[\[SOURCE_[A-Za-z0-9]+\]\]/g, "");
    g.blocks.push(...(await htmlToChildren(content, style)));
  }

  // Daftar pustaka → group body sendiri (nomor arab lanjutan, halaman pertama bawah-tengah)
  if (refs.length) {
    const g: Block[] = [
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "DAFTAR PUSTAKA", bold: true, size: style.body.size * 2, font: style.body.font })],
      }),
    ];
    for (const r of refs) {
      const hang = convertMillimetersToTwip(style.references?.hangingIndentMm ?? 12.7);
      g.push(
        new Paragraph({
          alignment: AlignmentType.JUSTIFIED,
          spacing: { line: Math.round((style.references?.lineSpacing ?? 1) * 240), after: 120 },
          indent: { left: hang, hanging: hang }, // daftar pustaka: hanging indent
          children: [new TextRun({ text: renderBibliographyEntry(r, project.citationStyle, r.ordinal), size: style.body.size * 2, font: style.body.font })],
        })
      );
    }
    groups.push({ babStart: true, blocks: g });
  }

  // ---------- rakit section Word ----------
  let bodyIdx = 0;
  const docSections = groups
    .filter((g) => g.blocks.length > 0)
    .map((g) => {
      if (!g.babStart) {
        // FRONT MATTER: romawi kecil, nomor bawah tengah; halaman pertama (cover)
        // tetap dihitung "i" tapi nomornya tidak dicetak (titlePage)
        return {
          properties: {
            titlePage: true,
            page: { ...pageBase, pageNumbers: { start: 1, formatType: NumberFormat.LOWER_ROMAN } },
          },
          footers: { default: frontFooter, first: emptyHeadFoot("f") },
          children: g.blocks,
        };
      }
      bodyIdx++;
      // ISI: arab; first-page (hal. pertama bab) nomor bawah tengah;
      // halaman lain nomor kanan atas via header
      return {
        properties: {
          titlePage: true,
          page: { ...pageBase, ...(bodyIdx === 1 ? { pageNumbers: { start: 1 } } : {}) },
        },
        headers: { default: bodyHeader, first: emptyHeadFoot("h") },
        footers: { first: bodyFirstFooter, default: emptyHeadFoot("f") },
        children: g.blocks,
      };
    });

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: style.body.font, size: style.body.size * 2 } },
      },
    },
    sections: docSections,
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "skripsi"}.docx`;
  return { buffer, filename };
}
