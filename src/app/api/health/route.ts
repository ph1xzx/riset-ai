import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAiSettings } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Health endpoint. Mirrors the original /api/health and reports real status.
 * Note: PDF export now uses pdfkit (no LibreOffice), so that check is "ok".
 */
export async function GET(req: Request) {
  const checks: { name: string; status: "ok" | "warn"; detail: string }[] = [];
  let overall: "ok" | "warn" = "ok";

  // Database
  try {
    db.prepare("SELECT 1").get();
    const tables = (db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[]).length;
    checks.push({ name: "Koneksi database", status: "ok", detail: `SQLite siap (${tables} tabel)` });
  } catch (e: any) {
    overall = "warn";
    checks.push({ name: "Koneksi database", status: "warn", detail: String(e.message).slice(0, 120) });
  }

  // Secret
  checks.push({
    name: "AUTH_SECRET",
    status: process.env.AUTH_SECRET ? "ok" : "warn",
    detail: process.env.AUTH_SECRET ? "ter-set" : "belum ter-set (pakai default dev)",
  });

  // Storage dir
  try {
    const fs = await import("fs");
    const path = await import("path");
    const dir = process.env.STORAGE_DIR || path.join(process.cwd(), "data", "storage");
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    checks.push({ name: "Storage lokal", status: "ok", detail: dir });
  } catch (e: any) {
    overall = "warn";
    checks.push({ name: "Storage lokal", status: "warn", detail: String(e.message).slice(0, 120) });
  }

  // PDF exporter (pdfkit is bundled — always ok, unlike the LibreOffice approach)
  checks.push({ name: "PDF export (pdfkit)", status: "ok", detail: "render native, tanpa LibreOffice" });

  // AI (BYOK) — per logged-in user
  const user = await getCurrentUser();
  if (user) {
    const s = getAiSettings(user.id);
    checks.push({
      name: "Konfigurasi AI (BYOK)",
      status: s ? "ok" : "warn",
      detail: s ? `${s.provider} / ${s.model} siap` : "belum ada API key — isi di Settings",
    });
  } else {
    checks.push({ name: "Konfigurasi AI (BYOK)", status: "ok", detail: "per-user; login untuk cek" });
  }

  return NextResponse.json({
    overall,
    app: "riset-ai",
    version: "2.0.0",
    runtime: process.env.VERCEL ? `vercel (${process.env.VERCEL_REGION ?? "?"})` : "node " + process.version,
    checkedAt: new Date().toISOString(),
    checks,
  });
}
