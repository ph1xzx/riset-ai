/**
 * Campus style: the formatting rules of a university's thesis guideline
 * (pedoman). Mirrors the original app's `campusStyle` JSON shape.
 */
export interface Margins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface CampusStyle {
  pageSize: "A4" | "Letter";
  margins: Margins;
  body: {
    font: string;
    size: number;
    lineSpacing: number;
    firstLineIndentMm: number;
    spacingAfterPt: number;
    justify?: boolean;
  };
  heading1: {
    bold: boolean;
    uppercase: boolean;
    centered: boolean;
    size: number;
    pageBreakBefore: boolean;
  };
  heading2: { bold: boolean; size: number; flushLeft: boolean };
  heading3: { bold: boolean; size: number; flushLeft: boolean };
  references: { lineSpacing: number; hangingIndentMm: number };
  citationStyle?: string;
  pageNumbering?: { front: "lowerRoman" | "arabic"; body: "arabic" | "lowerRoman" };
  frontMatter?: string[];
}

export const DEFAULT_CAMPUS_STYLE: CampusStyle = {
  pageSize: "A4",
  margins: { top: 3, right: 3, bottom: 3, left: 4 },
  body: {
    font: "Times New Roman",
    size: 12,
    lineSpacing: 1.5,
    firstLineIndentMm: 12.7,
    spacingAfterPt: 6,
    justify: true,
  },
  heading1: { bold: true, uppercase: true, centered: true, size: 12, pageBreakBefore: true },
  heading2: { bold: true, size: 12, flushLeft: true },
  heading3: { bold: false, size: 12, flushLeft: true },
  references: { lineSpacing: 1, hangingIndentMm: 12.7 },
  citationStyle: "APA7",
  pageNumbering: { front: "lowerRoman", body: "arabic" },
  frontMatter: [],
};

/** The default skripsi structure used when no structure is provided. */
export const DEFAULT_STRUCTURE: { title: string; level: number }[] = [
  { title: "BAB I PENDAHULUAN", level: 1 },
  { title: "1.1 Latar Belakang", level: 2 },
  { title: "1.2 Identifikasi Masalah", level: 2 },
  { title: "1.3 Rumusan Masalah", level: 2 },
  { title: "1.4 Batasan Masalah", level: 2 },
  { title: "1.5 Tujuan Penelitian", level: 2 },
  { title: "1.6 Manfaat Penelitian", level: 2 },
  { title: "1.7 Sistematika Penulisan", level: 2 },
  { title: "BAB II LANDASAN TEORI", level: 1 },
  { title: "BAB III METODOLOGI PENELITIAN", level: 1 },
  { title: "BAB IV HASIL DAN PEMBAHASAN", level: 1 },
  { title: "BAB V PENUTUP", level: 1 },
  { title: "DAFTAR PUSTAKA", level: 1 },
];

export function parseCampusStyle(raw: string | null | undefined): CampusStyle {
  if (!raw) return structuredClone(DEFAULT_CAMPUS_STYLE);
  try {
    const obj = JSON.parse(raw);
    return mergeStyle(DEFAULT_CAMPUS_STYLE, obj);
  } catch {
    return structuredClone(DEFAULT_CAMPUS_STYLE);
  }
}

function mergeStyle(def: CampusStyle, partial: any): CampusStyle {
  if (!partial || typeof partial !== "object") return structuredClone(def);
  const out = structuredClone(def);
  for (const k of Object.keys(partial) as (keyof CampusStyle)[]) {
    const v = partial[k];
    if (v == null) continue;
    if (k === "margins" || k === "body" || k === "heading1" || k === "heading2" || k === "heading3" || k === "references" || k === "pageNumbering") {
      (out[k] as any) = { ...(out[k] as any), ...(typeof v === "object" ? v : {}) };
    } else if (Array.isArray(v) || typeof v === "string" || typeof v === "number") {
      (out as any)[k] = v;
    }
  }
  return out;
}

/** TWIP conversion helpers (docx uses twips: 1 inch = 1440 twips). */
export const twipsToCm = (tw: number) => (tw / 1440) * 2.54;
export const mmToTwips = (mm: number) => Math.round((mm / 2.54) * 1440);
