import { NextResponse } from "next/server";
import { chatJson, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject, rowToSource } from "@/lib/api";
import { citationScanMessages } from "@/lib/prompts";
import { safeError, stripHtml } from "@/lib/util";

/**
 * Citation scan: find factual claims that lack citations and could be
 * supported by the project library. Returns opportunities with a suggested
 * sourceId (from the library) so the client can insert the token.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const u = await apiUser();
  if ("res" in u) return u.res;
  const proj = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, u.user.id) as any;
  if (!proj) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  const settings = getAiSettings(u.user.id);
  if (!settings) return NextResponse.json({ error: "API key belum diset — buka Settings." }, { status: 400 });
  const sources = (db.prepare("SELECT * FROM sources WHERE project_id = ?").all(id) as any[]).map((r) => rowToSource(r));

  const scope = String(body.scope || "all");
  let content = "";
  let sectionTitle = "";
  let scannedCount = 0;
  if (scope === "all") {
    const secs = (db.prepare("SELECT title, content FROM sections WHERE project_id = ? AND content != '' ORDER BY \"order\"").all(id) as any[]);
    scannedCount = secs.length;
    content = secs.map((s) => s.content).join("\n").slice(0, 30000);
    sectionTitle = "Seluruh Dokumen";
  } else {
    const sec = db.prepare("SELECT * FROM sections WHERE id = ? AND project_id = ?").get(scope, id) as any;
    if (!sec) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });
    scannedCount = 1;
    content = sec.content;
    sectionTitle = sec.title;
  }

  if (stripHtml(content).length < 20) {
    return NextResponse.json({ scope, scopeLabel: scope === "all" ? "Seluruh Dokumen" : sectionTitle, scannedCount, opportunities: [], message: "Tidak ada teks yang cukup untuk dipindai pada cakupan ini (minimal 20 karakter)." });
  }

  try {
    const res = await chatJson<any>(settings, citationScanMessages(rowToProject(proj), content, sectionTitle, sources), {
      temperature: 0.2,
      maxTokens: 3000,
    });
    // Keep only opportunities that map to a real library id
    const allowed = new Set(sources.map((s) => s.id));
    const opportunities = (res.opportunities || [])
      .map((o: any) => ({
        quote: String(o.quote || "").slice(0, 300),
        sourceId: allowed.has(o.sourceId) ? o.sourceId : null,
        reason: String(o.reason || "").slice(0, 300),
      }))
      .filter((o: any) => o.quote);
    return NextResponse.json({ scope, scopeLabel: scope === "all" ? "Seluruh Dokumen" : sectionTitle, scannedCount, opportunities });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Scan sitasi gagal.") }, { status: 502 });
  }
}
