/**
 * Token sesi berbasis HMAC-SHA256 (Web Crypto — aman dipakai di edge middleware
 * maupun route Node). Format: base64url(payload).base64url(signature)
 * payload: { sub, email, exp }
 */

export const SESSION_COOKIE = "riset_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 hari

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (s && s.length >= 16) return s;
  // fallback khusus development — di produksi WAJIB set AUTH_SECRET
  return "riset-ai-dev-secret-not-for-prod";
}

const enc = new TextEncoder();

function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function unb64u(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function key(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", enc.encode(getSecret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export type SessionPayload = { sub: string; email: string; exp: number };

export async function signToken(sub: string, email: string, ttlMs = SESSION_TTL_MS): Promise<string> {
  const payload: SessionPayload = { sub, email, exp: Date.now() + ttlMs };
  const body = b64u(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(body));
  return `${body}.${b64u(new Uint8Array(sig))}`;
}

export async function verifyToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), unb64u(sig), enc.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64u(body))) as SessionPayload;
    if (!payload.sub || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}
