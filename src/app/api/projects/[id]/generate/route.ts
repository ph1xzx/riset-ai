import { NextResponse } from "next/server";
import { chat, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject, rowToSource } from "@/lib/api";
import { enforceCitations } from "@/lib/ai-routes";
import { generateMessages } from "@/lib/prompts";
import { nowIso, genId, safeError, wordCount } from "@/lib/util";

/**
 * Generate (or regenerate) a section's content with the user's BYOK key.
 * Streams tokens to the client via SSE, then persists the result and runs
 * citation-safety validation (fake citation tokens are dropped).
 *
 * SSE events:
 *   {"type":"status","status":"DRAFTING"}
 *   {"type":"token","t":"..."}
 *   {"type":"done","content":"<html>","status":"AI_DRAFT","rejectedTokens":n,"wordCount":n}
 *   {"type":"error","error":"..."}
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }
  const sectionId = String(body.sectionId || "");

  const u = await apiUser();
  if ("res" in u) return u.res;
  const proj = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, u.user.id) as any;
  if (!proj) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  const section = db.prepare("SELECT * FROM sections WHERE id = ? AND project_id = ?").get(sectionId, id) as any;
  if (!section) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });
  const settings = getAiSettings(u.user.id);
  if (!settings) return NextResponse.json({ error: "API key belum diset — buka Settings." }, { status: 400 });

  const project = rowToProject(proj);
  const sourceRows = db.prepare("SELECT * FROM sources WHERE project_id = ?").all(id) as any[];
  const sources = sourceRows.map((r) => rowToSource(r));
  const sec = { id: section.id, title: section.title, level: section.level, content: section.content };

  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream({
    async start(ctrl) {
      const enc = new TextEncoder();
      const send = (obj: any) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        db.prepare("UPDATE sections SET status = 'DRAFTING', updated_at = ? WHERE id = ?").run(nowIso(), sec.id);
        send({ type: "status", status: "DRAFTING" });

        const prevTitles = (
          db.prepare('SELECT title FROM sections WHERE project_id = ? AND id != ? ORDER BY "order" ASC').all(id, sec.id) as any[]
        ).map((r) => r.title);

        let full = "";
        const content = await chat(
          settings,
          generateMessages(project, sec, prevTitles, sources, body.prompt),
          { signal: controller.signal, onToken: (t) => { full += t; send({ type: "token", t }); } }
        );

        const allowed = new Set(sources.map((s) => s.id));
        const { html, rejectedTokens } = enforceCitations(content, allowed);
        db.prepare("UPDATE sections SET content = ?, status = 'AI_DRAFT', updated_at = ? WHERE id = ?").run(html, nowIso(), sec.id);
        logActivity(id, sec.id, "generate", "", html.slice(0, 500));
        send({ type: "done", content: html, status: "AI_DRAFT", rejectedTokens, wordCount: wordCount(html) });
      } catch (e) {
        db.prepare("UPDATE sections SET status = 'AI_DRAFT', updated_at = ? WHERE id = ?").run(nowIso(), sec.id);
        send({ type: "error", error: safeError(e, "Gagal membuat draf. Coba lagi.") });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

function logActivity(projectId: string, sectionId: string, action: string, before: string, after: string) {
  try {
    db.prepare("INSERT INTO activity (id, project_id, section_id, action, before_text, after_text) VALUES (?,?,?,?,?,?)")
      .run(genId("act"), projectId, sectionId, action, before, after);
  } catch {
    /* non-critical */
  }
}
