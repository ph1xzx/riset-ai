import { NextRequest, NextResponse } from "next/server";
import { parsePedoman } from "@/lib/template-parser";

export const runtime = "nodejs";

/** Pratinjau hasil parse pedoman tanpa menyimpan apa pun. */
export async function POST(req: NextRequest) {
  const b = await req.json();
  const text = String(b.sourceText || "");
  if (text.trim().length <= 20)
    return NextResponse.json({ error: "Teks pedoman terlalu pendek" }, { status: 400 });
  const { config, detected, warnings } = parsePedoman(text);
  return NextResponse.json({ config, detected, warnings });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
