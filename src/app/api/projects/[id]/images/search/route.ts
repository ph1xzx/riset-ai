import { NextResponse } from "next/server";
import { apiProject } from "@/lib/api";
import { safeError } from "@/lib/util";

/**
 * Web image search (no API key) via Wikimedia Commons — mirrors the live app
 * endpoint: POST { query } → { results: [{ title, url, source }] }.
 */
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
  const query = String(body.query || "").trim();
  if (!query) return NextResponse.json({ error: "Query wajib diisi" }, { status: 400 });

  try {
    const api =
      "https://commons.wikimedia.org/w/api.php?action=query&format=json" +
      "&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=" +
      encodeURIComponent(query) +
      "&prop=imageinfo&iiprop=url%7Csize%7Cmime&iiurlwidth=960";
    const res = await fetch(api, {
      headers: { "User-Agent": "RisetAI/1.0 (contact: admin@riset-ai.local)" },
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data: any = await res.json();
    const pages: any[] = Object.values(data?.query?.pages || {});
    pages.sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const results = pages
      .filter((p) => p.imageinfo?.[0]?.thumburl)
      .map((p) => ({
        title: (p.title || "").replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, ""),
        url: p.imageinfo[0].thumburl,
        fullUrl: p.imageinfo[0].url,
        mime: p.imageinfo[0].mime || "image/jpeg",
        width: p.imageinfo[0].width || 0,
        height: p.imageinfo[0].height || 0,
        source: "Wikimedia Commons",
      }));
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: safeError(e, "Pencarian gambar gagal.") }, { status: 502 });
  }
}
