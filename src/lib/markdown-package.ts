// Build "Markdown Package": chapters/*.md + assets/* + manifest.json (ZIP).
// Dipakai tombol "Export MD" di halaman proyek; bisa juga dijalanin di node
// untuk testing karena tidak menyentuh API browser-only.
import JSZip from "jszip";
import { htmlToMarkdown, slugFile, type Manifest } from "./markdown";

type AssetEntry = { src: string; key: string; data: Uint8Array | null };

export async function buildMarkdownPackage(
  project: {
    title: string;
    campusStyle: string;
    sections: { title: string; level: number; content: string }[];
  },
  base = "" // prefix URL untuk fetch aset relatif (dipakai testing di node)
): Promise<{ bytes: Uint8Array; manifest: Manifest }> {
  const zip = new JSZip();
  const assets = new Map<string, AssetEntry>();
  const campus: any = JSON.parse(project.campusStyle || "{}");

  const mapImg = (src: string, alt: string): string => {
    if (!src) return "assets/missing.png";
    if (/^https?:\/\//i.test(src) && !/localhost|\/api\/uploads\//i.test(src)) return src; // URL web: referensikan langsung
    const base = (src.split("/").pop() || "").split("?")[0];
    let name =
      /^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|gif|webp|svg)$/i.test(base) && base.length < 60
        ? base
        : `${(alt || "gambar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "gambar"}-${assets.size + 1}.png`;
    const existing = assets.get(name);
    if (existing && existing.src !== src) name = `x${assets.size + 1}-${name}`;
    if (!assets.has(name)) assets.set(name, { src, key: alt || name, data: null });
    return `assets/${name}`;
  };

  // group section → chapter files (level 1 = file baru; level 2 sampai 6 = heading di dalamnya)
  const chapters: { fileName: string; title: string; parts: string[] }[] = [];
  const used = new Set<string>();
  for (const sec of project.sections) {
    if (sec.level === 1 || chapters.length === 0) {
      let fn = slugFile(sec.title);
      if (used.has(fn)) fn = fn.replace(/\.md$/, `-${chapters.length + 1}.md`);
      used.add(fn);
      chapters.push({ fileName: fn, title: sec.title, parts: [`# ${sec.title}`, ""] });
    }
    const ch = chapters[chapters.length - 1];
    if (sec.level >= 2) {
      const depth = Math.min(sec.level, 6);
      ch.parts.push(`${"#".repeat(depth)} ${sec.title}`, "");
    }
    ch.parts.push(htmlToMarkdown(sec.content || "", mapImg));
    ch.parts.push("");
  }

  const manifest: Manifest = {
    project_title: project.title,
    build_config: {
      font_family: campus?.body?.font || "Times New Roman",
      font_size_body: campus?.body?.size ?? 12,
      line_spacing: campus?.body?.lineSpacing ?? 1.5,
      margins_cm: {
        top: campus?.margins?.top ?? 3,
        left: campus?.margins?.left ?? 4,
        bottom: campus?.margins?.bottom ?? 3,
        right: campus?.margins?.right ?? 3,
      },
    },
    chapters: chapters.map((c, i) => ({ order: i + 1, file_name: c.fileName, title: c.title })),
    required_assets: [],
  };

  // bundel aset
  for (const [name, a] of assets) {
    let data: Uint8Array | null = null;
    try {
      if (a.src.startsWith("data:")) {
        const m = a.src.match(/^data:[^,]+,([\s\S]+)$/);
        if (m) data = Uint8Array.from(Buffer.from(m[1], "base64"));
      } else {
        const res = await fetch(base + a.src);
        if (res.ok) data = new Uint8Array(await res.arrayBuffer());
      }
    } catch {
      data = null;
    }
    a.data = data;
    if (data) zip.file(`assets/${name}`, data);
    manifest.required_assets.push({ key: a.key, filename: name, status: data ? "uploaded" : "missing" });
  }

  for (const c of chapters) zip.file(`chapters/${c.fileName}`, c.parts.join("\n"));
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));

  const bytes = await zip.generateAsync({ type: "uint8array" });
  return { bytes, manifest };
}
