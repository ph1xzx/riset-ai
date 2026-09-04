import { createClient, SupabaseClient } from "@supabase/supabase-js";

function getCleanSupabaseConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const rawKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!rawUrl || !rawKey) return null;
  let cleanUrl = rawUrl.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(cleanUrl);
    cleanUrl = `${parsed.protocol}//${parsed.host}`;
  } catch {}
  return { url: cleanUrl, key: rawKey.trim() };
}

/** Ada konfigurasi Supabase? (Vercel: ya; sandbox local: belum tentu) */
export function supabaseConfigured(): boolean {
  return Boolean(getCleanSupabaseConfig());
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const conf = getCleanSupabaseConfig();
  if (!conf) return null;
  if (!client) client = createClient(conf.url, conf.key, { auth: { persistSession: false } });
  return client;
}

export const UPLOAD_BUCKET = "uploads";

/**
 * Ambil bytes dari file:
 * - URL absolute (Supabase Storage / http)  → fetch
 * - path lokal (fallback sandbox)           → baca dari ./uploads
 */
import path from "path";
import fs from "fs";

const LOCAL_UPLOADS = path.join(process.cwd(), "uploads");

export async function fetchFileBytes(urlOrPath: string): Promise<Buffer> {
  if (/^https?:\/\//.test(urlOrPath)) {
    const res = await fetch(urlOrPath);
    if (!res.ok) throw new Error(`Gagal mengunduh file (${res.status})`);
    return Buffer.from(await res.arrayBuffer());
  }
  const name = path.basename(urlOrPath);
  const p = path.join(LOCAL_UPLOADS, name);
  if (!fs.existsSync(p)) throw new Error("File tidak ditemukan di storage lokal");
  return fs.readFileSync(p);
}

/** Simpan bytes ke storage (fallback lokal jika Supabase belum diset). */
export async function saveFileBytes(name: string, bytes: Buffer): Promise<string> {
  const sb = getSupabase();
  if (sb) {
    const pathInBucket = `imports/${Date.now()}-${name}`;
    const ext = name.split(".").pop()?.toLowerCase() || "";
    const MIME: Record<string, string> = {
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const { error } = await sb.storage.from(UPLOAD_BUCKET).upload(pathInBucket, bytes, {
      upsert: true,
      contentType: MIME[ext] || "application/octet-stream",
    });
    if (error) throw new Error(`Upload ke Supabase gagal: ${error.message}`);
    const { data } = sb.storage.from(UPLOAD_BUCKET).getPublicUrl(pathInBucket);
    return data.publicUrl;
  }
  fs.mkdirSync(LOCAL_UPLOADS, { recursive: true });
  const finalName = `${Date.now()}-${name}`;
  fs.writeFileSync(path.join(LOCAL_UPLOADS, finalName), bytes);
  return `/api/uploads/${finalName}`;
}
