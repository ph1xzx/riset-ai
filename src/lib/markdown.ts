// Konversi dua arah: HTML section aplikasi <-> Markdown modular (per bab),
// plus manifest.json untuk paket export/import.
import { normalizeTableHtml } from "./table-format";

export type ManifestAsset = { key: string; filename: string; status: "uploaded" | "missing" };
export type Manifest = {
  project_title: string;
  build_config: {
    font_family: string;
    font_size_body: number;
    line_spacing: number;
    margins_cm: { top: number; left: number; bottom: number; right: number };
  };
  chapters: { order: number; file_name: string; title: string }[];
  required_assets: ManifestAsset[];
};

const dec = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function slugFile(title: string): string {
  const t = title
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `DRAFT-${t || "BAB"}.md`;
}

/* ---------------- inline HTML -> markdown ---------------- */
function inlineToMd(html: string): string {
  let out = "";
  const re = /<[^>]+>|[^<]+/g;
  let m: RegExpExecArray | null;
  const stack: string[] = [];
  while ((m = re.exec(html)) !== null) {
    const tok = m[0];
    if (tok === "<strong>" || tok === "<b>") { out += "**"; stack.push("**"); }
    else if (tok === "</strong>" || tok === "</b>") { out += stack.pop() ?? "**"; }
    else if (tok === "<em>" || tok === "<i>") { out += "*"; stack.push("*"); }
    else if (tok === "</em>" || tok === "</i>") { out += stack.pop() ?? "*"; }
    else if (tok === "<code>") { out += "`"; stack.push("`"); }
    else if (tok === "</code>") { out += stack.pop() ?? "`"; }
    else if (tok === "<br>" || tok === "<br/>") out += "\n";
    else if (tok.startsWith("<")) continue;
    else out += dec(tok);
  }
  return out.replace(/[ \t]+\n/g, "\n").trim();
}

/* ---------------- HTML section -> markdown ----------------
   mapImg(src, alt) mengembalikan path markdown untuk gambar,
   mis. "assets/08-arsitektur.png" atau URL absolut bila tak bisa dibundel. */

/* scan tag berpasangan sampai penutup seimbang (nested-aware) */
function scanBalanced(
  src: string,
  openRe: RegExp,
  closeRe: RegExp,
  from: number
): { closeStart: number; end: number } {
  const re = new RegExp(`${openRe.source}|${closeRe.source}`, "gi");
  re.lastIndex = from;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (/^\s*<\//.test(m[0])) {
      depth -= 1;
      if (depth === 0) return { closeStart: m.index, end: re.lastIndex };
    } else depth += 1;
  }
  return { closeStart: src.length, end: src.length };
}

const MD_LIST_OPEN = /<(?:ul|ol)\b[^>]*>/i;
const MD_LIST_CLOSE = /<\/(?:ul|ol)\s*>/i;
const MD_LI_OPEN = /<li\b[^>]*>/i;
const MD_LI_CLOSE = /<\/li\s*>/i;

/** Rekursi list bersarang → baris markdown ber-indent (2 spasi/level). */
function listToMd(listHtml: string, depth: number, out: string[], mapImg: (src: string, alt: string) => string) {
  const ordered = /^\s*<ol/i.test(listHtml);
  const inner = listHtml.replace(/^\s*<(?:ul|ol)\b[^>]*>/i, "").replace(/<\/(?:ul|ol)\s*>\s*$/i, "");
  const liRe = /<li\b[^>]*>/gi;
  let counter = 0;
  let lm: RegExpExecArray | null;
  while ((lm = liRe.exec(inner)) !== null) {
    const before = inner.slice(0, lm.index);
    const depthHere =
      (before.match(/<(?:ul|ol)\b[^>]*>/gi) || []).length -
      (before.match(/<\/(?:ul|ol)\s*>/gi) || []).length;
    if (depthHere !== 0) continue; // item anak — diproses rekursi induknya
    const { closeStart, end } = scanBalanced(inner, MD_LI_OPEN, MD_LI_CLOSE, lm.index);
    const content = inner.slice(lm.index + lm[0].length, closeStart);
    let own = "";
    const nested: string[] = [];
    const lsRe = /<(?:ul|ol)\b[^>]*>/gi;
    let sm: RegExpExecArray | null;
    let i = 0;
    while ((sm = lsRe.exec(content)) !== null) {
      if (sm.index < i) continue;
      const reg = scanBalanced(content, MD_LIST_OPEN, MD_LIST_CLOSE, sm.index);
      own += content.slice(i, sm.index);
      nested.push(content.slice(sm.index, reg.end));
      i = reg.end;
      lsRe.lastIndex = reg.end;
    }
    own += content.slice(i);
    counter += 1;
    const pad = "  ".repeat(depth);
    out.push(`${pad}${ordered ? `${counter}.` : "-"} ${inlineToMd(own).trim()}`);
    for (const nd of nested) listToMd(nd, depth + 1, out, mapImg);
    liRe.lastIndex = end;
  }
}

