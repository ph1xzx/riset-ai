import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject, rowToSource } from "@/lib/api";
import { verifySource, extractCitationTokens } from "@/lib/cite";
import type { SourceRecord } from "@/lib/cite";

/**
 * Citation check — mirrors the live app's behaviour:
 *  1. Audit the document's DAFTAR PUSTAKA entries (verify via Crossref DOI /
 *     OpenAlex title search).
 *  2. In-text coverage: how many library sources are cited (sup.citation
 *     tokens) and how many author-year citations appear in the text.
 *  3. Year consistency: in-text "(Author et al. (YYYY))" years vs the
 *     reference list (fixes the old app's year:"20" parsing bug).
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;

  const sections = (db.prepare('SELECT title, content FROM sections WHERE project_id = ? ORDER BY "order"').all(id) as any[]);
  const refSec = sections.find((s) => /daftar pustaka|daftar rujukan|^references$/i.test(s.title.trim()));
  const library = (db.prepare("SELECT * FROM sources WHERE project_id = ?").all(id) as any[]).map((x) => rowToSource(x) as SourceRecord);

  // ---- 1) audit reference list entries -----------------------------------
  const entries = refSec ? splitReferences(refSec.content) : [];
  const results: any[] = [];
  let verified = 0, metadataOnly = 0, notFound = 0;

  const LIMIT = 20;
  for (let i = 0; i < entries.length; i += 4) {
    const batch = entries.slice(i, i + 4).map(async (entry) => {
      let upd: SourceRecord;
      try {
        upd = await verifySource(entry);
      } catch {
        upd = { ...entry, verified: "METADATA_ONLY" };
      }
      if (upd.verified === "VERIFIED") verified++;
      else if (upd.verified === "NOT_FOUND") notFound++;
      else metadataOnly++;
      return {
        title: entry.title,
        authors: entry.authors,
        year: entry.year,
        doi: entry.doi || null,
        verified: upd.verified,
        citationCount: upd.citationCount || 0,
        fromDocument: true,
      };
    });
    results.push(...(await Promise.all(batch)));
    if (results.length >= LIMIT) break;
  }

  // library sources (if any) are audited too
  for (const s of library) {
    let upd: SourceRecord;
    try {
      upd = await verifySource(s);
    } catch {
      upd = { ...s, verified: s.verified || "METADATA_ONLY" };
    }
    if (upd.verified === "VERIFIED") verified++;
    else if (upd.verified === "NOT_FOUND") notFound++;
    else metadataOnly++;
    results.push({
      id: s.id,
      title: s.title,
      authors: s.authors,
      year: s.year,
      doi: s.doi,
      verified: upd.verified,
      citationCount: upd.citationCount || 0,
      fromDocument: false,
    });
  }

  // ---- 2) in-text coverage ------------------------------------------------
  const citedIds = new Set<string>();
  const inText: { author: string; year: number }[] = [];
  for (const sec of sections) {
    for (const tok of extractCitationTokens(sec.content)) citedIds.add(tok.sourceId);
    const text = (sec.content || "").replace(/<[^>]+>/g, " ");
    for (const m of text.matchAll(/\(?([A-Z][a-zA-Z’'-]+(?:\s+(?:et\s+al\.?|&|dan)\s+[A-Z][a-zA-Z’'-]+)*)\s*\(\s*((19|20)\d{2}[a-z]?)\s*\)/g)) {
      inText.push({ author: m[1].trim(), year: parseInt(m[2].slice(0, 4), 10) });
    }
  }

  // ---- 3) year consistency -------------------------------------------------
  const yearIssues: { author: string; inText: number; inList: number | null }[] = [];
  for (const c of inText) {
    const key = c.author.split(/\s+/)[0].toLowerCase();
    const listEntry = results.find(
      (x) => x.authors?.some((a: string) => a.toLowerCase().includes(key)) || (x.title || "").toLowerCase().includes(key)
    );
    const inList = listEntry?.year && listEntry.year !== c.year ? listEntry.year : null;
    if (inList) yearIssues.push({ author: c.author, inText: c.year, inList });
  }

  return NextResponse.json({
    total: results.length,
    verified,
    metadataOnly,
    notFound,
    citedSources: citedIds.size,
    inTextCitations: inText.length,
    yearIssues,
    consistency: results.length ? verified / results.length : null,
    results,
  });
}

/** Split a DAFTAR PUSTAKA HTML block into parsed reference entries. */
function splitReferences(html: string): SourceRecord[] {
  const paras: string[] = [];
  const re = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = m[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 25) paras.push(text);
  }

  return paras.map((text) => {
    const doiMatch = text.match(/10\.\d{4,9}\/[^\s,;")]+/);
    const yearMatch = text.match(/\(((?:19|20)\d{2})[a-z]?\)/) || text.match(/\b((?:19|20)\d{2})\b/);
    const year = yearMatch ? parseInt(yearMatch[1].slice(0, 4), 10) : null;

    // "Authors (year). Title. Journal, vol..." or "Authors. (year). Title."
    let authorsPart = "";
    let titlePart = "";
    const dotYear = text.indexOf(yearMatch ? yearMatch[0] : "");
    if (dotYear > 0) {
      authorsPart = text.slice(0, dotYear).replace(/[.,]$/, "").trim();
      const rest = text.slice(dotYear + (yearMatch ? yearMatch[0].length : 0)).replace(/^\.\s*/, "");
      const nextDot = rest.indexOf(". ");
      titlePart = (nextDot > 0 ? rest.slice(0, nextDot) : rest).trim();
    } else {
      titlePart = text.slice(0, 160);
    }
    const authors = authorsPart
      .split(/,\s*(?=[A-Z])/)
      .map((a) => a.replace(/\.\s*$/, "").trim())
      .filter((a) => a.length > 1 && a.length < 80);

    return {
      id: "",
      title: titlePart.slice(0, 300) || text.slice(0, 120),
      authors: authors.slice(0, 6),
      year,
      journal: "",
      doi: doiMatch ? doiMatch[0] : null,
      abstract: "",
      url: "",
      pdfUrl: "",
      citationCount: 0,
      openAccess: false,
      provider: "document",
      type: "article",
      keywords: [],
      impactFactor: null,
      verified: "METADATA_ONLY" as const,
    } as SourceRecord;
  });
}
