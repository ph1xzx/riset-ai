import JSZip from "jszip";
import { DEFAULT_CAMPUS_STYLE } from "./research";

type CampusStyle = typeof DEFAULT_CAMPUS_STYLE;

function twipsToCm(twips: number): number {
  // 1 inch = 1440 twips = 2.54 cm
  return Math.round(((twips / 1440) * 2.54) * 10) / 10;
}

function halfPointsToPt(hp: number): number {
  return hp / 2;
}

function lineSpacingFrom(xml: string): number | null {
  const m = xml.match(/<w:spacing[^>]*w:line="(\d+)"/);
  if (!m) return null;
  const line = Number(m[1]);
  const r = Math.round((line / 240) * 100) / 100;
  if (r >= 1.95) return 2;
  if (r >= 1.45) return 1.5;
  if (r >= 1.15) return 1.15;
  return 1;
}

/**
 * Ekstrak format kampus dari DOCX pedoman lama:
 * - margin & ukuran halaman: w:sectPr/w:pgMar (ambil sectPr TERAKHIR = properti dokumen)
 * - font, ukuran, spasi: gaya Normal dulu (paling mencerminkan template),
 *   fallback ke w:docDefaults.
 */
export async function extractCampusStyle(buffer: Buffer): Promise<CampusStyle> {
  const style: CampusStyle = JSON.parse(JSON.stringify(DEFAULT_CAMPUS_STYLE));
  try {
    const zip = await JSZip.loadAsync(buffer);

    const docXml = (await zip.file("word/document.xml")?.async("text")) ?? "";
    const stylesXml = (await zip.file("word/styles.xml")?.async("text")) ?? "";

    // ---- margins: sectPr terakhir (properti body dokumen)
    const sectPrs = docXml.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/g) ?? [];
    const sectPr = sectPrs[sectPrs.length - 1] ?? "";
    const pgMar = sectPr.match(/<w:pgMar[^>]*\/?>/)?.[0] ?? "";
    const mar = (name: string) => {
      const v = pgMar.match(new RegExp(`w:${name}="(-?\\d+)"`));
      return v ? Number(v[1]) : null;
    };
    const mt = mar("top"), ml = mar("left"), mb = mar("bottom"), mr = mar("right");
    if (mt != null) style.margins.top = twipsToCm(mt);
    if (ml != null) style.margins.left = twipsToCm(ml);
    if (mb != null) style.margins.bottom = twipsToCm(mb);
    if (mr != null) style.margins.right = twipsToCm(mr);

    // page size
    const pgSz = sectPr.match(/<w:pgSz[^>]*\/?>/)?.[0] ?? "";
    const wW = pgSz.match(/w:w="(\d+)"/)?.[1];
    const wH = pgSz.match(/w:h="(\d+)"/)?.[1];
    if (wW && wH) {
      const wcm = twipsToCm(Number(wW));
      style.pageSize = wcm >= 21.5 ? "Letter" : "A4";
    }

    // ---- gaya Normal (utama) → docDefaults (fallback)
    const normalStyle =
      stylesXml.match(/<w:style [^>]*w:styleId="Normal"[^>]*>[\s\S]*?<\/w:style>/)?.[0] ?? "";
    const docDefaults = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/)?.[0] ?? "";

    const fontFrom = (xml: string) => xml.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/)?.[1] ?? null;
    const szFrom = (xml: string) => {
      const v = xml.match(/<w:sz w:val="(\d+)"\/>/);
      return v ? halfPointsToPt(Number(v[1])) : null;
    };

    // font: Normal → docDefaults → style mana pun
    const f1 = fontFrom(normalStyle);
    const f2 = fontFrom(docDefaults);
    const f3 = stylesXml.match(/<w:rFonts[^>]*w:ascii="([^"]+)"/)?.[1];
    if (f1) style.body.font = f1;
    else if (f2) style.body.font = f2;
    else if (f3) style.body.font = f3;

    // ukuran: Normal → docDefaults
    const s1 = szFrom(normalStyle);
    const s2 = szFrom(docDefaults);
    if (s1) style.body.size = s1;
    else if (s2) style.body.size = s2;

    // spasi: Normal → docDefaults
    const ls1 = lineSpacingFrom(normalStyle);
    const ls2 = lineSpacingFrom(docDefaults);
    if (ls1) style.body.lineSpacing = ls1;
    else if (ls2) style.body.lineSpacing = ls2;
  } catch (e) {
    console.warn("extractCampusStyle failed, using defaults:", (e as Error).message);
  }
  return style;
}