export function htmlToMarkdown(html: string, mapImg: (src: string, alt: string) => string): string {
  const out: string[] = [];
  const blockRe =
    /<table[\s\S]*?<\/table>|<blockquote[\s\S]*?<\/blockquote>|<h3[^>]*>[\s\S]*?<\/h3>|<p\b[^>]*>[\s\S]*?<\/p>|<li\b[^>]*>[\s\S]*?<\/li>|<ol\b[^>]*>|<ul\b[^>]*>|<\/ol>|<\/ul>|<img\b[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(html)) !== null) {
    const blk = m[0];
    if (/^<table/i.test(blk)) {
      const normalizedTable = normalizeTableHtml(blk);
      const rows: string[][] = [];
      const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
      let trm: RegExpExecArray | null;
      while ((trm = trRe.exec(normalizedTable)) !== null) {
        const cells: string[] = [];
        const tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let tdm: RegExpExecArray | null;
        while ((tdm = tdRe.exec(trm[1])) !== null) cells.push(inlineToMd(tdm[1]).replace(/\|/g, "\\|").replace(/\n/g, " "));
        if (cells.length) rows.push(cells);
      }
      if (rows.length) {
        const w = Math.max(...rows.map((r) => r.length));
        const norm = rows.map((r) => [...r, ...Array(Math.max(0, w - r.length)).fill("")]);
        out.push(
          "| " + norm[0].join(" | ") + " |",
          "| " + norm[0].map(() => "---").join(" | ") + " |",
          ...norm.slice(1).map((r) => "| " + r.join(" | ") + " |"),
          ""
        );
      }
      continue;
    }
    if (/^<h3/i.test(blk)) {
      out.push(`### ${inlineToMd(blk.replace(/^<h3[^>]*>/i, "").replace(/<\/h3>$/i, ""))}`, "");
      continue;
    }
    if (/^<blockquote/i.test(blk)) {
      const inner = blk.replace(/<\/?blockquote[^>]*>/gi, "").replace(/<\/?p[^>]*>/gi, " ");
      out.push(
        ...inlineToMd(inner)
          .split("\n")
          .map((l) => `> ${l}`),
        ""
      );
      continue;
    }
    if (/^<(?:ul|ol)\b/i.test(blk)) {
      // proses list utuh nested-aware, lalu lompati region-nya
      const region = scanBalanced(html, MD_LIST_OPEN, MD_LIST_CLOSE, m.index);
      const lines: string[] = [];
      listToMd(html.slice(m.index, region.end), 0, lines, mapImg);
      out.push(...lines, "");
      blockRe.lastIndex = region.end;
      continue;
    }
    if (/^<\/(?:ol|ul)\s*>|^<li\b/i.test(blk)) continue; // fragmen sisa — list sudah diproses utuh
    if (/^<img/i.test(blk)) {
      const src = blk.match(/src="([^"]+)"/i)?.[1] || "";
      const alt = dec(blk.match(/alt="([^"]*)"/i)?.[1] || "");
      out.push(`![${alt}](${mapImg(src, alt)})`, "");
      continue;
    }
    // <p>
    const inner = blk.replace(/^<p\b[^>]*>/i, "").replace(/<\/p>$/i, "");
    const imgs: string[] = [];
    const cleaned = inner.replace(/<img\b[^>]*>/gi, (im) => {
      const src = im.match(/src="([^"]+)"/i)?.[1] || "";
      const alt = dec(im.match(/alt="([^"]*)"/i)?.[1] || "");
      imgs.push(`![${alt}](${mapImg(src, alt)})`);
      return " ";
    });
    const text = inlineToMd(cleaned);
    if (text) out.push(text, "");
    out.push(...imgs.map((i) => i + "\n"));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/* ---------------- markdown -> sections (level 1..6 + html) ---------------- */
