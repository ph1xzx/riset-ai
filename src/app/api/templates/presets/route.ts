import { NextResponse } from "next/server";
import { TEMPLATE_PRESETS } from "@/lib/template-presets";

export const runtime = "nodejs";

/** Saran template bawaan (data) — bisa dipakai langsung / disesuaikan per-aturan. */
export async function GET() {
  return NextResponse.json({ presets: TEMPLATE_PRESETS });
}
