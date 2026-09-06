import { db } from "./db";

export type Provider = "openrouter" | "gemini" | "ollama" | "custom";

export interface AiSettings {
  provider: Provider;
  baseUrl: string;
  model: string;
  imageModel: string;
  temperature: number;
  maxTokens: number;
  apiKey: string;
}

export function getAiSettings(userId: string): AiSettings | null {
  const row = db
    .prepare(
      "SELECT provider, base_url, model, image_model, temperature, max_tokens, api_key FROM settings WHERE user_id = ?"
    )
    .get(userId) as
    | {
        provider: string;
        base_url: string;
        model: string;
        image_model: string;
        temperature: number;
        max_tokens: number;
        api_key: string;
      }
    | undefined;
  if (!row || !row.api_key) return null;
  return {
    provider: row.provider as Provider,
    baseUrl: row.base_url,
    model: row.model,
    imageModel: row.image_model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    apiKey: row.api_key,
  };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
  onToken?: (token: string) => void;
  /** Number of attempts before giving up (default 2 for transient upstream errors). */
  retries?: number;
}

/**
 * Call the user's own API key (BYOK) through an OpenAI-compatible chat completions
 * endpoint. Supports OpenRouter, Gemini (OpenAI-compat), Ollama, and any custom
 * OpenAI-compatible base URL. The key never leaves the server.
 *
 * Improvements over the original app:
 *  - proper User-Agent + headers (original triggered Cloudflare 504 on some providers)
 *  - retries with backoff on 429/5xx
 *  - sanitized errors (never leak upstream HTML to the client)
 */
export async function chat(settings: AiSettings, messages: ChatMessage[], opts: ChatOptions = {}): Promise<string> {
  const base = settings.baseUrl.replace(/\/+$/, "");
  const url = `${base}/chat/completions`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "RisetAI/2.0 (BYOK)",
    Authorization: `Bearer ${settings.apiKey}`,
  };
  if (settings.provider === "openrouter") {
    headers["HTTP-Referer"] = "http://localhost:3000";
    headers["X-Title"] = "Riset AI";
  }

  const body: Record<string, unknown> = {
    model: settings.model,
    messages,
    temperature: opts.temperature ?? settings.temperature,
    max_tokens: opts.maxTokens ?? settings.maxTokens,
    stream: !!opts.onToken,
  };
  if (opts.jsonMode && settings.provider !== "ollama") {
    body.response_format = { type: "json_object" };
  }

  const attempts = opts.retries ?? 2;
  let lastErr: unknown = new Error("AI tidak dapat dihubungi");
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: opts.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`AI provider ${res.status}`);
          if (attempt < attempts - 1) {
            await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
            continue;
          }
          throw new Error(
            `Layanan AI sedang sibuk (${res.status}). Tunggu sebentar lalu coba lagi.`
          );
        }
        // 4xx: surface a clean message
        let msg = `AI provider menolak request (${res.status})`;
        try {
          const j = JSON.parse(text);
          if (j?.error?.message) msg = j.error.message.slice(0, 200);
        } catch {
          /* ignore */
        }
        throw new Error(msg);
      }

      if (opts.onToken) {
        // SSE stream
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Streaming tidak didukung");
        let full = "";
        const dec = new TextDecoder();
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = value;
          const text = dec.decode(chunk, { stream: true });
          const lines = text.split("\n");
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith("data:")) continue;
            const data = t.slice(5).trim();
            if (data === "[DONE]") continue;
            try {
              const j = JSON.parse(data);
              const delta = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? "";
              if (delta) {
                full += delta;
                opts.onToken(delta);
              }
            } catch {
              /* partial line */
            }
          }
        }
        return full;
      }

      const j = await res.json();
      const content = j.choices?.[0]?.message?.content;
      if (typeof content !== "string") throw new Error("Respon AI tidak berisi teks");
      return content;
    } catch (e) {
      if ((e as Error).name === "AbortError") throw e;
      lastErr = e;
      if (attempt < attempts - 1 && isTransient(e)) {
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (e instanceof Error && /Layanan AI sedang sibuk/.test(e.message)) throw e;
      break;
    }
  }
  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (/<(html|!DOCTYPE|div)\b/i.test(msg) || msg.length > 300) {
    throw new Error("Layanan AI tidak merespons. Periksa koneksi / coba lagi.");
  }
  throw new Error(msg);
}

function isTransient(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return /fetch failed|ECONNRESET|ETIMEDOUT|socket|network|5\d\d|429/i.test(e.message);
}

/** Ask the model for strict JSON and parse it (with the robust extractor). */
export async function chatJson<T>(settings: AiSettings, messages: ChatMessage[], opts: ChatOptions = {}): Promise<T> {
  const raw = await chat(settings, messages, { ...opts, jsonMode: true });
  // Lazy import to avoid a circular dep
  const { extractJson } = await import("./util");
  return extractJson<T>(raw);
}

/**
 * Generate an image via an OpenAI-compatible image endpoint and return the
 * data URL (base64). Uses the configured imageModel; falls back to the chat
 * model for providers that return images in chat (e.g. Gemini image models).
 */
export async function generateImage(
  settings: AiSettings,
  prompt: string,
  onLog?: (s: string) => void
): Promise<{ dataUrl: string; model: string }> {
  const model = settings.imageModel || settings.model;
  const base = settings.baseUrl.replace(/\/+$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "RisetAI/2.0 (BYOK)",
    Authorization: `Bearer ${settings.apiKey}`,
  };

  // 1) Try the standard images/generations endpoint
  try {
    const res = await fetch(`${base}/images/generations`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, prompt, n: 1, size: "1024x768" }),
    });
    if (res.ok) {
      const j = await res.json();
      const item = j.data?.[0];
      if (item?.b64_json) return { dataUrl: `data:image/png;base64,${item.b64_json}`, model };
      if (item?.url) return { dataUrl: item.url, model };
    }
  } catch {
    /* fall through to chat-based */
  }

  // 2) Chat-based image generation (Gemini "nano banana" style)
  onLog?.("endpoint images/generations tidak tersedia, mencoba via chat…");
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: true },
          ],
        },
      ],
    }),
  }).catch(() => null);
  if (res && res.ok) {
    const j = await res.json();
    const msg = j.choices?.[0]?.message;
    if (msg?.images?.[0]?.image_url?.url) return { dataUrl: msg.images[0].image_url.url, model };
    const content = typeof msg?.content === "string" ? msg.content : "";
    const m = content.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/);
    if (m) return { dataUrl: m[0], model };
  }
  throw new Error("Model gambar tidak menghasilkan gambar. Coba model lain di Settings.");
}
