// Test loop penuh: Export MD package (lib asli) → impor balik via route → export DOCX.
import JSZip from "jszip";
import fs from "fs";
import { buildMarkdownPackage } from "../src/lib/markdown-package";
import { markdownToSections, scanImageRefs } from "../src/lib/markdown";

const BASE = "http://localhost:3000";
const SRC_PID = process.argv[2];

async function main() {
  const project = await (await fetch(`${BASE}/api/projects/${SRC_PID}`)).json();

  // 1) export MD package pakai lib yang sama dengan tombol UI
  const { bytes, manifest } = await buildMarkdownPackage(project, BASE);
  fs.writeFileSync("/tmp/pkg.zip", Buffer.from(bytes));
  console.log("zip bytes:", bytes.length, "| chapters:", manifest.chapters.length, "| assets:", manifest.required_assets.length);

  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files).sort();
  console.log("entries:", names.slice(0, 6).join(", "), "…");
  const man = JSON.parse(await zip.files["manifest.json"].async("text"));
  console.log("manifest build_config:", JSON.stringify(man.build_config));

  // 2) simulasi impor: parse chapters, upload aset, POST route
  const urlBy: Record<string, string> = {};
  for (const a of man.required_assets) {
    const e = zip.files[`assets/${a.filename}`];
    if (!e) continue;
    const buf = await e.async("nodebuffer");
    const fd = new FormData();
    fd.append("file", new File([new Uint8Array(buf)], a.filename, { type: "image/png" }));
    const up = await (await fetch(`${BASE}/api/uploads`, { method: "POST", body: fd })).json();
    urlBy[a.filename] = up.url;
  }

  const order = [...man.chapters].sort((a, b) => a.order - b.order);
  const sections: any[] = [];
  for (const ch of order) {
    let text = await zip.files[`chapters/${ch.file_name}`].async("text");
    text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (mm, alt, path) => {
      if (/^https?:\/\//i.test(path)) return mm;
      const url = urlBy[path.split("/").pop() || path];
      return url ? `![${alt}](${url})` : "";
    });
    sections.push(...markdownToSections(text));
  }
  console.log("parsed sections:", sections.length, "| refs:", scanImageRefs(await zip.files[`chapters/${order[0].file_name}`].async("text")).length);

  const created = await (
    await fetch(`${BASE}/api/import/markdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: man.project_title + " (loop)", campusStyle: undefined, sections }),
    })
  ).json();
  console.log("new project:", created.project?.id, "sections:", created.sections);

  // 3) export DOCX proyek hasil loop
  const res = await fetch(`${BASE}/api/projects/${created.project.id}/export`, { method: "POST" });
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync("/tmp/loop-export.docx", buf);
  console.log("loop export docx:", res.status, buf.length, "bytes, magic:", buf.slice(0, 2).toString());
}

main().catch((e) => {
  console.error("ERR", e);
  process.exit(1);
});
