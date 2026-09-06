import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiUser } from "@/lib/api";
import { maskKey, nowIso } from "@/lib/util";

const PROVIDERS = ["openrouter", "gemini", "ollama", "custom"] as const;

export async function GET() {
  const u = await apiUser();
  if ("res" in u) return u.res;
  const row = db.prepare("SELECT * FROM settings WHERE user_id = ?").get(u.user.id) as any;
  if (!row) {
    return NextResponse.json({ configured: false, hasKey: false, provider: "openrouter", baseUrl: "https://openrouter.ai/api/v1", model: "", imageModel: "", temperature: 0.3, maxTokens: 5000 });
  }
  return NextResponse.json({
    configured: !!row.api_key,
    hasKey: !!row.api_key,
    provider: row.provider,
    baseUrl: row.base_url,
    model: row.model,
    imageModel: row.image_model,
    temperature: row.temperature,
    maxTokens: row.max_tokens,
    maskKey: maskKey(row.api_key),
  });
}

export async function PUT(req: Request) {
  const u = await apiUser();
  if ("res" in u) return u.res;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const existing = db.prepare("SELECT * FROM settings WHERE user_id = ?").get(u.user.id) as any;
  const provider = PROVIDERS.includes(body.provider) ? body.provider : existing?.provider || "openrouter";
  const baseUrl = String(body.baseUrl ?? existing?.base_url ?? defaultBase(provider)).trim() || defaultBase(provider);
  const model = String(body.model ?? existing?.model ?? "").trim();
  const imageModel = String(body.imageModel ?? existing?.image_model ?? "").trim();
  const temperature = clampNum(body.temperature, existing?.temperature ?? 0.3, 0, 2, 2);
  const maxTokens = clampInt(body.maxTokens, existing?.max_tokens ?? 5000, 100, 32000);
  // The API key is only updated if a non-empty value is sent (masked display never overwrites it)
  const apiKey = body.apiKey && String(body.apiKey).length >= 6 ? String(body.apiKey).trim() : existing?.api_key || "";

  db.prepare(
    `INSERT INTO settings (user_id, provider, base_url, model, image_model, temperature, max_tokens, api_key, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET
       provider=excluded.provider, base_url=excluded.base_url, model=excluded.model,
       image_model=excluded.image_model, temperature=excluded.temperature,
       max_tokens=excluded.max_tokens,
       api_key = CASE WHEN excluded.api_key != '' THEN excluded.api_key ELSE settings.api_key END,
       updated_at=excluded.updated_at`
  ).run(u.user.id, provider, baseUrl, model, imageModel, temperature, maxTokens, apiKey, nowIso());

  return NextResponse.json({
    configured: !!apiKey,
    hasKey: !!apiKey,
    provider,
    baseUrl,
    model,
    imageModel,
    temperature,
    maxTokens,
    maskKey: maskKey(apiKey),
  });
}

function defaultBase(p: string): string {
  if (p === "gemini") return "https://generativelanguage.googleapis.com/v1beta/openai";
  if (p === "ollama") return "http://localhost:11434/v1";
  if (p === "openrouter") return "https://openrouter.ai/api/v1";
  return "";
}
function clampNum(v: any, d: number, min: number, max: number, digits: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
}
function clampInt(v: any, d: number, min: number, max: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return d;
  return Math.min(max, Math.max(min, n));
}
