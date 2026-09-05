/**
 * FORMAT CHECKER — memperingatkan pelanggaran pedoman pada isi proyek.
 * subset aturan §37 yang dapat diperiksa dari data section (judul + HTML):
 * heading bertitik, BAB non-Romawi/non-kapital, nomor subbab tak sinkron,
 * lompat level heading, sitasi tanpa entri pustaka, pustaka tak pernah disitasi.
 * Aturan layout (justify/indent/page break/margin) DIJAMIN mesin export,
 * jadi tidak perlu dicek di sini.
 */

export type FormatIssue = { code: string; severity: "error" | "warn"; msg: string };

const ROMAN = /^BAB\s+[IVXLCDM]+(\s|$)/i;
const ROMAN_VAL: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };

function romanToNum(s: string): number {
  let total = 0;
  let prev = 0;
  for (const ch of s.toUpperCase().split("").reverse()) {
    const v = ROMAN_VAL[ch] || 0;
    total += v < prev ? -v : v;
    prev = v;
  }
  return total;
}

export function validateFormat(
  sections: { title: string; level: number; content: string; status?: string }[]
): FormatIssue[] {
  const issues: FormatIssue[] = [];
  let activeBab = 0;

  for (const s of sections) {
    const title = (s.title || "").trim();
    const contentText = (s.content || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

    if (!title) {
      issues.push({ code: "SECTION_NO_TITLE", severity: "error", msg: "Ada section tanpa judul." });
    }
    if (contentText.length < 30 && !/DAFTAR\s+PUSTAKA|REFERENCES?/i.test(title)) {
      issues.push({ code: "SECTION_TOO_SHORT", severity: "warn", msg: `"${title || "Section tanpa judul"}" masih kosong atau terlalu pendek.` });
    }
    if (s.status === "AI_DRAFT") {
      issues.push({ code: "AI_DRAFT_UNREVIEWED", severity: "warn", msg: `"${title || "Section"}" masih berstatus AI Draft, baca ulang sebelum export.` });
    }

    if (s.level === 1) {
      if (/^BAB\b/i.test(title)) {
        if (!ROMAN.test(title)) {
          issues.push({ code: "BAB_NOT_ROMAN", severity: "error", msg: `"${title}" — BAB harus pakai angka Romawi (BAB I, BAB II, …)` });
        } else {
          activeBab = romanToNum(title.match(/^BAB\s+([IVXLCDM]+)/i)![1]);
          const after = title.replace(/^BAB\s+[IVXLCDM]+\s*/i, "");
          if (after && after !== after.toUpperCase()) {
            issues.push({ code: "BAB_NOT_UPPER", severity: "error", msg: `"${title}" — judul BAB harus kapital seluruhnya` });
          }
        }
      }
    } else {
      // subbab: cek nomor "N." harus sinkron dengan BAB aktif
      const m = title.match(/^(\d+)\.(\d+)/);
      if (m && activeBab > 0 && Number(m[1]) !== activeBab) {
        issues.push({
          code: "NUM_NOT_MATCH_BAB",
          severity: "error",
          msg: `"${title}" — nomor awal ${m[1]} tidak cocok dengan BAB ${activeBab} yang aktif`,
        });
      }
    }

    if (/\.\s*$/.test(title)) {
      issues.push({ code: "HEADING_DOT", severity: "error", msg: `"${title}" — heading tidak boleh diakhiri titik` });
    }
  }

  /* --- lompat level: h3 (x.y.z) tanpa induk h2 (x.y) sebelumnya --- */
  const seenH2 = new Set<string>();
  for (const s of sections) {
    if (s.level === 2) {
      const m = (s.title || "").match(/^(\d+\.\d+)(?!\.)/);
      if (m) seenH2.add(m[1]);
    }
    const h3s = s.content.match(/<h3[^>]*>\s*(\d+\.\d+\.\d+)(?!\.)/g) || [];
    for (const h of h3s) {
      const num = h.match(/(\d+\.\d+\.\d+)/)![1];
      const parent = num.split(".").slice(0, 2).join(".");
      if (!seenH2.has(parent)) {
        issues.push({ code: "LEVEL_SKIP", severity: "warn", msg: `Anak subbab ${num} muncul tanpa subbab induk ${parent}` });
      }
    }
  }

  /* --- nomor subbab loncat (1.1 → 1.3) --- */
  let lastL2: { a: number; b: number } | null = null;
  for (const s of sections) {
    if (s.level !== 2) continue;
    const m = (s.title || "").match(/^(\d+)\.(\d+)(?!\.)/);
    if (!m) continue;
    const cur = { a: Number(m[1]), b: Number(m[2]) };
    if (lastL2 && cur.a === lastL2.a && cur.b > lastL2.b + 1) {
      issues.push({ code: "SUBBAB_SKIP", severity: "warn", msg: `"${s.title}" — nomor loncat dari ${lastL2.a}.${lastL2.b}` });
    }
    lastL2 = cur;
  }

  /* --- sitasi ↔ daftar pustaka --- */
  const dp = sections.find((s) => /DAFTAR\s+PUSTAKA/i.test(s.title || ""));
  const dpText = dp ? (dp.content || "").replace(/<[^>]+>/g, " ").toLowerCase() : "";
  const bodyText = sections
    .filter((s) => !/DAFTAR\s+PUSTAKA/i.test(s.title || ""))
    .map((s) => (s.content || "").replace(/<[^>]+>/g, " "))
    .join(" ");
  const cited = new Set<string>();
  const citeRe = /\(([A-Z][A-Za-z'’-]+)(?:\s*(?:et al\.|&|dan)\s*[A-Z][A-Za-z'’-]+)?,\s*(\d{4})[a-z]?\)/g;
  let cm: RegExpExecArray | null;
  while ((cm = citeRe.exec(bodyText)) !== null) cited.add(`${cm[1].toLowerCase()}|${cm[2]}`);
  if (cited.size) {
    for (const key of cited) {
      const [name, year] = key.split("|");
      if (!dpText.includes(name) || !dpText.includes(year)) {
        issues.push({
          code: "CITE_NO_REF",
          severity: "warn",
          msg: `Sitasi (${name[0].toUpperCase() + name.slice(1)}, ${year}) tidak ditemukan di Daftar Pustaka`,
        });
      }
    }
  }
  if (dp) {
    const entries = (dp.content || "")
      .split(/<\/p>/i)
      .map((e) => e.replace(/<[^>]+>/g, " ").trim())
      .filter((e) => e.length > 15);
    for (const e of entries) {
      const ym = e.match(/\((\d{4})\)|\b(\d{4})\b/);
      const year = ym ? ym[1] || ym[2] : "";
      const firstWord = e.split(/\s+/)[0].replace(/[^A-Za-z'’-]/g, "").toLowerCase();
      if (year && firstWord.length > 2 && !bodyText.toLowerCase().includes(firstWord)) {
        issues.push({ code: "REF_NOT_CITED", severity: "warn", msg: `Entri pustaka "${e.slice(0, 48)}…" tidak pernah disitasi di isi` });
      }
    }
  }

  return issues;
}
