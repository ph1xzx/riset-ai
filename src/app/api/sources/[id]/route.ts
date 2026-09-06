import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser, rowToSource } from "@/lib/api";
import { verifySource } from "@/lib/cite";
import { nowIso } from "@/lib/util";

async function owned(userId: string, id: string) {
  const row = db
    .prepare("SELECT s.*, p.user_id FROM sources s JOIN projects p ON p.id = s.project_id WHERE s.id = ?")
    .get(id) as any;
  if (!row) return { res: NextResponse.json({ error: "Sumber tidak ditemukan" }, { status: 404 }) };
  if (row.user_id !== userId) return { res: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }) };
  return { row };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const o = await owned(u.user.id, id);
  if ("res" in o) return (o as any).res;
  return NextResponse.json(rowToSource((o as any).row));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const o = await owned(u.user.id, id);
  if ("res" in o) return (o as any).res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const sets: string[] = [];
  const vals: any[] = [];
  const map: Record<string, string> = {
    title: "title", journal: "journal", doi: "doi", abstract: "abstract",
    url: "url", pdfUrl: "pdf_url",
  };
  for (const [k, col] of Object.entries(map)) {
    if (body[k] !== undefined) {
      sets.push(`${col} = ?`);
      vals.push(String(body[k]).slice(0, 4000));
    }
  }
  if (body.authors !== undefined) {
    sets.push("authors = ?");
    vals.push(JSON.stringify(Array.isArray(body.authors) ? body.authors : []));
  }
  if (body.year !== undefined) {
    sets.push("year = ?");
    vals.push(body.year ? Number(body.year) : null);
  }
  if (!sets.length) return NextResponse.json({ error: "Tidak ada field" }, { status: 400 });
  sets.push("updated_at_placeholder = NULL");
  db.prepare(`UPDATE sources SET ${sets.slice(0, -1).join(", ")} WHERE id = ?`).run(...vals, id);
  const row = db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as any;
  return NextResponse.json(rowToSource(row));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const o = await owned(u.user.id, id);
  if ("res" in o) return (o as any).res;
  db.prepare("DELETE FROM sources WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

/** Re-verify a source against Crossref/OpenAlex. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const u = await apiUser();
  if ("res" in u) return u.res;
  const o = await owned(u.user.id, id);
  if ("res" in o) return (o as any).res;
  const src = rowToSource((o as any).row) as any;
  let updated = src;
  try {
    updated = await verifySource(src);
  } catch (e: any) {
    return NextResponse.json({ error: safeMsg(e) }, { status: 502 });
  }
  db.prepare(
    `UPDATE sources SET verified = ?, authors = ?, year = COALESCE(?, year),
     journal = CASE WHEN ? != '' THEN ? ELSE journal END,
     citation_count = COALESCE(?, citation_count), doi = CASE WHEN ? != '' THEN ? ELSE doi END
     WHERE id = ?`
  ).run(updated.verified, JSON.stringify(updated.authors), updated.year, updated.journal, updated.journal,
    updated.citationCount, updated.doi, updated.doi, id);
  return NextResponse.json({ ...src, ...updated });
}

function safeMsg(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.length > 200 ? "Verifikasi gagal, coba lagi" : m;
}
