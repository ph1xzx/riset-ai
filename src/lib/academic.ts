// Academic search: OpenAlex (primary) + Crossref (fallback/merge).
// Both are free and keyless — Find Papers works out of the box.

export type AcademicSource = {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  journal: string;
  doi: string | null;
  abstract: string;
  url: string;
  pdfUrl: string;
  citationCount: number;
  openAccess: boolean;
  provider: "openalex" | "crossref";
  type: string;
  keywords: string[];
  impactFactor: number | null;
};

export type SearchFilters = {
  query: string;
  yearFrom?: number | null;
  yearTo?: number | null;
  minCitations?: number | null;
  openAccess?: boolean;
  includePreprint?: boolean;
  limit?: number;
};

function cleanAbstract(raw: string): string {
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function searchOpenAlex(f: SearchFilters): Promise<AcademicSource[]> {
  const filterParts: string[] = [];
  if (f.yearFrom) filterParts.push(`from_publication_date:${f.yearFrom}-01-01`);
  if (f.yearTo) filterParts.push(`until_publication_date:${f.yearTo}-12-31`);
  if (f.openAccess) filterParts.push("is_oa:true");
  if (!f.includePreprint) filterParts.push("type:article");
  if (f.minCitations) filterParts.push(`cited_by_count:>${f.minCitations - 1}`);

  const params = new URLSearchParams({
    search: f.query,
    per_page: String(f.limit ?? 20),
    mailto: "riset-ai-local@example.com",
    select: "id,doi,title,publication_year,authorships,primary_location,abstract_inverted_index,cited_by_count,open_access,type,keywords",
  });
  if (filterParts.length) params.set("filter", filterParts.join(","));

  const res = await fetch(`https://api.openalex.org/works?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
  const data: any = await res.json();

  return (data.results ?? []).map((w: any): AcademicSource => {
    const venue = w.primary_location?.source?.display_name || w.general_venue?.display_name || "";
    const inverted = w.abstract_inverted_index;
    let abstract = "";
    if (inverted && typeof inverted === "object") {
      const pos: Record<number, string> = {};
      for (const [word, positions] of Object.entries(inverted)) {
        for (const p of positions as number[]) pos[p] = word;
      }
      abstract = Object.keys(pos)
        .map(Number)
        .sort((a, b) => a - b)
        .map((p) => pos[p])
        .join(" ");
    }
    return {
      id: w.id?.replace(/^https?:\/\/openalex\.org\//, "") ?? w.doi,
      title: w.title || "(untitled)",
      authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
      year: w.publication_year ?? null,
      journal: venue,
      doi: w.doi?.replace(/^https?:\/\/doi\.org\//, "") ?? null,
      abstract: cleanAbstract(abstract),
      url: w.doi ? `https://doi.org/${w.doi.replace(/^https?:\/\/doi\.org\//, "")}` : w.id,
      pdfUrl: w.open_access?.oa_url ?? "",
      citationCount: w.cited_by_count ?? 0,
      openAccess: Boolean(w.open_access?.is_oa),
      provider: "openalex",
      type: w.type ?? "article",
      keywords: (w.keywords ?? []).map((k: any) => k.display_name).filter(Boolean),
      impactFactor: w.primary_location?.source?.host_ileid ? null : null,
    };
  });
}

async function searchCrossref(f: SearchFilters): Promise<AcademicSource[]> {
  const params = new URLSearchParams({
    query: f.query,
    rows: String(f.limit ?? 20),
    "mailto": "riset-ai-local@example.com",
    "select": "DOI,title,author,container-title,issued,abstract,is-referenced-by-count,link,type,subject,ORCID",
  });
  if (f.yearFrom || f.yearTo) {
    params.set(
      "filter",
      `from-pub-date:${f.yearFrom ?? 1900}-01-01,until-pub-date:${f.yearTo ?? 9999}-12-31`
    );
  }

  const res = await fetch(`https://api.crossref.org/works?${params}`);
  if (!res.ok) throw new Error(`Crossref ${res.status}`);
  const data: any = await res.json();

  return (data.message?.items ?? []).map((w: any): AcademicSource => {
    const authors = (w.author ?? []).map((a: any) => [a.given, a.family].filter(Boolean).join(" "));
    const year = w.issued?.["date-parts"]?.[0]?.[0] ?? null;
    return {
      id: w.DOI,
      title: w.title?.[0] ?? "(untitled)",
      authors,
      year: typeof year === "number" ? year : null,
      journal: w["container-title"]?.[0] ?? "",
      doi: w.DOI,
      abstract: cleanAbstract(w.abstract ?? ""),
      url: `https://doi.org/${w.DOI}`,
      pdfUrl: (w.link ?? []).find((l: any) => l.content_type === "application/pdf")?.URL ?? "",
      citationCount: w["is-referenced-by-count"] ?? 0,
      openAccess: false,
      provider: "crossref",
      type: w.type ?? "article",
      keywords: (w.subject ?? []).slice(0, 8),
      impactFactor: null,
    };
  });
}