export type MdSection = { title: string; level: number; html: string };

function splitMarkdownCells(line: string): string[] {
  const body = line.trim().replace(/^\||\|$/g, "");
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === "\\" && body[i + 1] === "|") {
      current += "|";
      i++;
    } else if (char === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function inlineToHtml(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function markdownToSections(md: string): MdSection[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const sections: MdSection[] = [];
  let cur: MdSection | null = null;
  const ensure = (title: string, level: number) => {
    cur = { title, level, html: "" };
    sections.push(cur);
  };
  const push = (html: string) => {
    if (!cur) ensure("(Bagian awal)", 1);
    cur!.html += html;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const text = h[2].trim();
      ensure(text, Math.min(level, 6));
      i++;
      continue;
    }
    // tabel pipe
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[i + 1])) {
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) {
        const cells = splitMarkdownCells(lines[i]);
        if (!/^\s*:?-{2,}:?\s*$/.test(cells[0] ?? "") || cells.some((c) => c && !/^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length) {
        const width = Math.max(...rows.map((row) => row.length));
        const padded = rows.map((row) => [...row, ...Array(Math.max(0, width - row.length)).fill("")]);
        let html = "<table><tbody>";
        padded.forEach((r, ri) => {
          html += "<tr>";
          for (const c of r) html += ri === 0 ? `<th>${inlineToHtml(esc(c))}</th>` : `<td>${inlineToHtml(esc(c))}</td>`;
          html += "</tr>";
        });
        html += "</tbody></table>";
        push(html);
      }
      continue;
    }
    // list
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      push(`<${tag}>` + items.map((it) => `<li>${inlineToHtml(esc(it))}</li>`).join("") + `</${tag}>`);
      continue;
    }
    // gambar markdown
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      push(`<p><img src="${esc(img[2])}" alt="${esc(img[1])}" /></p>`);
      i++;
      continue;
    }
    // paragraf (gabung baris beruntun)
    if (line.trim()) {
      const buf = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !/^(#|\||!|\s*[-*]|\s*\d+\.)\s?/.test(lines[i])) {
        buf.push(lines[i].trim());
        i++;
      }
      push(`<p>${inlineToHtml(esc(buf.join(" ")))}</p>`);
      continue;
    }
    i++;
  }
  return sections;
}

/* ---------------- smart asset resolver: kemiripan nama file ---------------- */
function lev(a: string, b: string): number {
  const n = a.length, m = b.length;
  if (!n || !m) return n || m;
  let prev = Array.from({ length: m + 1 }, (_, j) => j);
  for (let i = 1; i <= n; i++) {
    const cur = [i, ...new Array(m).fill(0)];
    for (let j = 1; j <= m; j++)
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[m];
}

export function assetSimilarity(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/\.[a-z0-9]+$/, "").replace(/[^a-z0-9]+/g, " ").trim();
  const ta = new Set(norm(a).split(" ").filter(Boolean));
  const tb = new Set(norm(b).split(" ").filter(Boolean));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const jac = ta.size && tb.size ? inter / (ta.size + tb.size - inter) : 0;
  const la = norm(a).replace(/\s/g, "");
  const lb = norm(b).replace(/\s/g, "");
  const sim = 1 - lev(la, lb) / Math.max(la.length, lb.length, 1);
  return Math.max(jac, sim * 0.9);
}

export function suggestCandidates(
  filename: string,
  pool: string[],
  top = 3
): { name: string; score: number }[] {
  return pool
    .map((p) => ({ name: p, score: assetSimilarity(filename, p) }))
    .filter((x) => x.score > 0.3)
    .sort((x, y) => y.score - x.score)
    .slice(0, top);
}

/* ---------------- scan referensi gambar dari markdown ---------------- */

export function scanImageRefs(md: string): { key: string; filename: string }[] {
  const out: { key: string; filename: string }[] = [];
  const re = /!\[([^\]]*)\]\(([^)]+)\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const path = m[2].trim();
    if (/^https?:\/\//i.test(path)) continue; // URL absolut bukan aset bundel
    const filename = path.split("/").pop() || path;
    out.push({ key: m[1] || filename, filename });
  }
  return out;
}
