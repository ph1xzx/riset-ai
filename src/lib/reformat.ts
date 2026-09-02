/**
 * REFORMAT ISI DOKUMEN — menormalkan judul & konten section yang SUDAH ADA
 * agar mengikuti template pedoman: BAB pakai Romawi + kapital, nomor heading
 * tanpa titik setelah digit terakhir, heading/paragraf tanpa indentasi manual,
 * baris kosong manual (enter berlebih) dihapus.
 */

const ROMAN_MAP: [number, string][] = [
  [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
  [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
  [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
];

export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return String(n);
  let out = "";
  for (const [v, s] of ROMAN_MAP) while (n >= v) { out += s; n -= v; }
  return out;
}

/** Normalkan judul heading sesuai pedoman. */
export function normalizeHeadingTitle(title: string, level: number): string {
  let t = (title || "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  t = t.replace(/\.\s*$/, ""); // tidak boleh diakhiri titik
  if (level === 1) {
    const m = t.match(/^BAB\s+([0-9]+|[IVXLCDM]+)\s*(.*)$/i);
    if (m) {
      const roman = /^[0-9]+$/.test(m[1]) ? toRoman(Number(m[1])) : m[1].toUpperCase();
      t = `BAB ${roman} ${m[2]}`.trim();
    }
    t = t.toUpperCase(); // judul BAB kapital seluruhnya
  } else {
    // "3.1." / "3.1.1." → tanpa titik setelah nomor; spasi konsisten
    t = t.replace(/^(\d+(?:\.\d+)+)\.\s*(?=\S)/, "$1 ");
    t = t.replace(/^(\d+(?:\.\d+)+)\s+/, "$1 ");
    // kapital di awal kata sesudah nomor (atau awal judul tanpa nomor)
    t = t.replace(/^(\d+(?:\.\d+)+\s+)(\p{Ll})/u, (_m, n, c: string) => n + c.toUpperCase());
    t = t.charAt(0).toUpperCase() + t.slice(1);
  }
  return t;
}

/** Bersihkan konten HTML: heading di dalam konten + paragraf kosong manual. */
export function reformatContent(html: string): { html: string; changed: boolean } {
  let out = html || "";
  // h3/h4 di dalam konten: rapikan nomor, titik, &nbsp; di awal
  out = out.replace(/<h([3-6])([^>]*)>([\s\S]*?)<\/h\1>/gi, (_all, d, attrs, inner) => {
    let txt = inner.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
    txt = txt.replace(/\.\s*$/, "");
    txt = txt.replace(/^(\d+(?:\.\d+)+)\.\s*(?=\S)/, "$1 ");
    return `<h${d}${attrs}>${txt}</h${d}>`;
  });
  // hapus paragraf yang isinya cuma whitespace/&nbsp;/<br> (enter manual berlebih)
  out = out.replace(/<p[^>]*>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, "");
  // indentasi manual via whitespace/&nbsp; beruntun di awal paragraf (pengganti first-line indent)
  out = out.replace(/(<p[^>]*>)((?:\s|&nbsp;){2,})/gi, "$1");
  return { html: out, changed: out !== (html || "") };
}
