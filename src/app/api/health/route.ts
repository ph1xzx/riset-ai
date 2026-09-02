import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";

const pexec = promisify(execFile);

/**
 * CEK KESEHATAN KONFIGURASI — publik (tanpa login) agar bisa dipakai
 * mendiagnosis saat auth belum jalan. TIDAK membocorkan nilai rahasia:
 * hanya status + host/panjang, bukan isi env.
 */

type Check = { name: string; status: "ok" | "warn" | "fail"; detail: string };

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} (timeout ${ms}ms)`)), ms)),
  ]);
}

function hostOf(url: string): string {
  const m = (url || "").match(/@([^:/?]+)/);
  const port = (url || "").match(/@[^:/?]+:(\d+)/);
  return m ? `${m[1]}${port ? ":" + port[1] : ""}` : "(kosong)";
}

export async function GET() {
  const checks: Check[] = [];

  /* 1) DATABASE_URL — konektivitas */
  const dbUrl = process.env.DATABASE_URL || "";
  const dbHost = hostOf(dbUrl);
  if (!dbUrl) {
    checks.push({ name: "DATABASE_URL", status: "fail", detail: "env belum di-set" });
  } else if (/supabase\.co:5432/.test(dbHost)) {
    checks.push({
      name: "DATABASE_URL",
      status: "warn",
      detail: `${dbHost} — host direct 5432 biasanya TIDAK bisa dari Vercel; pakai Transaction Pooler 6543 (…pooler.supabase.com:6543?pgbouncer=true&connection_limit=1)`,
    });
  }
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 8000, "koneksi DB");
    checks.push({ name: "Koneksi database", status: "ok", detail: `SELECT 1 berhasil ke ${dbHost}` });
  } catch (e: any) {
    checks.push({ name: "Koneksi database", status: "fail", detail: `${hostOf(dbUrl)} → ${String(e.message || e).split("\n")[0]}` });
  }

  /* 2) Tabel skema (setup.sql sudah dijalankan?) */
  try {
    const rows: any[] = await withTimeout(
      prisma.$queryRaw`select table_name from information_schema.tables where table_schema = 'public'`,
      8000,
      "cek tabel"
    );
    const names = new Set(rows.map((r) => String(r.table_name)));
    const wajib = ["User", "Project", "Section", "Settings", "WritingTemplate", "Source"];
    const hilang = wajib.filter((t) => !names.has(t));
    checks.push(
      hilang.length
        ? { name: "Skema tabel", status: "fail", detail: `tabel hilang: ${hilang.join(", ")} — jalankan supabase/setup.sql di SQL Editor` }
        : { name: "Skema tabel", status: "ok", detail: `${names.size} tabel terpasang (User, Project, Section, dst.)` }
    );
  } catch (e: any) {
    checks.push({ name: "Skema tabel", status: "fail", detail: String(e.message || e).split("\n")[0] });
  }

  /* 3) Supabase Storage (upload docx/gambar) */
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!sbUrl || !sbKey) {
    checks.push({ name: "Supabase Storage", status: "warn", detail: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum di-set — upload file tidak akan jalan" });
  } else {
    try {
      const r = await withTimeout(
        fetch(`${sbUrl.replace(/\/$/, "")}/storage/v1/bucket/uploads`, { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }),
        8000,
        "cek bucket"
      );
      if (r.ok) checks.push({ name: "Supabase Storage", status: "ok", detail: "bucket 'uploads' ada dan dapat diakses" });
      else
        checks.push({
          name: "Supabase Storage",
          status: "fail",
          detail: `bucket 'uploads' tidak ditemukan (HTTP ${r.status}) — jalankan supabase/setup.sql`,
        });
    } catch (e: any) {
      checks.push({ name: "Supabase Storage", status: "fail", detail: String(e.message || e).split("\n")[0] });
    }
  }

  /* 4) AUTH_SECRET */
  const secret = process.env.AUTH_SECRET || "";
  if (!secret) checks.push({ name: "AUTH_SECRET", status: "warn", detail: "belum di-set — memakai secret development (TIDAK aman untuk produksi)" });
  else if (secret.length < 16) checks.push({ name: "AUTH_SECRET", status: "warn", detail: `terlalu pendek (${secret.length} karakter) — minimal 16` });
  else checks.push({ name: "AUTH_SECRET", status: "ok", detail: `ter-set (${secret.length} karakter)` });

  /* 5) Konfigurasi AI (dari Settings di DB — diisi via halaman /settings) */
  try {
    const s: any = await withTimeout(prisma.settings.findUnique({ where: { id: 1 } }), 5000, "cek settings");
    const ready = !!(s?.baseUrl && s?.apiKey && s?.model);
    checks.push({
      name: "Konfigurasi AI (BYOK)",
      status: ready ? "ok" : "warn",
      detail: ready ? `model ${s.model} siap` : "belum lengkap — isi Base URL + API key + model di halaman /settings",
    });
  } catch {
    checks.push({ name: "Konfigurasi AI (BYOK)", status: "warn", detail: "tabel Settings belum ada / DB belum konek" });
  }

  /* 6) LibreOffice (Export PDF) — info saja */
  try {
    const { stdout } = await pexec("soffice", ["--version"], { timeout: 5000 });
    checks.push({ name: "LibreOffice (Export PDF)", status: "ok", detail: stdout.trim().split("\n")[0] });
  } catch {
    checks.push({
      name: "LibreOffice (Export PDF)",
      status: process.env.VERCEL ? "warn" : "warn",
      detail: process.env.VERCEL ? "tidak tersedia di Vercel (normal) — gunakan Export DOCX" : "tidak terpasang di server ini",
    });
  }

  const overall: "ok" | "warn" | "fail" = checks.some((c) => c.status === "fail")
    ? "fail"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";

  return NextResponse.json({
    overall,
    app: "riset-ai",
    runtime: process.env.VERCEL ? `vercel (${process.env.VERCEL_REGION || "?"})` : "local",
    node: process.version,
    checkedAt: new Date().toISOString(),
    checks,
  });
}
