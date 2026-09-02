// Ekstraksi teks PDF via pdfjs-dist (resmi Mozilla) untuk fitur RAG.

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

// Server-side: tidak ada Web Worker asli — bundle worker dan daftarkan di
// globalThis.pdfjsWorker agar "fake worker" pdf.js tidak perlu resolve file.
let workerReady: Promise<void> | null = null;
function ensureWorker() {
  if (!workerReady) {
    workerReady = import("pdfjs-dist/legacy/build/pdf.worker.mjs").then((w) => {
      (globalThis as any).pdfjsWorker = w;
    });
  }
  return workerReady;
}

export type PdfResult = {
  text: string;
  numpages: number;
  info: { Title?: string; Author?: string };
};

async function pageText(page: any): Promise<string> {
  const tc = await page.getTextContent();
  // susun item jadi baris berdasarkan koordinat Y
  type Item = { str: string; x: number; y: number; h: number };
  const items: Item[] = tc.items
    .filter((i: any) => typeof i.str === "string")
    .map((i: any) => ({
      str: i.str,
      x: i.transform[4],
      y: i.transform[5],
      h: Math.abs(i.transform[3]) || 10,
    }));
  if (!items.length) return "";
  items.sort((a, b) => (Math.abs(b.y - a.y) > b.h * 0.6 ? b.y - a.y : a.x - b.x));

  let out = "";
  let lastY: number | null = null;
  for (const it of items) {
    if (lastY != null && Math.abs(it.y - lastY) > it.h * 0.6) out += "\n";
    else if (out && !out.endsWith("\n") && !out.endsWith(" ")) out += " ";
    out += it.str;
    lastY = it.y;
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export async function parsePdf(buffer: Buffer, maxPages = 200): Promise<PdfResult> {
  await ensureWorker();
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;
  const numpages = Math.min(doc.numPages, maxPages);
  let text = "";
  for (let i = 1; i <= numpages; i++) {
    const page = await doc.getPage(i);
    text += (text ? "\n\n" : "") + (await pageText(page));
  }
  const info: any = (doc as any).metadata?.info ?? {};
  await doc.destroy();
  return {
    text,
    numpages: doc.numPages,
    info: { Title: info.Title, Author: info.Author },
  };
}

/** Pecah teks jadi chunk ~1200 karakter pada batas paragraf. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paragraphs) {
    if ((cur + "\n\n" + p).length > size && cur) {
      chunks.push(cur);
      cur = cur.slice(-overlap) + "\n\n" + p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur.trim()) chunks.push(cur);
  return chunks;
}
