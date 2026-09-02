import { NextRequest, NextResponse } from "next/server";
import { searchPapers } from "@/lib/academic";

export const runtime = "nodejs";
export const maxDuration = 120;

// GET /api/papers/search?q=...&yearFrom=2023&yearTo=2026&minCitations=5&openAccess=1&preprint=1&limit=15
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const query = p.get("q") || "";
  if (!query.trim()) return NextResponse.json({ error: "query (q) wajib" }, { status: 400 });

  try {
    const { results, sources } = await searchPapers({
      query,
      yearFrom: p.get("yearFrom") ? Number(p.get("yearFrom")) : null,
      yearTo: p.get("yearTo") ? Number(p.get("yearTo")) : null,
      minCitations: p.get("minCitations") ? Number(p.get("minCitations")) : null,
      openAccess: p.get("openAccess") === "1",
      includePreprint: p.get("preprint") !== "0",
      limit: p.get("limit") ? Number(p.get("limit")) : 15,
    });
    return NextResponse.json({ results, sources });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 });
  }
}
