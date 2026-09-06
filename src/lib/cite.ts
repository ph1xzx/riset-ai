export interface SourceRecord {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string;
  doi: string;
  abstract: string;
  url: string;
  pdfUrl: string;
  citationCount: number | null;
  openAccess: boolean;
  provider: string;
  type: string;
  keywords: string[];
  impactFactor: number | null;
  verified: string; // "VERIFIED" | "METADATA_ONLY" | "NOT_FOUND"
}

export type CitationStyle = "APA7" | "IEEE" | "Harvard" | "Vancouver";

const lastName = (a: string) => a.trim().split(/\s+/).pop() || a.trim();
const initials = (a: string) =>
  a
    .trim()
    .split(/\s+/)
    .slice(0, -1)
    .map((p) => p[0]?.toUpperCase() + ".")
    .join(" ");

function authorsApa7(list: string[]): string {
  if (!list.length) return "Anonim";
  if (list.length === 1) return list[0];
  if (list.length <= 20) return list.slice(0, -1).join(", ") + ", & " + list[list.length - 1];
  return list.slice(0, 19).join(", ") + ", … " + list[list.length - 1];
}

function authorsHarvard(list: string[]): string {
  if (!list.length) return "Anonim";
  if (list.length === 1) return lastName(list[0]);
  if (list.length <= 3) return list.map((a, i) => (i === 0 ? lastName(a) : lastName(a))).join(", ") + (list.length === 2 ? "" : "");
  return lastName(list[0]) + " et al";
}

/** Format a full reference entry in the requested style. */
export function formatReference(s: SourceRecord, style: CitationStyle): string {
  const y = s.year ? `(${s.year})` : "(t.t.)";
  switch (style) {
    case "APA7":
      return `${authorsApa7(s.authors)} ${y} ${s.title}. ${s.journal || s.type === "book" ? (s.journal || "Penerbit") : s.journal || "Dokumen"}${s.doi ? `. https://doi.org/${s.doi}` : s.url ? `. ${s.url}` : ""}`.replace(/\s+/g, " ").trim();
    case "IEEE":
      return `${s.authors.map((a) => `${initials(a)} ${lastName(a)}`).join(", ") || "Anonim"}, “${s.title},” ${s.journal || "Dokumen"}, ${s.year ?? "t.t."}${s.doi ? `, doi: ${s.doi}` : ""}.`;
    case "Harvard":
      return `${authorsHarvard(s.authors)} (${s.year ?? "t.t."}) ‘${s.title},’ ${s.journal || "Dokumen"}${s.doi ? `, doi ${s.doi}` : ""}.`;
    case "Vancouver":
      return `${s.authors.slice(0, 3).map(lastName).join(", ") || "Anonim"}${s.authors.length > 3 ? ", et al" : ""}. ${s.title}. ${s.journal || "Dokumen"}. ${s.year ?? "t.t."}.`;
  }
}

/** In-text citation for the requested style (index-based for IEEE/Vancouver). */
export function formatInline(s: SourceRecord, style: CitationStyle, index: number): string {
  switch (style) {
    case "IEEE":
    case "Vancouver":
      return `[${index + 1}]`;
    case "Harvard":
      return `(${authorsHarvard(s.authors)}, ${s.year ?? "t.t."})`;
    case "APA7":
    default: {
      if (!s.authors.length) return `(Anonim, ${s.year ?? "t.t."})`;
      if (s.authors.length === 1) return `(${lastName(s.authors[0])}, ${s.year ?? "t.t."})`;
      if (s.authors.length === 2) return `(${lastName(s.authors[0])} & ${lastName(s.authors[1])}, ${s.year ?? "t.t."})`;
      return `(${lastName(s.authors[0])} et al., ${s.year ?? "t.t."})`;
    }
  }
}

/** Find citation tokens in HTML content: <sup class="citation" data-source-id="..."> */
export function extractCitationTokens(html: string): { sourceId: string; text: string }[] {
  const out: { sourceId: string; text: string }[] = [];
  const re = /<sup[^>]*class="[^"]*citation[^"]*"[^>]*data-source-id="([^"]+)"[^>]*>([\s\S]*?)<\/sup>/g;
  let m;
  while ((m = re.exec(html))) out.push({ sourceId: m[1], text: m[2] });
  return out;
}

/**
 * Verify a source against Crossref (via DOI) or OpenAlex (via title).
 * Sets verified = VERIFIED | NOT_FOUND and enriches metadata when found.
 */
