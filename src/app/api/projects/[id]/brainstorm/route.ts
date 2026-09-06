import { NextResponse } from "next/server";
import { chatJson } from "@/lib/ai";
import { apiProject } from "@/lib/api";
import { brainstormMessages } from "@/lib/prompts";
import { aiError } from "@/lib/ai-routes";
import { getAiSettings } from "@/lib/ai";

/**
 * Generate 5 title candidates.
 * Bugfix vs original: the original failed with "AI tidak mengembalikan JSON"
 * because it parsed the raw response directly. We now use robust JSON
 * extraction (code-fence / prose tolerant) + json_mode + retry.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;

  const settings = getAiSettings(r.user.id);
  if (!settings) {
    return NextResponse.json({ error: "API key belum diset — buka Settings." }, { status: 400 });
  }

  let topic: string;
  try {
    const body = await req.json();
    topic = String(body.topic || r.project.topic || r.project.title).trim();
  } catch {
    topic = r.project.topic || r.project.title;
  }

  const project = { ...r.project, topic };
  try {
    const res = await chatJson<{ titles: string[] }>(settings, brainstormMessages(project), {
      temperature: 0.9,
      maxTokens: 1200,
    });
    const titles = (res.titles || [])
      .map((t) => String(t).trim())
      .filter((t) => t.length > 10)
      .slice(0, 5);
    if (!titles.length) return NextResponse.json({ error: "AI tidak menghasilkan judul" }, { status: 502 });
    return NextResponse.json({ titles });
  } catch (e) {
    return NextResponse.json(aiError(e), { status: 502 });
  }
}
