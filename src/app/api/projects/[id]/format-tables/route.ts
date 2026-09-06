import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiProject } from "@/lib/api";
import { nowIso } from "@/lib/util";
import * as cheerio from "cheerio";

/**
 * Normalize all tables in every section: add the campus-table class, ensure a
 * <thead> for header rows, and wrap body rows in <tbody>.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await apiProject(id);
  if ("res" in r) return r.res;

  const sections = db.prepare("SELECT * FROM sections WHERE project_id = ? AND content != ''").all(id) as any[];
  let changed = 0;

  for (const s of sections) {
    const after = normalizeTables(s.content);
    if (after !== s.content) {
      db.prepare("UPDATE sections SET content = ?, updated_at = ? WHERE id = ?").run(after, nowIso(), s.id);
      changed++;
    }
  }
  return NextResponse.json({ sectionsChanged: changed });
}

function normalizeTables(html: string): string {
  if (!html.includes("<table")) return html;
  const $ = cheerio.load(html, null, false);
  $("table").each((_, t) => {
    const $t = $(t);
    $t.addClass("campus-table");
    const rows = $t.find("tr");
    if (!rows.length) return;
    const firstHasTh = $(rows[0]).find("th").length > 0;
    // strip any existing thead/tbody
    $t.find("thead, tbody").contents().unwrap();
    if (firstHasTh) {
      const tbodyRows = rows.slice(1).map((_: number, tr: any) => $(tr).clone().html() ?? "").get().join("");
      $t.html(`<thead>${$(rows[0]).html() ?? ""}</thead><tbody>${tbodyRows}</tbody>`);
    } else {
      const tbodyRows = rows.map((_: number, tr: any) => ` <tr>${$(tr).html() ?? ""}</tr>`).get().join("");
      $t.html(`<tbody>${tbodyRows}</tbody>`);
    }
  });
  return $.html();
}
