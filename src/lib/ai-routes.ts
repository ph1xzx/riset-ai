import { db } from "./db";
import { getAiSettings, AiSettings, ChatMessage } from "./ai";
import { rowToProject, rowToSource } from "./api";
import type { ProjectRow } from "./types";
import type { SourceRecord } from "./cite";
import { safeError } from "./util";

export interface AiContext {
  user: { id: string };
  project: ProjectRow;
  sources: SourceRecord[];
  settings: AiSettings;
}

/**
 * Load everything an AI route needs. Returns either the context or an error
 * payload. AI features are strictly BYOK: without a configured key we return a
 * clear 400 (no mockup, no fake output — same stance as the original app).
 */
export async function loadAiContext(userId: string, projectId: string): Promise<AiContext | { error: string; status: number }> {
  const settings = getAiSettings(userId);
  if (!settings) {
    return {
      error: "API key belum diset. Buka Settings dan isi API key-mu (OpenRouter/Gemini/Ollama).",
      status: 400,
    };
  }
  const proj = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId) as any;
  if (!proj) return { error: "Proyek tidak ditemukan", status: 404 };
  const sourceRows = db.prepare("SELECT * FROM sources WHERE project_id = ? ORDER BY added_at DESC").all(projectId) as any[];
  return {
    user: { id: userId },
    project: rowToProject(proj),
    sources: sourceRows.map((r) => rowToSource(r) as unknown as SourceRecord),
    settings,
  };
}

/**
 * Citation safety (the "tanpa sitasi fiktif" guarantee):
 * validate every <sup class="citation" data-source-id> token in AI output
 * against the project library. Unknown ids are dropped and reported.
 */
export function enforceCitations(html: string, allowedIds: Set<string>): { html: string; rejectedTokens: number } {
  let rejected = 0;
  const out = html.replace(
    /<sup[^>]*class="[^"]*citation[^"]*"[^>]*data-source-id="([^"]+)"[^>]*>([\s\S]*?)<\/sup>/g,
    (match, id: string) => {
      if (allowedIds.has(id)) return match;
      rejected++;
      return "";
    }
  );
  return { html: out, rejectedTokens: rejected };
}

export function aiError(e: unknown): { error: string } {
  return { error: safeError(e, "Layanan AI tidak merespons. Coba lagi.") };
}

export type { ChatMessage };
