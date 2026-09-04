import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { execFile } from "child_process";
import { promisify } from "util";

export const runtime = "nodejs";
// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";

const pexec = promisify(execFile);

/**
 * CEK KESEHATAN KONFIGURASI — publik (tanpa login) agar bisa dipakai
 * mendiagnosis saat auth belum jalan. TIDAK membocorkan nilai rahasia.
 * - Browser        → halaman HTML ber-CSS (status visual)
 * - ?json=1 / Accept: application/json → JSON (untuk skrip)
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

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = [];

  /* 1) DATABASE_URL — konektivitas */
  const dbUrl = process.env.DATABASE_URL || "";
  const dbHost = hostOf(dbUrl);
  if (!dbUrl) {
    checks.push({ name: "DATABASE_URL", status: "fail", detail: "env belum di-set" });
  } else if (/@db\.[^:/]+\.supabase\.co/.test(dbUrl)) {
    checks.push({
      name: "DATABASE_URL",
      status: "warn",
      detail: `${dbHost} — host direct lama tidak bisa dari Vercel; pakai Transaction Pooler: …pooler.supabase.com:6543?pgbouncer=true&connection_limit=1`,
    });
  }
  try {
    await withTimeout(prisma.$queryRaw`SELECT 1`, 8000, "koneksi DB");
    checks.push({ name: "Koneksi database", status: "ok", detail: `SELECT 1 berhasil ke ${dbHost}` });
  } catch (e: any) {
    checks.push({ name: "Koneksi database", status: "fail", detail: `${dbHost} → ${String(e.message || e).split("\n")[0]}` });
  }

  /* 1b) DIRECT_URL — dipakai migrasi (prisma db push) */
  const directUrl = process.env.DIRECT_URL || "";
  if (!directUrl) {
    checks.push({ name: "DIRECT_URL", status: "warn", detail: "belum di-set — prisma db push dari laptop/CI tidak bisa (runtime aman)" });
  } else if (/@db\.[^:/]+\.supabase\.co/.test(directUrl)) {
    checks.push({ name: "DIRECT_URL", status: "warn", detail: `${hostOf(directUrl)} — host direct lama; pakai Session Pooler (…pooler.supabase.com:5432)` });
  } else {
    checks.push({ name: "DIRECT_URL", status: "ok", detail: `ter-set → ${hostOf(directUrl)}` });
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
    checks.push({ name: "Skema tabel", status: "fail", detail: String(e.message || e).split("\n")[0] || "gagal memeriksa tabel (DB tidak konek?)" });
  }

  /* 3) Supabase Storage (upload docx/gambar) */
  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!sbUrl || !sbKey) {
    checks.push({ name: "Supabase Storage", status: "warn", detail: "NEXT_PUBLIC_SUPABASE_URL / ANON_KEY belum di-set — upload file tidak akan jalan" });
  } else {
    try {
      let r = await withTimeout(
        fetch(`${sbUrl.replace(/\/$/, "")}/storage/v1/bucket/uploads`, { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }),
        8000,
        "cek bucket"
      );
      if (!r.ok) {
        r = await withTimeout(
          fetch(`${sbUrl.replace(/\/$/, "")}/storage/v1/object/list/uploads`, {
            method: "POST",
            headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ prefix: "", limit: 1 }),
          }),
          8000,
          "cek bucket list"
        );
      }
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
      status: "warn",
      detail: process.env.VERCEL ? "tidak tersedia di Vercel (normal) — gunakan Export DOCX" : "tidak terpasang di server ini",
    });
  }

  return checks;
}

