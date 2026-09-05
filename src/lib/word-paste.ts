import { normalizeTableHtml } from "./table-format";

const ALLOWED_TAGS = new Set([
  "p", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s", "br", "blockquote",
  "ul", "ol", "li", "table", "tbody", "thead", "tr", "th", "td", "a", "img",
]);

function safeUrl(value: string, kind: "href" | "src"): string {
  const trimmed = value.trim();
  if (kind === "src") return /^(https?:|data:image\/)/i.test(trimmed) ? trimmed : "";
  return /^(https?:|mailto:|\/|#)/i.test(trimmed) ? trimmed : "";
}

function attrsFor(tag: string, rawAttrs: string): string {
  const keep = tag === "a" ? new Set(["href", "title"]) : tag === "img" ? new Set(["src", "alt", "title"]) : new Set<string>();
  const attrs: string[] = [];
  const re = /([:\w-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(rawAttrs)) !== null) {
    const name = match[1].toLowerCase();
    if (!keep.has(name)) continue;
    const value = match[2].replace(/^['"]|['"]$/g, "");
    const clean = name === "href" || name === "src" ? safeUrl(value, name) : value;
    if (clean) attrs.push(`${name}="${clean.replace(/"/g, "&quot;")}"`);
  }
  return attrs.length ? ` ${attrs.join(" ")}` : "";
}

function styledSpansToMarks(html: string): string {
  return html.replace(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi, (_full, rawAttrs: string, inner: string) => {
    const style = rawAttrs.match(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
    const marks: string[] = [];
    if (/font-weight\s*:\s*(?:bold|[7-9]00)/i.test(style)) marks.push("strong");
    if (/font-style\s*:\s*(?:italic|oblique)/i.test(style)) marks.push("em");
    return `${marks.map((mark) => `<${mark}>`).join("")}${inner}${marks.slice().reverse().map((mark) => `</${mark}>`).join("")}`;
  });
}

/**
 * Turns common Word clipboard HTML into the small, predictable HTML dialect
 * used by TipTap. It keeps meaningful marks and links while dropping Mso
 * wrappers, inline styles, tracking attributes, and unsafe URLs.
 */
export function cleanWordPaste(input: string): string {
  let html = String(input || "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(style|script|meta|link|xml)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(style|script|meta|link|xml)\b[^>]*\/?>/gi, "")
    .replace(/<\/?(?:o:p|w:[\w-]+)\b[^>]*>/gi, "")
    .replace(/&nbsp;/gi, " ");

  html = html
    .replace(/<p\b([^>]*)>/gi, (full, rawAttrs: string) => {
      const cls = rawAttrs.match(/\bclass\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "";
      if (/msoheading1|heading\s*1/i.test(cls)) return "<h1>";
      if (/msoheading2|heading\s*2/i.test(cls)) return "<h2>";
      if (/msoheading3|heading\s*3/i.test(cls)) return "<h3>";
      return "<p>";
    })
    .replace(/<\/?div\b[^>]*>/gi, (tag) => (tag.startsWith("</") ? "</p>" : "<p>"));

  html = styledSpansToMarks(html).replace(/<\/?span\b[^>]*>/gi, "");
  html = html.replace(/<\/?font\b[^>]*>/gi, "");
  html = html.replace(/<([a-z][\w:-]*)(\s[^>]*)?>/gi, (full, rawTag: string, rawAttrs = "") => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) return "";
    if (tag === "br") return "<br>";
    return `<${tag}${attrsFor(tag, rawAttrs)}>`;
  });
  html = html.replace(/<\/([a-z][\w:-]*)\s*>/gi, (full, rawTag: string) => {
    const tag = rawTag.toLowerCase();
    return ALLOWED_TAGS.has(tag) && tag !== "br" && tag !== "img" ? `</${tag}>` : "";
  });

  return normalizeTableHtml(html.trim());
}