function dedupeByDoi(list: AcademicSource[]): AcademicSource[] {
  const map = new Map<string, AcademicSource>();
  const out: AcademicSource[] = [];
  for (const s of list) {
    const key = s.doi ? s.doi.toLowerCase() : `t:${s.title.toLowerCase().trim()}:${s.year ?? ""}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, s);
      out.push(s);
    } else {
      // merge: prefer richer record
      const merged = { ...s };
      if (existing.abstract.length > merged.abstract.length) merged.abstract = existing.abstract;
      if (existing.authors.length > merged.authors.length) merged.authors = existing.authors;
      if (existing.citationCount > merged.citationCount) merged.citationCount = existing.citationCount;
      merged.openAccess = merged.openAccess || existing.openAccess;
      if (merged.pdfUrl || existing.pdfUrl) merged.pdfUrl = merged.pdfUrl || existing.pdfUrl;
      out[out.indexOf(existing)] = merged;
    }
  }
  return out;
}

/**
 * Semantic-ish ranking: score by year recency, citations, metadata completeness.
 * (Relevance itself comes from the providers' search ranking.)
*/
function rank(list: AcademicSource[]): AcademicSource[] {
  const now = new Date().getFullYear();
  const score = (s: AcademicSource) => {
    let sc = 0;
    if (s.year) sc += Math.max(0, (now - s.year) * -1 + 12); // recency
    sc += Math.min(30, Math.log10(s.citationCount + 1) * 10); // citations
    if (s.abstract.length > 200) sc += 5;
    if (s.openAccess) sc += 4;
    if (s.authors.length) sc += 2;
    return sc;
  };
  return [...list].sort((a, b) => score(b) - score(a));
}

export async function searchPapers(f: SearchFilters): Promise<{ results: AcademicSource[]; sources: string[] }> {
  const limit = Math.min(f.limit ?? 20, 50);
  const tasks: Promise<AcademicSource[]>[] = [searchOpenAlex({ ...f, limit: limit * 2 })];
  try {
    tasks.push(searchCrossref({ ...f, limit: Math.ceil(limit) }));
  } catch {}

  const settled = await Promise.allSettled(tasks);
  const lists = settled.filter((s): s is PromiseFulfilledResult<AcademicSource[]> => s.status === "fulfilled").map((s) => s.value);
  const used = settled.filter((s) => s.status === "fulfilled").length;

  if (!lists.length) throw new Error("All academic providers failed");

  let merged = dedupeByDoi(lists.flat()).slice(0, limit * 2);
  if (f.minCitations) merged = merged.filter((s) => s.citationCount >= f.minCitations!);
  merged = rank(merged).slice(0, limit);
  return { results: merged, sources: used ? (lists[0]?.length ? ["openalex"] : []).concat(lists[1]?.length ? ["crossref"] : []) : [] };
}

export async function resolvePaperById(
  id: string,
  projectId: string
): Promise<AcademicSource | null> {
  // id may be a DOI or an OpenAlex id
  if (id.toLowerCase().startsWith("10.")) {
    try {
      const r = await searchCrossref({ query: id, limit: 1 });
      return r[0] ?? null;
    } catch {
      return null;
    }
  }
  try {
    const res = await fetch(`https://api.openalex.org/works/${encodeURIComponent(id)}`);
    if (!res.ok) return null;
    const w: any = await res.json();
    const venue = w.primary_location?.source?.display_name || "";
    return {
      id: w.id?.replace(/^https?:\/\/openalex\.org\//, "") ?? id,
      title: w.title || id,
      authors: (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean),
      year: w.publication_year ?? null,
      journal: venue,
      doi: w.doi?.replace(/^https?:\/\/doi\.org\//, "") ?? null,
      abstract: "",
      url: w.id,
      pdfUrl: w.open_access?.oa_url ?? "",
      citationCount: w.cited_by_count ?? 0,
      openAccess: Boolean(w.open_access?.is_oa),
      provider: "openalex",
      type: w.type ?? "article",
      keywords: (w.keywords ?? []).map((k: any) => k.display_name),
      impactFactor: null,
    };
  } catch {
    return null;
  }
}
