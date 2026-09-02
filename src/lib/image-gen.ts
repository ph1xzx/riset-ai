// Generate & ambil gambar untuk disisipkan ke dokumen.
// - generateImage: Gemini native (responseModalities IMAGE) atau OpenAI-compatible /images/generations
// - searchImages:  keyless via Wikimedia Commons (+ Openverse fallback)
// - fetchRemoteImage: download gambar dari URL (dipakai untuk "gambar dari internet")

export type ImageBytes = { buffer: Buffer; mime: string };

const UA = "RisetAI/1.0 (workspace penulisan akademik)";

function guessMime(buf: Buffer): string {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x47 && buf[1] === 0x49) return "image/gif";
  if (buf[0] === 0x42 && buf[1] === 0x4d) return "image/bmp";
  if (buf.length > 4 && buf[0] === 0x25 && buf[1] === 0x50) return "image/svg+xml";
  return "image/png";
}

type AiCfg = { baseUrl: string; apiKey: string; imageModel: string; model: string };

function isGemini(baseUrl: string): boolean {
  return /generativelanguage\.googleapis\.com/i.test(baseUrl);
}

/** Deteksi limit kuota/rate — UI akan fallback ke "salin prompt / upload manual". */
function isLimitError(status: number, msg: string): boolean {
  return (
    status === 429 ||
    /quota|rate limit|rate-limit|resource_exhausted|too many requests|limit (tercapai|exceeded)|exceeded|retry after/i.test(
      msg || ""
    )
  );
}

/** Daftar fallback model gambar Gemini (nama bisa berubah antar rilis API). */
const GEMINI_IMAGE_MODELS = ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"];

async function geminiGenerate(key: string, model: string, prompt: string): Promise<ImageBytes> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    let msg = `Gemini ${res.status}`;
    try {
      const j = JSON.parse(body);
      msg = j?.error?.message || msg;
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(msg), { status: res.status, limit: isLimitError(res.status, msg) });
  }
  const j: any = await res.json();
  const parts: any[] = j?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) throw new Error("Model tidak mengembalikan gambar (mungkin model teks-only). Coba model lain di Settings.");
  const mime: string = img.inlineData.mimeType || "image/png";
  return { buffer: Buffer.from(img.inlineData.data, "base64"), mime };
}

async function openAiImages(baseUrl: string, key: string, model: string, prompt: string): Promise<ImageBytes> {
  const base = baseUrl.replace(/\/+$/, "");
  const res = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, prompt, n: 1 }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Provider ${res.status}: ${body.slice(0, 200)}`), {
      status: res.status,
      limit: isLimitError(res.status, body),
    });
  }
  const j: any = await res.json();
  const item = j?.data?.[0];
  if (!item) throw new Error("Provider tidak mengembalikan gambar.");
  if (item.b64_json) return { buffer: Buffer.from(item.b64_json, "base64"), mime: "image/png" };
  if (item.url) {
    const im = await fetchRemoteImage(item.url, 20 * 1024 * 1024);
    return im;
  }
  throw new Error("Respons gambar tidak dikenali (b64_json/url kosong).");
}

/**
 * Generate gambar dari prompt.
 * Urutan coba untuk Gemini: model yang dikonfigurasi → daftar fallback.
 */
export async function generateImage(cfg: AiCfg, prompt: string): Promise<ImageBytes & { model: string }> {
  if (!cfg.apiKey) throw new Error("API key belum dikonfigurasi. Buka Settings dulu.");
  if (isGemini(cfg.baseUrl)) {
    const candidates = [cfg.imageModel, ...GEMINI_IMAGE_MODELS].filter(
      (m, i, a): m is string => Boolean(m) && a.indexOf(m) === i
    );
    let lastErr: any = null;
    for (const m of candidates) {
      try {
        const r = await geminiGenerate(cfg.apiKey, m, prompt);
        return { ...r, model: m };
      } catch (e: any) {
        lastErr = e;
        // model tidak ada / tidak support → coba berikutnya
        if (e.status === 404 || /not found|not supported|permission/i.test(e.message || "")) continue;
        throw e;
      }
    }
    throw Object.assign(new Error(`Semua model gambar Gemini gagal. ${lastErr?.message || ""}`), {
      limit: Boolean(lastErr?.limit),
    });
  }
  const model = cfg.imageModel || cfg.model;
  if (!model) throw new Error("Isi model (minimal model teks) di Settings untuk generate gambar.");
  const r = await openAiImages(cfg.baseUrl, cfg.apiKey, model, prompt);
  return { ...r, model };
}

/** Download gambar dari URL internet (dengan limit ukuran). */
export async function fetchRemoteImage(url: string, maxBytes = 8 * 1024 * 1024): Promise<ImageBytes> {
  if (!/^https?:\/\//i.test(url)) throw new Error("URL harus http/https");
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`Gagal mengunduh gambar (${res.status})`);
  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) throw new Error(`Gambar terlalu besar (${(buf.length / 1048576).toFixed(1)} MB, maks ${maxBytes / 1048576} MB)`);
  const mime = ct.startsWith("image/") ? ct.split(";")[0] : guessMime(buf);
  if (!mime.startsWith("image/")) throw new Error("Bukan file gambar (content-type tidak dikenali)");
  return { buffer: buf, mime };
}

export type SearchResult = { title: string; url: string; source: string };

/** Cari gambar keyless: Wikimedia Commons (utama) + Openverse (fallback). */
export async function searchImages(query: string, limit = 8): Promise<SearchResult[]> {
  const out: SearchResult[] = [];
  // 1) Wikimedia Commons
  try {
    const u =
      "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=" +
      encodeURIComponent(`filetype:bitmap ${query}`) +
      `&gsrlimit=${limit}&gsrnamespace=6&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json`;
    const j: any = await (await fetch(u, { headers: { "User-Agent": UA } })).json();
    const pages: any[] = j?.query?.pages ? Object.values(j.query.pages) : [];
    for (const p of pages) {
      const info = p?.imageinfo?.[0];
      if (info?.thumburl || info?.url) {
        out.push({ title: (p.title || "Gambar").replace(/^File:/, ""), url: info.thumburl || info.url, source: "Wikimedia Commons" });
      }
    }
  } catch {
    /* lanjut ke fallback */
  }
  // 2) Openverse
  try {
    const j: any = await (
      await fetch(`https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&page_size=${limit}`, {
        headers: { "User-Agent": UA },
      })
    ).json();
    for (const r of j?.results ?? []) {
      if (r.url) out.push({ title: r.title || "Gambar", url: r.thumbnail || r.url, source: "Openverse" });
    }
  } catch {
    /* ignore */
  }
  // dedup by url
  const seen = new Set<string>();
  return out.filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true))).slice(0, limit);
}
