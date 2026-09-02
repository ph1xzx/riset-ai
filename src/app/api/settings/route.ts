import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { supabaseConfigured } from "@/lib/storage";

export const runtime = "nodejs";

// GET: status konfigurasi (tanpa membocorkan key penuh)
export async function GET() {
  const s = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!s) {
    return NextResponse.json({ configured: false, supabase: supabaseConfigured(), hasKey: false, provider: "", model: "", baseUrl: "" });
  }
  return NextResponse.json({
    configured: Boolean(s.apiKey && s.model),
    supabase: supabaseConfigured(),
    hasKey: Boolean(s.apiKey),
    provider: s.provider,
    baseUrl: s.baseUrl,
    model: s.model,
    imageModel: s.imageModel,
    embeddingModel: s.embeddingModel,
    temperature: s.temperature,
    maxTokens: s.maxTokens,
    maskKey: s.apiKey ? `${s.apiKey.slice(0, 4)}••••${s.apiKey.slice(-4)}` : "",
  });
}

// PUT: set BYOK (key disimpan server-side, tidak pernah dikirim balik penuh)
export async function PUT(req: NextRequest) {
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof body.provider === "string") data.provider = body.provider;
  if (typeof body.baseUrl === "string") data.baseUrl = body.baseUrl;
  if (typeof body.model === "string") data.model = body.model;
  if (typeof body.imageModel === "string") data.imageModel = body.imageModel;
  if (typeof body.embeddingModel === "string") data.embeddingModel = body.embeddingModel;
  if (typeof body.temperature === "number") data.temperature = Math.min(2, Math.max(0, body.temperature));
  if (typeof body.maxTokens === "number") data.maxTokens = Math.min(32000, Math.max(256, body.maxTokens));
  if (typeof body.apiKey === "string" && body.apiKey.length >= 4) data.apiKey = body.apiKey;

  const s = await prisma.settings.upsert({
    where: { id: 1 },
    create: { id: 1, ...data },
    update: data,
  });
  return NextResponse.json({
    configured: Boolean(s.apiKey && s.model),
    maskKey: s.apiKey ? `${s.apiKey.slice(0, 4)}••••${s.apiKey.slice(-4)}` : "",
  });
}

// jangan pernah prerender saat build — route ini butuh runtime (DB/env)
export const dynamic = "force-dynamic";
