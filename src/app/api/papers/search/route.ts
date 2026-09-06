import { NextResponse } from "next/server";
import { apiUser } from "@/lib/api";
import { searchOpenAlex } from "@/lib/cite";
import { safeError } from "@/lib/util";

/**
 * /find-papers backend: search OpenAlex with project-style filters.
 * Query params: q, yearFrom, yearTo, limit
 */
export async function GET(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  if (!q.trim()) return NextResponse.json({ error: "Parameter q wajib diisi" }, { status: 400 });
  try {
    const results = await searchOpenAlex(q, {
      yearFrom: url.searchParams.get("yearFrom") ? Number(url.searchParams.get("yearFrom")) : null,
      yearTo: url.searchParams.get("yearTo") ? Number(url.searchParams.get("yearTo")) : null,
      limit: Math.min(25, Number(url.searchParams.get("limit")) || 10),
    });
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Pencarian paper gagal.") }, { status: 502 });
  }
}
