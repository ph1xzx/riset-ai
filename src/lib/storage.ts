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

export type StoredFile = {
  name: string;
  url: string;
  size: number | null;
  createdAt: string | null;
};

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
function safeOwner(ownerKey: string | null | undefined): string {
  return ownerKey && /^[a-zA-Z0-9_-]+$/.test(ownerKey) ? ownerKey : "general";
}

export async function saveFileBytes(name: string, bytes: Buffer, ownerKey?: string | null): Promise<string> {
  const sb = getSupabase();
  if (sb) {
    const pathInBucket = `users/${safeOwner(ownerKey)}/${Date.now()}-${name}`;
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

function supabaseObjectPath(urlOrPath: string): string | null {
  const conf = getCleanSupabaseConfig();
  if (!conf || !/^https?:\/\//i.test(urlOrPath)) return null;
  try {
    const parsed = new URL(urlOrPath);
    const configured = new URL(conf.url);
    if (parsed.host !== configured.host) return null;
    const marker = `/storage/v1/object/public/${UPLOAD_BUCKET}/`;
    const index = parsed.pathname.indexOf(marker);
    if (index < 0) return null;
    const objectPath = decodeURIComponent(parsed.pathname.slice(index + marker.length));
    if (!objectPath || objectPath.split("/").some((part) => !part || part === "." || part === "..")) return null;
    return objectPath;
  } catch {
    return null;
  }
}

export function managedStoragePath(urlOrPath: string): string | null {
  const fromSupabase = supabaseObjectPath(urlOrPath);
  if (fromSupabase) return fromSupabase;
  if (/^\/api\/uploads\//i.test(urlOrPath)) return path.basename(decodeURIComponent(urlOrPath));
  return null;
}

export async function deleteStoredFile(urlOrPath: string): Promise<void> {
  const sbPath = supabaseObjectPath(urlOrPath);
  if (sbPath) {
    const sb = getSupabase();
    if (!sb) throw new Error("Storage Supabase belum dikonfigurasi");
    const { error } = await sb.storage.from(UPLOAD_BUCKET).remove([sbPath]);
    if (error) throw new Error(`File Supabase belum bisa dihapus: ${error.message}`);
    return;
  }

  const localName = /^\/api\/uploads\//i.test(urlOrPath) ? path.basename(decodeURIComponent(urlOrPath)) : path.basename(urlOrPath);
  if (!localName || localName === "." || localName === "..") throw new Error("File storage tidak valid");
  const localPath = path.join(LOCAL_UPLOADS, localName);
  if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
}

export async function listStoredFiles(ownerKey?: string | null): Promise<StoredFile[]> {
  const sb = getSupabase();
  const owner = safeOwner(ownerKey);
  if (sb) {
    const prefix = `users/${owner}`;
    const { data, error } = await sb.storage.from(UPLOAD_BUCKET).list(prefix, {
      limit: 100,
      sortBy: { column: "created_at", order: "desc" },
    });
    if (error) throw new Error(`Daftar file belum bisa dimuat: ${error.message}`);
    return (data || [])
      .filter((file) => file.name && file.name !== ".emptyFolderPlaceholder")
      .map((file) => {
        const objectPath = `${prefix}/${file.name}`;
        return {
          name: file.name,
          url: sb.storage.from(UPLOAD_BUCKET).getPublicUrl(objectPath).data.publicUrl,
          size: typeof file.metadata?.size === "number" ? file.metadata.size : null,
          createdAt: file.created_at || null,
        };
      });
  }

  if (!fs.existsSync(LOCAL_UPLOADS)) return [];
  return fs
    .readdirSync(LOCAL_UPLOADS, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const fullPath = path.join(LOCAL_UPLOADS, entry.name);
      const stat = fs.statSync(fullPath);
      return {
        name: entry.name,
        url: `/api/uploads/${encodeURIComponent(entry.name)}`,
        size: stat.size,
        createdAt: stat.birthtime.toISOString(),
      };
    })
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
    .slice(0, 100);
}
