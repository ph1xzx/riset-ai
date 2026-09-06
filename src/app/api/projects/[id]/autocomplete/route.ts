import { NextResponse } from "next/server";
import { chat, getAiSettings } from "@/lib/ai";
import { db } from "@/lib/db";
import { apiUser, rowToProject, rowToSource } from "@/lib/api";
import { enforceCitations } from "@/lib/ai-routes";
import { autocompleteMessages } from "@/lib/prompts";
import { safeError } from "@/lib/util";

/**
 * Ghost-text autocomplete. The client sends the current paragraph prefix;
 * we stream the continuation. Tab accepts, Esc rejects (client-side).
 * The prefix must be long enough to be a real sentence start.
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
  const prefix = String(body.prefix || "");
  if (prefix.trim().length < 20) {
    return NextResponse.json({ error: "paragraf terlalu pendek untuk autocomplete" }, { status: 400 });
  }

  const u = await apiUser();
  if ("res" in u) return u.res;
  const proj = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(id, u.user.id) as any;
  if (!proj) return NextResponse.json({ error: "Proyek tidak ditemukan" }, { status: 404 });
  const section = db.prepare("SELECT * FROM sections WHERE id = ? AND project_id = ?").get(sectionId, id) as any;
  if (!section) return NextResponse.json({ error: "Section tidak ditemukan" }, { status: 404 });
  const settings = getAiSettings(u.user.id);
  if (!settings) return NextResponse.json({ error: "API key belum diset — buka Settings." }, { status: 400 });

  const project = rowToProject(proj);
  const sources = (db.prepare("SELECT * FROM sources WHERE project_id = ?").all(id) as any[]).map((r) => rowToSource(r));
  const controller = new AbortController();
  req.signal.addEventListener("abort", () => controller.abort());

  const stream = new ReadableStream({
    async start(ctrl) {
      const enc = new TextEncoder();
      const send = (obj: any) => ctrl.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        let full = "";
        const content = await chat(
          settings,
          autocompleteMessages(project, { title: section.title }, prefix, sources),
          {
            temperature: 0.4,
            maxTokens: 300,
            signal: controller.signal,
            onToken: (t) => { full += t; send({ type: "token", t }); },
          }
        );
        const allowed = new Set(sources.map((s) => s.id));
        const { html } = enforceCitations(full, allowed);
        send({ type: "done", content: html });
      } catch (e) {
        send({ type: "error", error: safeError(e, "Autocomplete gagal. Coba lagi.") });
      } finally {
        ctrl.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
