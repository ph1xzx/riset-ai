import type { TemplateConfig } from "./template-parser";
import { baseConfig } from "./template-parser";

/**
 * SARAN TEMPLATE BAWAAN — data contoh gaya pedoman yang umum dipakai.
 * Semua preset bisa dipakai langsung ATAU disesuaikan per-aturan di editor.
 */

export type Preset = {
  id: string;
  name: string;
  prodi: string;
  university: string;
  description: string;
  config: TemplateConfig;
};

function cfg(over: {
  margins?: Partial<TemplateConfig["margins"]>;
  body?: Partial<TemplateConfig["body"]>;
  heading1?: Partial<TemplateConfig["heading1"]>;
  heading2?: Partial<TemplateConfig["heading2"]>;
  heading3?: Partial<TemplateConfig["heading3"]>;
  references?: Partial<TemplateConfig["references"]>;
  citationStyle?: string;
  front?: "lowerRoman" | "arabic";
}): TemplateConfig {
  const b = baseConfig();
  return {
    ...b,
    margins: { ...b.margins, ...over.margins },
    body: { ...b.body, ...over.body },
    heading1: { ...b.heading1, ...over.heading1 },
    heading2: { ...b.heading2, ...over.heading2 },
    heading3: { ...b.heading3, ...over.heading3 },
    references: { ...b.references, ...over.references },
    citationStyle: over.citationStyle ?? b.citationStyle,
    pageNumbering: { ...b.pageNumbering, front: over.front ?? b.pageNumbering.front },
  };
}

export const TEMPLATE_PRESETS: Preset[] = [
  {
    id: "unpam-ti",
    name: "Pedoman Skripsi TI — UNPAM",
    prodi: "Teknik Informatika",
    university: "Universitas Pamulang",
    description:
      "Margin 4/4/3/3 cm • TNR 12pt • spasi 2 • after 0pt • indentasi 5 ketukan • BAB Romawi kapital center (halaman baru) • heading rata kiri • nomor awal Romawi • APA • pustaka hanging spasi 1.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { lineSpacing: 2, spacingAfterPt: 0, firstLineIndentMm: 12.7 },
      citationStyle: "APA7",
      references: { lineSpacing: 1, hangingIndentMm: 12.7 },
    }),
  },
  {
    id: "skripsi-umum",
    name: "Skripsi Umum Indonesia",
    prodi: "",
    university: "",
    description:
      "Gaya paling lazim: margin kiri 4 cm, lainnya 3 cm • TNR 12pt • spasi 2 • indentasi 1,27 cm • heading rata kiri • nomor awal Romawi • APA7.",
    config: cfg({
      margins: { top: 3, left: 4, right: 3, bottom: 3 },
      body: { lineSpacing: 2, spacingAfterPt: 6, firstLineIndentMm: 12.7 },
    }),
  },
  {
    id: "skripsi-spasi-15",
    name: "Skripsi Spasi 1,5 (hemat halaman)",
    prodi: "",
    university: "",
    description:
      "Untuk pedoman yang membolehkan spasi 1,5: margin 4/4/3/3 • TNR 12pt • spasi 1,5 • indentasi 1 cm • APA7.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { lineSpacing: 1.5, spacingAfterPt: 6, firstLineIndentMm: 10 },
    }),
  },
  {
    id: "laporan-ta",
    name: "Laporan TA / Magang (Arial 11)",
    prodi: "",
    university: "",
    description:
      "Gaya laporan teknis: margin 4/4/3/3 • Arial 11pt • spasi 1,5 • heading bold rata kiri • IEEE.",
    config: cfg({
      margins: { top: 4, left: 4, right: 3, bottom: 3 },
      body: { font: "Arial", size: 11, lineSpacing: 1.5, firstLineIndentMm: 10 },
      citationStyle: "IEEE",
    }),
  },
  {
    id: "jurnal-apa",
    name: "Artikel Jurnal (APA 7)",
    prodi: "",
    university: "",
    description:
      "Format manuskrip jurnal APA: margin 2,54 cm semua sisi • TNR 12pt • spasi 2 • tanpa indentasi bab khusus • APA7.",
    config: cfg({
      margins: { top: 2.5, left: 2.5, right: 2.5, bottom: 2.5 },
      body: { lineSpacing: 2, spacingAfterPt: 0, firstLineIndentMm: 12.7 },
      heading1: { centered: false, uppercase: false, pageBreakBefore: false },
      citationStyle: "APA7",
    }),
  },
];
