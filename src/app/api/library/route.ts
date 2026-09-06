import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";
import { genId, nowIso } from "@/lib/util";

function shape(r: any) {
  return {
    id: r.id, title: r.title, authors: safe(r.authors), year: r.year,
    journal: r.journal, doi: r.doi, abstract: r.abstract, url: r.url,
    citationCount: r.citation_count, openAccess: !!r.open_access,
    provider: r.provider, keywords: safe(r.keywords), addedAt: r.added_at,
  };
}
function safe(v: string): any {
  try { return JSON.parse(v); } catch { return []; }
}

export async function GET() {
  const u = await apiUser();
  if ("res" in u) return u.res;
  const rows = db.prepare("SELECT * FROM library WHERE user_id = ? ORDER BY added_at DESC LIMIT 200").all(u.user.id) as any[];
  return NextResponse.json({ items: rows.map(shape) });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const title = String(body.title || "").trim();
  if (!title) return NextResponse.json({ error: "Judul wajib diisi" }, { status: 400 });
  const id = genId("lib");
  db.prepare(
    `INSERT INTO library (id, user_id, title, authors, year, journal, doi, abstract, url, citation_count, open_access, provider, keywords, added_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id, u.user.id, title,
    JSON.stringify(Array.isArray(body.authors) ? body.authors : []),
    body.year ? Number(body.year) : null,
    String(body.journal || "").slice(0, 300),
    String(body.doi || "").replace(/^https?:\/\/doi\.org\//, "").slice(0, 120),
    String(body.abstract || "").slice(0, 4000),
    String(body.url || "").slice(0, 500),
    body.citationCount != null ? Number(body.citationCount) : null,
    body.openAccess ? 1 : 0,
    String(body.provider || "openalex").slice(0, 40),
    JSON.stringify(Array.isArray(body.keywords) ? body.keywords : []),
    nowIso()
  );
  const row = db.prepare("SELECT * FROM library WHERE id = ?").get(id) as any;
  return NextResponse.json(shape(row), { status: 201 });
}
