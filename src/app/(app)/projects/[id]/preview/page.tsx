"use client";
import { useLayoutEffect, useMemo, useRef, useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ZoomIn, ZoomOut, Printer, Loader2 } from "lucide-react";
import { normalizeTableHtml } from "@/lib/table-format";

/* ============ ukuran A4 @96dpi ============ */
const CM = 37.795;
const PAGE_W = 794;
const PAGE_H = 1123;

type Blk = { kind: string; html: string; gapBefore: number; gapAfter: number; breakBefore?: boolean };

const ROMAN_MAP: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
function toRoman(n: number): string {
  let out = "";
  for (const [v, s] of ROMAN_MAP) while (n >= v) { out += s; n -= v; }
  return out;
}

/* scan tag list berpasangan (nested-aware) — sama seperti mesin export */
function scanList(src: string, from: number): number {
  const re = /<(\/?)(?:ul|ol)\b[^>]*>/gi;
  re.lastIndex = from;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m[1]) { depth--; if (depth === 0) return re.lastIndex; }
    else depth++;
  }
  return src.length;
}

/* HTML section → blok-blok untuk paginasi */
function contentToBlocks(html: string): Blk[] {
  const out: Blk[] = [];
  const re =
    /<table[\s\S]*?<\/table>|<blockquote[\s\S]*?<\/blockquote>|<h3[^>]*>[\s\S]*?<\/h3>|<p\b[^>]*>[\s\S]*?<\/p>|<ul\b[^>]*>|<ol\b[^>]*>|<img\b[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const b = m[0];
    if (/^<(?:ul|ol)\b/i.test(b)) {
      const end = scanList(html, m.index);
      out.push({ kind: "list", html: html.slice(m.index, end), gapBefore: 0, gapAfter: 8 });
      re.lastIndex = end;
    } else if (/^<table/i.test(b)) out.push({ kind: "table", html: normalizeTableHtml(b), gapBefore: 8, gapAfter: 16 });
    else if (/^<blockquote/i.test(b)) out.push({ kind: "quote", html: b, gapBefore: 0, gapAfter: 0 });
    else if (/^<h3/i.test(b)) out.push({ kind: "h3", html: b, gapBefore: 12, gapAfter: 6 });
    else if (/^<img/i.test(b)) out.push({ kind: "img", html: b, gapBefore: 0, gapAfter: 8 });
    else {
      const txt = b.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
      const hasImg = /<img\b/i.test(b);
      if (!txt && !hasImg) continue; // paragraf kosong
      out.push({ kind: "p", html: b, gapBefore: 0, gapAfter: 0 });
    }
  }
  return out;
}

