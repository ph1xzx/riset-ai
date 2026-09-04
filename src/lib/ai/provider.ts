import { prisma } from "../db";

export type AITask =
  | "brainstorm"
  | "generate_section"
  | "autocomplete"
  | "paraphrase"
  | "defense_qa"
  | "cite_context"
  | "figure_suggestions"
  | "ai_edit"
  | "chat"
  | "review"
  | "citation_scan";

type Message = { role: "system" | "user" | "assistant"; content: string };

export type AIResult = {
  content: string;
  provider: string;
  model: string;
  tokens: number;
  latencyMs: number;
};

export class AIConfigError extends Error {}

export async function getSettings() {
  const s = await prisma.settings.findFirst({ where: { id: 1 } });
  if (!s) return prisma.settings.create({ data: { id: 1 } });
  return s;
}

function isConfigured(s: Awaited<ReturnType<typeof getSettings>>) {
  return Boolean(s.apiKey && s.model);
}

/**
 * Provider-agnostic chat completion (OpenAI-compatible endpoint).
 * Bekerja dengan: OpenAI, OpenRouter, Groq, Together, Ollama (/v1),
 * LM Studio, vLLM, dsb.
 *
 * TANPA fallback demo — jika API key belum diset, melempar AIConfigError
 * sehingga UI bisa menampilkan pesan "set API key dulu".
 */
export async function aiChat(
  task: AITask,
  messages: Message[],
  opts: { projectId?: string; json?: boolean }
): Promise<AIResult> {
  const started = Date.now();
  const settings = await getSettings();
  const provider = settings.provider || "openai-compatible";
  const model = settings.model || "";

  const logRun = (status: "ok" | "error" | "config", tokens: number, error = "") => {
    prisma.aIRun
      .create({
        data: {
          projectId: opts.projectId ?? null,
          task,
          provider,
          model,
          tokens,
          latency: Date.now() - started,
          status,
          error: error.slice(0, 500),
        },
      })
      .catch(() => {});
  };

  if (!isConfigured(settings)) {
    logRun("config", 0, "API key / model belum dikonfigurasi");
    throw new AIConfigError(
      "API key belum dikonfigurasi. Buka menu Settings, isi Provider / Base URL / API Key / Model, lalu coba lagi."
    );
  }

  const baseUrl = (settings.baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "");
  // Gemini 3.x kadang 503 "high demand" — fallback sekali ke flash satu tingkat
  // lebih lama biar aplikasi tidak mati total saat model terbaru overload.
  const OVERLOAD_FALLBACK = "gemini-3.5-flash";
  const call = (m: string) =>
    fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.apiKey}`,
      },
      // jangan biarkan route menggantung tanpa batas saat provider lambat
      signal: AbortSignal.timeout(90_000),
      body: JSON.stringify({
        model: m,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
        messages,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
  try {
    let usedModel = model;
    let res: Response | null = null;
    const isGemini = /generativelanguage/i.test(baseUrl);
    // 2 putaran: spike overload Gemini biasanya singkat — tunggu 3 dtk lalu coba lagi
    for (let attempt = 0; attempt < 2 && !res; attempt++) {
      if (attempt > 0) await new Promise((r) => setTimeout(r, 3000));
      const r1 = await call(model);
      if (r1.ok) {
        res = r1;
        usedModel = model;
        break;
      }
      if (r1.status !== 503 || !isGemini || model === OVERLOAD_FALLBACK) {
        const text = await r1.text().catch(() => "");
        logRun("error", 0, `${r1.status} ${text}`.slice(0, 400));
        throw new Error(`AI provider ${r1.status}: ${text.slice(0, 300)}`);
      }
      const fb = await call(OVERLOAD_FALLBACK);
      if (fb.ok || fb.status !== 503) {
        res = fb;
        usedModel = OVERLOAD_FALLBACK;
        break;
      }
      await fb.text().catch(() => "");
    }
    if (!res) {
      logRun("error", 0, `overload ${model} + ${OVERLOAD_FALLBACK} setelah 2 putaran`);
      throw new Error(
        `AI provider overload: ${model} dan fallback ${OVERLOAD_FALLBACK} sama-sama sibuk. Coba lagi sebentar lagi.`
      );
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      logRun("error", 0, `${res.status} ${text}`.slice(0, 400));
      throw new Error(`AI provider ${res.status}: ${text.slice(0, 300)}`);
    }

    const data: any = await res.json();
    const content: string = data?.choices?.[0]?.message?.content ?? "";
    const tokens: number = data?.usage?.total_tokens ?? 0;
    logRun("ok", tokens);
    return { content, provider, model: usedModel, tokens, latencyMs: Date.now() - started };
  } catch (e: any) {
    if (e instanceof AIConfigError) throw e;
    if (e?.name === "AbortError" || /aborted|timeout/i.test(e?.message ?? "")) {
      logRun("error", 0, "timeout 90s");
      throw new Error("Provider AI tidak merespons dalam 90 detik. Coba lagi atau ganti model di Settings.");
    }
    logRun("error", 0, e?.message ?? String(e));
    throw e;
  }
}

/** Ambil objek JSON pertama dari respons LLM (toleran terhadap code fence). */
export function extractJson<T>(raw: string): T {
  const cleaned = raw.replace(/```json/gi, "```").replace(/```/g, "").trim();
  const candidates = [cleaned.indexOf("{"), cleaned.indexOf("[")].filter((i) => i >= 0) as number[];
  if (!candidates.length) throw new Error("AI tidak mengembalikan JSON");
  const start = Math.min(...candidates);
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === "\\") {
      esc = true;
      continue;
    }
    if (c === '"') inStr = !inStr;
    if (inStr) continue;
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1)) as T;
    }
  }
  throw new Error("JSON dari AI tidak lengkap");
}
