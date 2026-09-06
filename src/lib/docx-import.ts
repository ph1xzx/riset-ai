import * as mammoth from "mammoth";
import JSZip from "jszip";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { DEFAULT_CAMPUS_STYLE, CampusStyle, twipsToCm } from "./campus";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");

export interface ParsedHeading {
  title: string;
  level: number;
  content: string;
}

export interface ImportResult {
  sections: ParsedHeading[];
  campusStyle: CampusStyle;
  imageCount: number;
  title: string;
}

export function ensureStorage(): string {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
  return STORAGE_DIR;
}

/**
 * Parse an uploaded DOCX buffer into:
 *  - a flat list of sections (headings + their HTML content)
 *  - a detected campus style (margins, font, spacing) from the raw document XML
 *
 * This powers both "Mulai Proyek" (guideline import) and the dedicated /import page.
 */
export async function importDocx(buffer: Buffer, onImage?: (n: number) => void): Promise<ImportResult> {
  ensureStorage();
  let imageSeq = 0;

  const convertImage = mammoth.images.imgElement(async (image: any) => {
    if (!/^image\//.test(image.contentType)) return { src: "" };
    const ext = image.contentType.includes("png")
      ? "png"
      : image.contentType.includes("gif")
      ? "gif"
      : image.contentType.includes("webp")
      ? "webp"
      : "jpg";
    const b64: string = await image.read("base64");
    const fileName = `import-${Date.now()}-${imageSeq++}.${ext}`;
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
    fs.writeFileSync(path.join(STORAGE_DIR, fileName), Buffer.from(b64, "base64"));
    onImage?.(imageSeq);
    return { src: `/files/${fileName}` };
  });

  const styleMap = [
    "p[style-name='Title'] => h1:fresh",
    "p[style-name='Heading 1'] => h1:fresh",
    "p[style-name='Heading 2'] => h2:fresh",
    "p[style-name='Heading 3'] => h3:fresh",
    "p[style-name='Heading 4'] => h4:fresh",
    "p[style-name='Subtitle'] => p",
  ].join("; ");

  const result = await mammoth.convertToHtml(
    { buffer },
    { styleMap, convertImage }
  );
  const html: string = result.value;
  const messages: any[] = result.messages || [];

  const sections = splitIntoSections(html);
  const campusStyle = await detectCampusStyle(buffer, sections);

  // Best-effort title from the cover / first body heading
  const title = guessTitle(sections);

  return { sections, campusStyle, imageCount: imageSeq, title, messages: messages } as ImportResult;
}

/** Split flat HTML into sections at h1–h4 boundaries. */
export function splitIntoSections(html: string): ParsedHeading[] {
  const $ = cheerio.load(html, null, false);
  const sections: ParsedHeading[] = [];
  let current: { title: string; level: number; html: string[] } | null = null;

  const flush = () => {
    if (current) {
      const content = current.html.join("");
      sections.push({ title: current.title, level: current.level, content });
    }
    current = null;
  };

  // A heading starts a new section only if it plausibly is structure:
  //  - h1/h2 always, or
  //  - h3/h4 with a numbered title (1.2, 2.1.1, …).
  // Unnumbered deep headings (e.g. the literal "BAB II LANDASAN TEORI" lines
  // inside a "Sistematika Penulisan" section, which Word styles as headings)
  // are kept as content — otherwise a roundtrip swallows real sections.
  const isNumbered = (t: string) => /^\d+(\.\d+)*/.test(t.trim());
  const BAB_LABEL = /^BAB\s+[IVX0-9]+\.?$/i;

  // Fragment mode: the top-level content elements are children of the root.
  const kids: any[] = $.root().children().get();
  for (const child of kids) {
    const tag = child.name;
    if (tag && /^h[1-4]$/.test(tag)) {
      const level = Number(tag[1]);
      const title = $(child).text().trim();
      const isBoundary = level <= 2 || isNumbered(title);
      if (!isBoundary) {
        if (current) current.html.push($.html(child));
        continue;
      }
      // Merge split chapter labels: "BAB I" + "PENDAHULUAN" as two headings.
      if (
        current &&
        current.level === level &&
        BAB_LABEL.test(current.title) &&
        current.html.every((h) => !h.trim())
      ) {
        current.title = `${current.title} ${title}`;
        continue;
      }
      flush();
      current = { title: title || `Section ${sections.length + 1}`, level, html: [] };
    } else if (current) {
      current.html.push($.html(child));
    } else if (tag) {
      // content before the first heading -> a "front" section (cover etc.)
      current = { title: "(Bagian awal)", level: 1, html: [$.html(child)] };
    }
  }
  flush();

  // Drop trailing empty sections but keep at least one
  const cleaned = sections.filter((s) => s.content.trim().length > 0 || s.title !== "(Bagian awal)");
  return cleaned.length ? cleaned : [{ title: "BAB I PENDAHULUAN", level: 1, content: "" }];
}

/** Detect campus formatting from the raw .docx (OOXML) structure. */
export async function detectCampusStyle(buffer: Buffer, sections: ParsedHeading[]): Promise<CampusStyle> {
  const base = structuredClone(DEFAULT_CAMPUS_STYLE);
  try {
    const zip = await JSZip.loadAsync(buffer);

    // 1) Page margins from the first sectPr in document.xml
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (docXml) {
      const $ = cheerio.load(docXml, { xmlMode: true });
      const sectPr = $("w:sectPr").first();
      const pgMar = sectPr.find("w:pgMar").first() || $("w:pgMar").first();
      if (pgMar.length) {
        const attr = (n: string) => pgMar.attr(n);
        const top = twipsToCm(num(attr("w:top")));
        const right = twipsToCm(num(attr("w:right")));
        const bottom = twipsToCm(num(attr("w:bottom")));
        const left = twipsToCm(num(attr("w:left")));
        if (top > 1 && top < 6) base.margins.top = round1(top);
        if (right > 1 && right < 6) base.margins.right = round1(right);
        if (bottom > 1 && bottom < 6) base.margins.bottom = round1(bottom);
        if (left > 1 && left < 7) base.margins.left = round1(left);
      }
      // Page size
      const pgSz = sectPr.find("w:pgSz").first();
      const w = num(pgSz.attr("w:w"));
      const h = num(pgSz.attr("w:h"));
      if (w && h) base.pageSize = Math.abs(w - 11906) < 200 ? "Letter" : "A4"; // A4 w=11906 twips
    }

    // 2) Body defaults from styles.xml
    const stylesXml = await zip.file("word/styles.xml")?.async("string");
    if (stylesXml) {
      const $ = cheerio.load(stylesXml, { xmlMode: true });
      // docDefaults
      const docDefaultsFont = $("w:docDefaults w:rPrDefault w:rPr w:rFonts").first();
      const ascii = docDefaultsFont.attr("w:ascii") || docDefaultsFont.attr("w:hAnsi");
      if (ascii) base.body.font = cleanFont(ascii);
      const docDefaultsSz = num($("w:docDefaults w:rPrDefault w:rPr w:sz").attr("w:val"));
      if (docDefaultsSz >= 16 && docDefaultsSz <= 48) base.body.size = docDefaultsSz / 2;

      // Normal paragraph default line spacing
      const normal = $('w:style[w:styleId="Normal"]');
      const spacing = normal.find("w:spacing").first();
      const line = num(spacing.attr("w:line"));
      if (line && line >= 240) {
        const factor = line / 240;
        base.body.lineSpacing = factor >= 2.5 ? 2 : factor >= 1.4 ? 1.5 : 1;
      }
      const ind = normal.find("w:ind").first();
      const firstLine = num(ind.attr("w:firstLine")) || num(ind.attr("w:firstLineChars"));
      if (firstLine) {
        // firstLineChars is in 1/100 char units; firstLine is in twips
        base.body.firstLineIndentMm =
          ind.attr("w:firstLineChars")
            ? round1((num(ind.attr("w:firstLineChars")) / 100) * 2.2)
            : round1((firstLine / 1440) * 25.4 / 10);
      }

      // Heading 1 style: bold/uppercase/center
      const h1 = $('w:style[w:styleId="Heading1"]');
      if (h1.length) {
        base.heading1.bold = h1.find("w:b").length > 0 || h1.find("w:bCs").length > 0;
        const jc = h1.find("w:jc").first();
        base.heading1.centered = jc.attr("w:val") === "center";
        const h1sz = num(h1.find("w:sz").attr("w:val"));
        if (h1sz >= 16 && h1sz <= 48) base.heading1.size = h1sz / 2;
      }
    }

    // 3) Heuristics from actual heading text (uppercase BAB titles)
    const h1titles = sections.filter((s) => s.level === 1).slice(0, 6).map((s) => s.title.toUpperCase());
    const upperCount = h1titles.filter((t) => t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t)).length;
    if (h1titles.length >= 2 && upperCount >= Math.ceil(h1titles.length / 2)) {
      base.heading1.uppercase = true;
      base.heading1.centered = true;
    }
  } catch {
    /* detection is best-effort; fall back to defaults */
  }
  return base;
}

function guessTitle(sections: ParsedHeading[]): string {
  // 1) Prefer the cover title: first long line of the front-matter section.
  const front = sections.find((s) => s.title === "(Bagian awal)");
  if (front) {
    const $ = cheerio.load(front.content, null, false);
    for (const el of $.root().children().get() as any[]) {
      const t = $(el).text().trim();
      if (t.length >= 12 && !/^(LEMBAR|PERNYATAAN|ABSTRAK|KATA|DAFTAR|HALAMAN|UNIVERSITAS|FAKULTAS)/i.test(t)) {
        return t.slice(0, 150);
      }
    }
  }
  // 2) First real body heading (not front-matter placeholders).
  for (const s of sections) {
    if (s.title !== "(Bagian awal)" && s.title.length >= 8 && !/^(BAB|LEMBAR|DAFTAR|ABSTRAK|KATA)/i.test(s.title)) {
      return s.title;
    }
  }
  const first = sections[0];
  return first && first.title !== "(Bagian awal)" ? first.title : "Dokumen impor";
}

function num(v: string | undefined | null): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function cleanFont(f: string): string {
  return f.replace(/[^A-Za-z ]/g, "").trim() || "Times New Roman";
}
