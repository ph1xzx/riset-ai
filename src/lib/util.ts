import crypto from "crypto";

const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a URL-safe unique id (e.g. "r3k9x..."). */
export function genId(prefix = "r"): string {
  const bytes = crypto.randomBytes(15);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return prefix + s;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Robustly extract a JSON object from an LLM response.
 * Handles: raw JSON, ```json fences, prose around JSON, trailing commas.
 * Fixes a real bug found in the original app ("AI tidak mengembalikan JSON").
 */
export function extractJson<T = unknown>(raw: string): T {
  if (!raw) throw new Error("Respon AI kosong");
  let text = raw.trim();

  // 1. Direct parse
  try {
    return JSON.parse(text) as T;
  } catch {
    /* continue */
  }

  // 2. Strip code fences
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) {
    try {
      return JSON.parse(fence[1].trim()) as T;
    } catch {
      /* continue */
    }
  }

  // 3. First { ... last } or [ ... last ]
  const candidates: string[] = [];
  const objStart = text.indexOf("{");
  const objEnd = text.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) candidates.push(text.slice(objStart, objEnd + 1));
  const arrStart = text.indexOf("[");
  const arrEnd = text.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) candidates.push(text.slice(arrStart, arrEnd + 1));

  for (const c of candidates) {
    try {
      return JSON.parse(c) as T;
    } catch {
      /* continue */
    }
    // 4. Remove trailing commas then retry
    const cleaned = c.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      /* continue */
    }
  }

  throw new Error("AI tidak mengembalikan JSON yang valid. Coba lagi.");
}

/** Human-safe error message: never leak upstream HTML/stack traces to the client.
 *  Fixes a bug where the original app returned raw Cloudflare HTML as the error body. */
export function safeError(e: unknown, fallback = "Terjadi kesalahan. Coba lagi."): string {
  if (e instanceof Error) {
    const m = e.message;
    if (/<(html|!DOCTYPE|div|p|span)\b/i.test(m) || m.length > 400) {
      return fallback;
    }
    // strip datacenter-ish upstream dumps
    if (/<!DOCTYPE|<html|cf-ray|cloudflare/i.test(m)) return fallback;
    return m.length > 300 ? fallback : m;
  }
  return fallback;
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "••••";
  return key.slice(0, 4) + "••••" + key.slice(-4);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Word count of plain text (strips HTML). */
export function wordCount(html: string): number {
  const text = stripHtml(html).trim();
  if (!text) return 0;
  return text.split(/\s+/).length;
}

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ");
}