export default function WordPreviewPage() {
  const params = useParams();
  const [project, setProject] = useState<any>(null);
  const [zoom, setZoom] = useState(0.75);
  const [pages, setPages] = useState<Blk[][] | null>(null);
  const [firstBabPage, setFirstBabPage] = useState(-1);
  const measRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/projects/${params.id}`).then((r) => r.json()).then(setProject).catch(() => {});
  }, [params.id]);

  const style = useMemo(() => {
    const base = { pageSize: "A4", margins: { top: 4, right: 3, bottom: 3, left: 4 }, body: { font: "Times New Roman", size: 12, lineSpacing: 2, firstLineIndentMm: 12.7 } };
    try { return { ...base, ...JSON.parse(project?.campusStyle || "{}") }; } catch { return base; }
  }, [project]);

  const M = {
    top: Math.round((style.margins?.top ?? 4) * CM),
    right: Math.round((style.margins?.right ?? 3) * CM),
    bottom: Math.round((style.margins?.bottom ?? 3) * CM),
    left: Math.round((style.margins?.left ?? 4) * CM),
  };
  const CONTENT_W = PAGE_W - M.left - M.right;
  const CONTENT_H = PAGE_H - M.top - M.bottom;
  const FONT_PX = Math.round((style.body?.size ?? 12) * (96 / 72));
  const LINE_PX = Math.round(FONT_PX * (style.body?.lineSpacing ?? 2));
  const INDENT_PX = Math.round(((style.body?.firstLineIndentMm ?? 12.7) / 25.4) * 96);

  /* susun daftar blok seluruh dokumen */
  const blocks = useMemo<Blk[]>(() => {
    if (!project) return [];
    const out: Blk[] = [{ kind: "cover", html: "", gapBefore: 0, gapAfter: 0 }];
    for (const s of project.sections || []) {
      if (s.level === 1) {
        if (s.title !== "(Bagian awal)")
          out.push({ kind: "h1", html: s.title, gapBefore: 0, gapAfter: 96, breakBefore: true });
      } else {
        out.push({ kind: "h2", html: s.title, gapBefore: 16, gapAfter: 8 });
      }
      out.push(...contentToBlocks(s.content || ""));
    }
    return out;
  }, [project]);

  /* ukur tinggi blok → paginasi greedy (h1 = halaman baru) */
  useLayoutEffect(() => {
    if (!blocks.length || !measRef.current) return;
    const host = measRef.current;
    const packed: Blk[][] = [];
    let cur: Blk[] = [];
    let curH = 0;
    let babIdx = -1;
    const heights = Array.from(host.children).map((el) => (el as HTMLElement).offsetHeight);
    blocks.forEach((b, i) => {
      const h = heights[i] + b.gapBefore + b.gapAfter;
      if (b.breakBefore && cur.length) { packed.push(cur); cur = []; curH = 0; }
      if (curH + h > CONTENT_H && cur.length) { packed.push(cur); cur = []; curH = 0; }
      cur.push(b);
      curH += h;
      if (b.kind === "h1" && babIdx === -1) babIdx = packed.length; // halaman BAB pertama (0-based, cover = 0)
    });
    if (cur.length) packed.push(cur);
    setPages(packed);
    setFirstBabPage(babIdx);
  }, [blocks, CONTENT_H]);

  function renderBlock(b: Blk, i: number) {
    const s: any = { marginTop: b.gapBefore, marginBottom: b.gapAfter };
    if (b.kind === "cover") {
      return (
        <div key={i} style={{ textAlign: "center", marginTop: Math.round(CONTENT_H * 0.12) }}>
          <div style={{ fontWeight: "bold", fontSize: FONT_PX + 2, lineHeight: `${LINE_PX}px`, textTransform: "uppercase" }}>
            {project?.title}
          </div>
          <div style={{ marginTop: LINE_PX, fontWeight: "bold", fontSize: FONT_PX, lineHeight: `${LINE_PX}px` }}>SKRIPSI</div>
          <div style={{ marginTop: LINE_PX * 2, fontSize: FONT_PX, lineHeight: `${LINE_PX}px` }}>{project?.type}</div>
        </div>
      );
    }
    if (b.kind === "h1") {
      const m = b.html.match(/^BAB\s+([IVXLCDM0-9]+)\s*(.*)$/i);
      return (
        <div key={i} className="wp-h1" style={{ ...s, fontSize: FONT_PX }}>
          {m ? (
            <>
              <div>BAB {m[1].toUpperCase()}</div>
              <div>{m[2]}</div>
            </>
          ) : (
            <div>{b.html.toUpperCase()}</div>
          )}
        </div>
      );
    }
    if (b.kind === "h2")
      return <div key={i} className="wp-h2" style={{ ...s, fontSize: FONT_PX }} dangerouslySetInnerHTML={{ __html: b.html }} />;
    return <div key={i} style={s} dangerouslySetInnerHTML={{ __html: b.html }} />;
  }

  const total = pages?.length || 0;

  return (
    <div className="fixed inset-0 z-50 bg-[#525659] overflow-y-auto" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      <style>{`
        .wp-body { font-family: 'Times New Roman', Times, serif; color: #111; }
        .wp-body p { margin: 0; text-align: justify; line-height: ${LINE_PX}px; text-indent: ${INDENT_PX}px; }
        .wp-body h3 { margin: 0; font-weight: normal; line-height: ${LINE_PX}px; text-align: left; text-indent: 0; }
        .wp-body blockquote { margin: 0; font-style: italic; text-align: justify; padding: 0 48px; line-height: ${LINE_PX}px; }
        .wp-body table { border-collapse: collapse; margin: 0 auto; width: 100%; max-width: 100%; table-layout: fixed; }
        .wp-body td, .wp-body th { border: 1px solid #444; padding: 3px 8px; font-size: ${FONT_PX - 2}px; line-height: ${Math.round(LINE_PX * 0.62)}px; overflow-wrap: anywhere; word-break: break-word; }
        .wp-body th { background: #e8edf3; font-weight: bold; text-align: center; }
        .wp-body img { display: block; margin: 0 auto; max-width: 100%; }
        .wp-body ul, .wp-body ol { margin: 0; padding-left: 48px; line-height: ${LINE_PX}px; }
        .wp-body ul ul, .wp-body ol ol, .wp-body ul ol, .wp-body ol ul { padding-left: 32px; }
        .wp-body li { text-align: justify; }
        .wp-h1 { text-align: center; font-weight: bold; line-height: ${LINE_PX}px; text-transform: uppercase; }
        .wp-h2 { font-weight: bold; line-height: ${LINE_PX}px; text-align: left; text-indent: 0; }
        @media print {
          .wp-toolbar { display: none !important; }
          .wp-scroll { background: #fff !important; overflow: visible !important; position: static !important; }
          .wp-page { box-shadow: none !important; margin: 0 !important; page-break-after: always; }
          .wp-zoomwrap { transform: none !important; width: auto !important; height: auto !important; }
        }
      `}</style>

      {/* toolbar ala Word */}
      <div className="wp-toolbar fixed top-0 inset-x-0 z-10 h-12 bg-[#2b579a] text-white flex items-center gap-3 px-4 shadow-md">
        <Link href={`/projects/${params.id}`} className="flex items-center gap-1.5 text-sm hover:underline">
          <ArrowLeft size={15} /> Kembali ke editor
        </Link>
        <div className="text-sm font-semibold truncate max-w-[340px]">{project?.title || "Pratinjau"}</div>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <button className="p-1.5 rounded hover:bg-white/15" onClick={() => setZoom((z) => Math.max(0.4, +(z - 0.1).toFixed(2)))}>
            <ZoomOut size={15} />
          </button>
          <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button className="p-1.5 rounded hover:bg-white/15" onClick={() => setZoom((z) => Math.min(1.6, +(z + 0.1).toFixed(2)))}>
            <ZoomIn size={15} />
          </button>
          <span className="opacity-80">{total ? `Halaman ${total}` : "…"}</span>
          <button className="p-1.5 rounded hover:bg-white/15" onClick={() => window.print()} title="Cetak / simpan PDF">
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* area halaman */}
      <div className="wp-scroll pt-16 pb-12 flex justify-center">
        {!pages ? (
          <div className="text-white/80 flex items-center gap-2 mt-24">
            <Loader2 className="animate-spin" size={18} /> Menyusun halaman…
          </div>
        ) : (
          <div style={{ width: PAGE_W * zoom }}>
            {pages.map((pg, pi) => {
              const isCover = pi === 0;
              const isFront = firstBabPage > 0 && pi < firstBabPage;
              const arabic = pi - (firstBabPage > 0 ? firstBabPage - 1 : 0);
              const hasBab = pg.some((b) => b.kind === "h1");
              const label = isFront ? toRoman(pi) : String(arabic);
              const bottom = isCover ? false : isFront || hasBab; // awal bab & front: tengah bawah
              return (
                <div key={pi} className="wp-zoomwrap" style={{ width: PAGE_W * zoom, height: PAGE_H * zoom, marginBottom: 18 }}>
                  <div
                    className="wp-page wp-body"
                    style={{
                      width: PAGE_W,
                      height: PAGE_H,
                      padding: `${M.top}px ${M.right}px ${M.bottom}px ${M.left}px`,
                      background: "#fff",
                      position: "relative",
                      overflow: "hidden",
                      boxShadow: "0 2px 10px rgba(0,0,0,.4)",
                      transform: `scale(${zoom})`,
                      transformOrigin: "top left",
                      fontSize: FONT_PX,
                    }}
                  >
                    {pg.map(renderBlock)}
                    {!isCover && (
                      <div
                        style={{
                          position: "absolute",
                          fontSize: FONT_PX - 2,
                          ...(bottom
                            ? { bottom: Math.round(M.bottom / 2), left: 0, right: 0, textAlign: "center" }
                            : { top: Math.round(M.top / 2.6), right: M.right }),
                        }}
                      >
                        {label}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* wadah pengukuran tersembunyi — lebar & style identik dengan halaman */}
      <div
        ref={measRef}
        aria-hidden
        className="wp-body"
        style={{ position: "absolute", top: -99999, left: 0, width: CONTENT_W, visibility: "hidden", fontSize: FONT_PX }}
      >
        {blocks.map((b, i) => (
          <div key={i}>
            {b.kind === "cover" ? (
              <div style={{ height: 200 }} />
            ) : b.kind === "h1" ? (
              <div className="wp-h1" style={{ fontSize: FONT_PX }}>
                <div>BAB</div>
                <div>X</div>
              </div>
            ) : b.kind === "h2" ? (
              <div className="wp-h2" style={{ fontSize: FONT_PX }} dangerouslySetInnerHTML={{ __html: b.html }} />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: b.html }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
