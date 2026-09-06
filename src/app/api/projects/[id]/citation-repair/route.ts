import { NextResponse } from "next/server";
import { chatJson, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiProject, rowToProject, rowToSource } from "@/lib/api";
import { searchOpenAlex } from "@/lib/cite";
import { safeError } from "@/lib/util";

/**
 * Citation repair: for sources that are NOT_FOUND / metadata-only, attempt to
 * re-find them on OpenAlex and propose keep/update/remove actions.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;
  const settings = getAiSettings(r.user.id);

  const rows = (db.prepare("SELECT * FROM sources WHERE project_id = ?").all(id) as any[]);
  const sources = rows.map((x) => rowToSource(x) as any);
  const problematic = sources.filter((s) => s.verified !== "VERIFIED");

  if (!problematic.length) {
    return NextResponse.json({ message: "Semua sumber sudah terverifikasi.", repairs: [] });
  }

  // Try OpenAlex re-search for each problematic source
  const repairs: any[] = [];
  for (const s of problematic.slice(0, 6)) {
    try {
      const found = await searchOpenAlex(s.title, { limit: 1 });
      if (found.length) {
        const best = found[0];
        const better = best.citationCount && (!s.citationCount || best.citationCount > s.citationCount);
        db.prepare(
          `UPDATE sources SET verified='VERIFIED', doi = CASE WHEN ? != '' THEN ? ELSE doi END,
           journal = CASE WHEN ? != '' THEN ? ELSE journal END, year = COALESCE(?, year),
           citation_count = COALESCE(?, citation_count), abstract = CASE WHEN ? != '' THEN ? ELSE abstract END
           WHERE id = ?`
        ).run(best.doi, best.doi, best.journal, best.journal, best.year, best.citationCount, best.abstract, best.abstract, s.id);
        repairs.push({ title: s.title, action: "update", suggestion: `Ditemukan ulang: ${best.title} (${best.year}) — metadata diperbarui.`, matched: best });
      } else {
        repairs.push({ title: s.title, action: "keep", suggestion: "Tidak ditemukan sumber yang cukup mirip. Pertimbangkan verifikasi manual." });
      }
    } catch {
      repairs.push({ title: s.title, action: "keep", suggestion: "Pencarian ulang gagal (jaringan). Coba lagi nanti." });
    }
  }

  return NextResponse.json({ repairs });
}
