import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject, rowToSource } from "@/lib/api";
import { genId, nowIso } from "@/lib/util";
import { verifySource } from "@/lib/cite";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;
  const rows = db.prepare("SELECT * FROM sources WHERE project_id = ? ORDER BY added_at DESC").all(id) as any[];
  return NextResponse.json(rows.map(rowToSource));
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Judul sumber wajib diisi" }, { status: 400 });

  const idSrc = genId("src");
  const authors = JSON.stringify(Array.isArray(body.authors) ? body.authors : (body.authors ? String(body.authors).split(",").map((s: string) => s.trim()) : []));
  db.prepare(
    `INSERT INTO sources (id, project_id, title, authors, year, journal, doi, abstract, url, pdf_url,
      citation_count, open_access, provider, type, keywords, impact_factor, verified, added_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    idSrc, id, title, authors,
    body.year ? Number(body.year) : null,
    String(body.journal || "").slice(0, 300),
    String(body.doi || "").replace(/^https?:\/\/doi\.org\//, "").slice(0, 120),
    String(body.abstract || "").slice(0, 4000),
    String(body.url || "").slice(0, 500),
    String(body.pdfUrl || "").slice(0, 500),
    body.citationCount != null ? Number(body.citationCount) : null,
    body.openAccess ? 1 : 0,
    String(body.provider || "manual").slice(0, 40),
    String(body.type || "article").slice(0, 40),
    JSON.stringify(Array.isArray(body.keywords) ? body.keywords : []),
    body.impactFactor != null ? Number(body.impactFactor) : null,
    "METADATA_ONLY",
    nowIso()
  );

  // Verify in the background-ish (bounded); return immediately with a verified promise resolved
  const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(idSrc) as any;
  const src = rowToSource(row) as any;
  let verified = src;
  try {
    verified = await verifySource(src);
    db.prepare(
      `UPDATE sources SET verified = ?, authors = ?, year = COALESCE(?, year), journal = CASE WHEN ? != '' THEN ? ELSE journal END,
       citation_count = COALESCE(?, citation_count), doi = CASE WHEN ? != '' THEN ? ELSE doi END
       WHERE id = ?`
    ).run(
      verified.verified,
      JSON.stringify(verified.authors),
      verified.year,
      verified.journal, verified.journal,
      verified.citationCount,
      verified.doi, verified.doi,
      idSrc
    );
  } catch {
    /* verification is best-effort */
  }
  return NextResponse.json({ ...src, ...verified }, { status: 201 });
}