export async function verifySource(s: SourceRecord): Promise<SourceRecord> {
  const updated = { ...s };

  // 1) Crossref by DOI
  if (s.doi) {
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(s.doi)}`, {
        headers: { "User-Agent": "RisetAI/2.0 (mailto:riset.ai)" },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const j = await res.json();
        const work = j.message;
        const foundTitle = (work.title?.[0] || work["container-title"]?.[0] || "").toLowerCase();
        const mine = (s.title || "").toLowerCase();
        const similar =
          foundTitle && (foundTitle.includes(mine.slice(0, 40)) || mine.includes(foundTitle.slice(0, 40)) || similarity(foundTitle, mine) > 0.55);
        if (similar) {
          updated.verified = "VERIFIED";
          if (!s.authors.length && work.author?.length) {
            updated.authors = work.author
              .map((a: any) => [a.given, a.family].filter(Boolean).join(" "))
              .filter(Boolean);
          }
          if (!s.year && work.issued?.["date-parts"]?.[0]?.[0]) updated.year = work.issued["date-parts"][0][0];
          if (!s.journal && work["container-title"]?.[0]) updated.journal = work["container-title"][0];
          if (!s.citationCount && work["is-referenced-by-count"] != null) updated.citationCount = work["is-referenced-by-count"];
          return updated;
        }
        // DOI resolves but title mismatch
        updated.verified = "NOT_FOUND";
        return updated;
      }
    } catch {
      /* network issue -> fall through to OpenAlex */
    }
  }

  // 2) OpenAlex by title
  if (s.title && s.title.length > 10) {
    try {
      const res = await fetch(
        `https://api.openalex.org/works?search=${encodeURIComponent(s.title.slice(0, 120))}&per-page=3&mailto=riset.ai`,
        { signal: AbortSignal.timeout(15000) }
      );
      if (res.ok) {
        const j = await res.json();
        const work = (j.results || [])[0];
        if (work) {
          const foundTitle = (work.display_name || "").toLowerCase();
          if (similarity(foundTitle, s.title.toLowerCase()) > 0.5) {
            updated.verified = "VERIFIED";
            if (!s.authors.length && work.authorships?.length) {
              updated.authors = work.authorships.map((a: any) => a.author?.display_name).filter(Boolean);
            }
            if (!s.year && work.publication_year) updated.year = work.publication_year;
            if (!s.journal && work.primary_location?.source?.display_name) updated.journal = work.primary_location.source.display_name;
            if (!s.citationCount && work.cited_by_count != null) updated.citationCount = work.cited_by_count;
            if (!s.doi && work.doi) updated.doi = work.doi.replace("https://doi.org/", "");
            return updated;
          }
        }
      }
    } catch {
      /* fall through */
    }
  }

  return updated;
}

/** Search OpenAlex for candidate papers (used by /find-papers & citation-repair). */
export async function searchOpenAlex(query: string, opts: { yearFrom?: number | null; yearTo?: number | null; limit?: number } = {}) {
  const params = new URLSearchParams({
    search: query,
    "per-page": String(opts.limit ?? 10),
    mailto: "riset.ai",
  });
  const yearFilter: string[] = [];
  if (opts.yearFrom) yearFilter.push(`from_publication_year:${opts.yearFrom}`);
  if (opts.yearTo) yearFilter.push(`to_publication_year:${opts.yearTo}`);
  if (yearFilter.length) params.set("filter", yearFilter.join(","));
  const res = await fetch(`https://api.openalex.org/works?${params}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Pencarian gagal (${res.status})`);
  const j = await res.json();
  return (j.results || []).map((w: any) => ({
    title: w.display_name,
    authors: (w.authorships || []).map((a: any) => a.author?.display_name).filter(Boolean),
    year: w.publication_year,
    journal: w.primary_location?.source?.display_name || "",
    doi: (w.doi || "").replace("https://doi.org/", ""),
    abstract: (w.abstract_inverted_index ? invertAbstract(w.abstract_inverted_index) : "") || "",
    url: w.id || "",
    citationCount: w.cited_by_count,
    openAccess: !!w.open_access?.is_oa,
    provider: "openalex",
    type: w.type || "article",
    keywords: (w.keywords || []).map((k: any) => k.display_name).slice(0, 5),
  }));
}

function invertAbstract(inv: Record<string, number[]>): string {
  const pos: Record<number, string> = {};
  for (const [word, indices] of Object.entries(inv)) for (const i of indices) pos[i] = word;
  return Object.keys(pos)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => pos[i])
    .join(" ");
}

/** Simple shingle similarity (0..1) for title matching. */
function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const setA = new Set(shingles(a));
  const setB = new Set(shingles(b));
  let inter = 0;
  for (const s of setA) if (setB.has(s)) inter++;
  return inter / Math.max(1, Math.min(setA.size, setB.size));
}
function shingles(s: string): string[] {
  const t = s.toLowerCase().replace(/[^a-z0-9 ]/g, "").split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < t.length - 1; i++) out.push(t[i] + " " + t[i + 1]);
  return out.length ? out : [t.join(" ")];
}