/* ---------- tampilan HTML ---------- */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function renderHtml(checks: Check[], overall: string, runtimeLabel: string): string {
  const meta = { ok: ["#0f7b47", "#e6f4ec", "✓", "SEMUA TERHUBUNG"], warn: ["#92600a", "#fdf3d7", "!", "ADA YANG PERLU DIPERHATIKAN"], fail: ["#b3261e", "#fdecea", "✗", "ADA MASALAH — LIHAT BARIS MERAH"] }[overall] as any;
  const nOk = checks.filter((c) => c.status === "ok").length;
  const nWarn = checks.filter((c) => c.status === "warn").length;
  const nFail = checks.filter((c) => c.status === "fail").length;
  const rows = checks
    .map((c) => {
      const col = c.status === "ok" ? "#0f7b47" : c.status === "warn" ? "#92600a" : "#b3261e";
      const bg = c.status === "ok" ? "#f2faf5" : c.status === "warn" ? "#fdf8ea" : "#fdf0ef";
      const ico = c.status === "ok" ? "✓" : c.status === "warn" ? "!" : "✗";
      const label = c.status === "ok" ? "TERHUBUNG" : c.status === "warn" ? "PERHATIAN" : "BELUM konek";
      return `<div class="row" style="background:${bg};border-left:5px solid ${col}">
        <div class="ic" style="background:${col}">${ico}</div>
        <div class="tx"><div class="nm">${esc(c.name)} <span class="st" style="color:${col}">— ${label}</span></div>
        <div class="dt">${esc(c.detail)}</div></div></div>`;
    })
    .join("\n");

  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cek Koneksi Sistem — riset-ai</title>
<style>
  *{box-sizing:border-box;margin:0}
  body{font-family:Georgia,'Times New Roman',serif;background:#f6f2ea;color:#1c1a17;min-height:100vh;padding:32px 16px}
  .wrap{max-width:760px;margin:0 auto}
  .kicker{font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#8a8375}
  h1{font-size:30px;margin:6px 0 2px}
  .sub{color:#6b6558;font-size:14px;margin-bottom:20px}
  .overall{display:flex;align-items:center;gap:14px;border-radius:12px;padding:16px 18px;margin-bottom:22px;background:${meta[1]};border:1px solid ${meta[0]}33}
  .badge{width:44px;height:44px;border-radius:50%;background:${meta[0]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:bold;flex:none}
  .otitle{font-weight:bold;font-size:17px;color:${meta[0]}}
  .osum{font-size:13px;color:#5c564a;margin-top:2px}
  .row{display:flex;gap:14px;align-items:flex-start;border-radius:10px;padding:13px 15px;margin-bottom:10px}
  .ic{width:26px;height:26px;border-radius:50%;color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:bold;flex:none;margin-top:2px}
  .nm{font-weight:bold;font-size:15.5px}
  .st{font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase}
  .dt{font-size:13px;color:#4c473d;margin-top:3px;line-height:1.5;word-break:break-word}
  .foot{margin-top:22px;font-size:12.5px;color:#7c7566;line-height:1.7;background:#efece4;border-radius:10px;padding:14px 16px}
  .foot b{color:#4c473d}
  .act{margin-top:14px;display:flex;gap:10px}
  a.btn{text-decoration:none;font-size:13.5px;padding:9px 16px;border-radius:9px;border:1px solid #1c1a17;color:#1c1a17;background:#fffdf8}
  a.btn:hover{background:#1c1a17;color:#f6f2ea}
  .meta{margin-top:14px;font-family:ui-monospace,monospace;font-size:11px;color:#9a9384}
</style></head><body><div class="wrap">
  <div class="kicker">riset-ai • diagnostik sistem</div>
  <h1>Cek Koneksi Sistem</h1>
  <div class="sub">Status seluruh konfigurasi env & layanan — halaman ini publik dan tidak menampilkan nilai rahasia.</div>

  <div class="overall">
    <div class="badge">${meta[2]}</div>
    <div><div class="otitle">${meta[3]}</div>
    <div class="osum">${nOk} terhubung • ${nWarn} perhatian • ${nFail} belum konek</div></div>
  </div>

  ${rows}

  <div class="foot">
    <b>Cara baca:</b> ✓ hijau = terhubung & sehat • ! kuning = jalan tapi perlu diperhatikan (mis. belum aman/opsional) • ✗ merah = belum konek, fitur terkait tidak akan jalan.<br>
    <b>Perbaikan umum:</b> DATABASE_URL merah → pakai Transaction Pooler 6543 di Vercel env • Skema tabel/bucket merah → jalankan <i>supabase/setup.sql</i> di SQL Editor • setelah ubah env → Redeploy.
  </div>

  <div class="act">
    <a class="btn" href="/api/health">↻ Periksa ulang</a>
    <a class="btn" href="/api/health?json=1">Lihat JSON</a>
    <a class="btn" href="/">Ke aplikasi</a>
  </div>
  <div class="meta">runtime: ${esc(runtimeLabel)} • node ${esc(process.version)} • diperiksa: ${new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })} WIB</div>
</div></body></html>`;
}

export async function GET(req: NextRequest) {
  const checks = await runChecks();
  const overall: "ok" | "warn" | "fail" = checks.some((c) => c.status === "fail")
    ? "fail"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "ok";
  const runtimeLabel = process.env.VERCEL ? `vercel (${process.env.VERCEL_REGION || "?"})` : "local";

  const wantsJson =
    req.nextUrl.searchParams.get("json") === "1" || (req.headers.get("accept") || "").includes("application/json");
  if (wantsJson) {
    return NextResponse.json({ overall, app: "riset-ai", runtime: runtimeLabel, node: process.version, checkedAt: new Date().toISOString(), checks });
  }
  return new NextResponse(renderHtml(checks, overall, runtimeLabel), {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
