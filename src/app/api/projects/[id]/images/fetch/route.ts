import { NextResponse } from "next/server";
import { apiProject } from "@/lib/api";
import { safeError } from "@/lib/util";
import fs from "fs";
import path from "path";

const STORAGE_DIR = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");

/**
 * Fetch a tool/brand logo from the web WITHOUT an API key.
 * Strategy: DuckDuckGo image API is keyless-limited, so we use public
 * logo/CDN endpoints (jsdelivr, worldvectorlogo) + Google favicon service as
 * fallback, then cache locally. Works for common dev tools (XAMPP, PHP,
 * VS Code, MySQL, etc.).
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
  const query = String(body.query || "").trim().toLowerCase();
  if (!query) return NextResponse.json({ error: "Query wajib diisi" }, { status: 400 });

  const candidates = logoCandidates(query);
  if (!candidates.length) {
    return NextResponse.json({ error: `Logo "${query}" tidak dikenal. Coba nama tool (mis. php, vs code, mysql).` }, { status: 404 });
  }

  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (RisetAI logo fetcher)" },
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const ctype = res.headers.get("content-type") || "";
      if (!/^image\//.test(ctype)) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 500) continue; // too small / placeholder
      const ext = ctype.includes("png") ? "png" : ctype.includes("svg") ? "svg" : ctype.includes("webp") ? "webp" : "jpg";
      const name = `logo-${query.replace(/[^a-z0-9]+/g, "-")}-${Date.now()}.${ext}`;
      fs.mkdirSync(STORAGE_DIR, { recursive: true });
      fs.writeFileSync(path.join(STORAGE_DIR, name), buf);
      return NextResponse.json({ url: `/files/${name}`, source: url });
    } catch {
      /* try next */
    }
  }
  return NextResponse.json({ error: "Gagal mengambil logo dari web (semua sumber tidak responsif). Coba lagi." }, { status: 502 });
}

/** Ordered list of keyless logo URLs for a tool name. */
function logoCandidates(q: string): string[] {
  const slug = q.replace(/[^a-z0-9]+/g, "").toLowerCase();
  const out: string[] = [];
  // jsDelivr simple-icons (SVG, keyless, reliable)
  const simple = {
    php: "Php", vscode: "Vscode", mysql: "Mysql", python: "Python",
    git: "Git", github: "Github", nodejs: "Nodejs", javascript: "Javascript",
    typescript: "Typescript", html: "Html5", css: "Css3", sqlite: "Sqlite",
    docker: "Docker", linux: "Linux", windows: "Windows", apple: "Apple",
  }[slug];
  if (simple) out.push(`https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/${simple.toLowerCase()}.svg`);
  // worldvectorlogo / other public CDN
  const map: Record<string, string[]> = {
    xampp: [
      "https://www.apachefriends.org/image/logo_xampp_medium.png",
      "https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/XAMPP_Logo.svg/240px-XAMPP_Logo.svg.png",
    ],
    "vs code": ["https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Visual_Studio_Code_1.35_icon.svg/240px-Visual_Studio_Code_1.35_icon.svg.png"],
    drawio: ["https://assets.draw.io/full_logo_h-128.png"],
    draw: ["https://assets.draw.io/full_logo_h-128.png"],
    "draw.io": ["https://assets.draw.io/full_logo_h-128.png"],
    apache: ["https://upload.wikimedia.org/wikipedia/commons/thumb/d/d8/Apache_Logo.svg/240px-Apache_Logo.svg.png"],
    mariadb: ["https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/MariaDB_logo.svg/240px-MariaDB_logo.svg.png"],
  };
  if (map[q]) out.push(...map[q]);
  // Generic fallback: Wikimedia search via the API (keyless)
  out.push(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q + " logo")}&format=json&srnamespace=6&srlimit=1`);
  return out;
}
