// "Cek Penulisan & Sitasi" — ala Jenni:
// 1) ekstrak kandidat sitasi inline dari teks (APA: (Author, Year),
//    Author et al. (Year), IEEE: [12])
// 2) verifikasi tiap kandidat terhadap Crossref/OpenAlex (keyless)
// 3) status: VERIFIED_METADATA | METADATA_ONLY | NOT_FOUND

export type CitationCandidate = {
  raw: string;
  kind: "apa" | "ieee" | "authorYear";
  authors: string[];
  year: number | null;
  context: string;
};

export type CitationCheckResult = {
  candidate: CitationCandidate;
  status: "VERIFIED_METADATA" | "METADATA_ONLY" | "NOT_FOUND";
  matchedTitle?: string;
  matchedYear?: number;
  matchedJournal?: string;
  doi?: string;
  url?: string;
  note?: string;
};

function lastWords(author: string): string {
  const parts = author.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

/** Ekstrak kandidat sitasi dari teks biasa. */
export function extractCitationCandidates(text: string): CitationCandidate[] {
  const out: CitationCandidate[] = [];
  const seen = new Set<string>();
  const push = (c: CitationCandidate) => {
    const key = `${c.raw}|${c.year}`;
    if (!seen.has(key) && out.length < 60) {
      seen.add(key);
      out.push(c);
    }
  };

  const ctx = (m: RegExpExecArray, span = 160) => {
    const s = Math.max(0, m.index - span);
    return text.slice(s, m.index + m[0].length + span).replace(/\s+/g, " ");
  };

  // (Author, Year) / (Author & Author, Year) / (Author et al., Year)
  let m: RegExpExecArray | null;
  const apaRe = /\((\s*[A-ZÀ-Ž][\w\-'’]+(?:\s+(?:et al\.?|&|dan|and)\s+)?(?:[A-ZÀ-Ž][\w\-'’]*)?\s*),\s*((19|20)\d{2})[a-z]?\)/g;
  while ((m = apaRe.exec(text)) !== null) {
    const authors = m[1]
      .replace(/et al\.?/i, "")
      .split(/(?:\s+(&|dan|and)\s+)|,\s*/)
      .map((x) => x.trim())
      .filter((x) => /^[A-ZÀ-Ž][\w\-'’]+$/.test(x));
    if (authors.length === 0) continue;
    push({ raw: m[0], kind: "apa", authors, year: Number(m[2]), context: ctx(m) });
  }

  // Author (Year) / Author et al. (Year) — author year di luar kurung penuh
  const ayRe = /\b([A-ZÀ-Ž][\w\-'’]+)(?:\s+et al\.?)?\s+\(((19|20)\d{2})\)/g;
  while ((m = ayRe.exec(text)) !== null) {
    if (/^(19|20)\d{2}$/.test(m[1])) continue;
    push({ raw: m[0], kind: "authorYear", authors: [m[1]], year: Number(m[3]), context: ctx(m) });
  }

  // IEEE [12]
  const ieeeRe = /\[(\d{1,3})(?:[-,]\s*\d{1,3})*\](?!\.)/g;
  while ((m = ieeeRe.exec(text)) !== null) {
    const n = Number(m[1]);
    if (n > 500) continue;
    push({ raw: m[0], kind: "ieee", authors: [], year: null, context: ctx(m) });
  }

  return out;
}

/** Verifikasi satu kandidat APA/authorYear via Crossref (keyless). */
async function verifyApa(c: CitationCandidate): Promise<CitationCheckResult> {
  const primary = c.authors[0];
  const params = new URLSearchParams({
    "query.bibliographic": `${primary} ${c.year ?? ""}`.trim(),
    "query.author": primary,
    rows: "3",
    mailto: "riset-ai-local@example.com",
  });
  if (c.year) params.set("filter", `from-pub-date:${c.year - 1}-01-01,until-pub-date:${c.year + 1}-12-31`);
  try {
    const res = await fetch(`https://api.crossref.org/works?${params}`);
    if (!res.ok) return { candidate: c, status: "METADATA_ONLY", note: `Crossref ${res.status}` };
    const data: any = await res.json();
    const items: any[] = data.message?.items ?? [];
    if (!items.length) return { candidate: c, status: "NOT_FOUND", note: "Tidak ditemukan di Crossref — cek ejaan/ tahun." };

    // skor kemiripan nama belakang
    const primaryLast = lastWords(primary);
    let best = items[0];
    let bestScore = 0;
    for (const it of items) {
      let sc = 0;
      const authors: string[] = (it.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(" "));
      if (authors.some((a) => lastWords(a) === primaryLast)) sc += 2;
      const yr = it.issued?.["date-parts"]?.[0]?.[0];
      if (c.year && yr === c.year) sc += 2;
      else if (c.year && yr && Math.abs(yr - c.year) <= 1) sc += 1;
      if (sc > bestScore) {
        bestScore = sc;
        best = it;
      }
    }
    if (bestScore >= 3) {
      const yr = best.issued?.["date-parts"]?.[0]?.[0] ?? null;
      return {
        candidate: c,
        status: "VERIFIED_METADATA",
        matchedTitle: best.title?.[0],
        matchedYear: yr ?? undefined,
        matchedJournal: best["container-title"]?.[0],
        doi: best.DOI,
        url: `https://doi.org/${best.DOI}`,
      };
    }
    if (bestScore >= 2) {
      const yr = best.issued?.["date-parts"]?.[0]?.[0] ?? null;
      return {
        candidate: c,
        status: "METADATA_ONLY",
        matchedTitle: best.title?.[0],
        matchedYear: yr ?? undefined,
        matchedJournal: best["container-title"]?.[0],
        doi: best.DOI,
        url: best.DOI ? `https://doi.org/${best.DOI}` : undefined,
        note: "Kemiripan parsial — verifikasi manual.",
      };
    }
    return { candidate: c, status: "NOT_FOUND", note: "Tidak ada kecocokan kuat di Crossref." };
  } catch (e: any) {
    return { candidate: c, status: "METADATA_ONLY", note: e?.message?.slice(0, 100) };
  }
}

/**
 * Cek KONSISTENSI sitasi (deterministik, tanpa AI):
 * - sitasi di body harus ada di Daftar Pustaka
 * - entri Daftar Pustaka harus dikutip di body
 * - gaya IEEE [n]: nomor harus ada dalam rentang daftar pustaka
 */
export type ConsistencyResult = {
  missingInRefList: { raw: string; author: string; year: number | null }[];
  uncitedInBody: { entry: string; author: string; year: number | null }[];
  totalInline: number;
  totalRefEntries: number;
  isIeee: boolean;
  ieeeOutOfRange: string[];
};

function lastWord(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1].toLowerCase();
}

function parseRefEntries(refText: string): { entry: string; author: string; year: number | null }[] {
  const out: { entry: string; author: string; year: number | null }[] = [];
  // entri biasanya baris "1. Author (Year). ..." atau baris APA langsung
  for (const rawLine of refText.split(/\n+/)) {
    const line = rawLine.replace(/^\s*\d{1,3}[.)]\s*/, "").trim();
    if (line.length < 8 || line.length > 500) continue;
    const m = line.match(/([A-Z][\w\-’' .,&]{1,60}?)\s*\(((19|20)\d{2})\)/);
    if (!m) continue;
    // author = kata-kata kapital sebelum (Year), ambil yang paling masuk akal
    let author = m[1]
      .split(/,|&/)[0]
      .replace(/\.$/, "")
      .trim()
      .split(/\s+/)
      .filter((w) => /^[A-ZÀ-Ž]/.test(w) || /-/.test(w))
      .join(" ");
    if (!author) author = m[1].trim();
    out.push({ entry: line.slice(0, 200), author, year: Number(m[2]) });
  }
  return out;
}

export function checkCitationConsistency(
  bodyText: string,
  refText: string
): ConsistencyResult {
  const candidates = extractCitationCandidates(bodyText);
  const apaCands = candidates.filter((c) => c.kind !== "ieee");
  const ieeeCands = candidates.filter((c) => c.kind === "ieee");
  const isIeee = apaCands.length === 0 && ieeeCands.length > 0;

  const refEntries = parseRefEntries(refText);

  const missingInRefList: ConsistencyResult["missingInRefList"] = [];
  const citedRefIdx = new Set<number>();

  for (const c of apaCands) {
    const authorLast = lastWord(c.authors[0] || "");
    const hit = refEntries.findIndex(
      (r) => lastWord(r.author) === authorLast && r.year === c.year
    );
    if (hit >= 0) citedRefIdx.add(hit);
    else missingInRefList.push({ raw: c.raw, author: c.authors[0] || c.raw, year: c.year });
  }

  const uncitedInBody = refEntries
    .map((r, i) => ({ r, i }))
    .filter(({ i }) => !citedRefIdx.has(i))
    .map(({ r }) => ({ entry: r.entry, author: r.author, year: r.year }));

  // IEEE: [n] harus <= jumlah entri
  const ieeeOutOfRange: string[] = [];
  if (isIeee) {
    for (const c of ieeeCands) {
      const n = Number(c.raw.replace(/[^0-9]/g, ""));
      if (refEntries.length && n > refEntries.length) ieeeOutOfRange.push(c.raw);
    }
  }

  return {
    missingInRefList,
    uncitedInBody,
    totalInline: candidates.length,
    totalRefEntries: refEntries.length,
    isIeee,
    ieeeOutOfRange,
  };
}

/**
 * Jalankan cek sitasi terhadap teks. Kandidat IEEE diverifikasi terhadap
 * daftar pustaka dokumen sendiri (jika diberikan) — [n] harus ada di daftar pustaka.
 */
export async function checkCitations(
  text: string,
  referenceList?: string
): Promise<CitationCheckResult[]> {
  const candidates = extractCitationCandidates(text);
  const results: CitationCheckResult[] = [];

  const apaCandidates = candidates.filter((c) => c.kind !== "ieee");
  const ieeeCandidates = candidates.filter((c) => c.kind === "ieee");

  // limit API calls
  const toVerify = apaCandidates.slice(0, 25);
  const batch = 5;
  for (let i = 0; i < toVerify.length; i += batch) {
    const chunk = toVerify.slice(i, i + batch);
    const rr = await Promise.all(chunk.map(verifyApa));
    results.push(...rr);
  }

  // IEEE: cocokkan terhadap daftar pustaka (nomor harus ada)
  for (const c of ieeeCandidates) {
    const n = Number(c.raw.replace(/[^0-9]/g, ""));
    const refLine = referenceList ? referenceList.match(new RegExp(`^[^\\d]*${n}\\s*\\.[^\\n]{5,}`)) : null;
    results.push({
      candidate: c,
      status: refLine ? "VERIFIED_METADATA" : "METADATA_ONLY",
      matchedTitle: refLine ? refLine[0].slice(0, 200) : undefined,
      note: refLine
        ? `Ditemukan di daftar pustaka dokumen (no. ${n}).`
        : `Referensi [${n}] tidak ditemukan di daftar pustaka dokumen.`,
    });
  }

  return results;
}
