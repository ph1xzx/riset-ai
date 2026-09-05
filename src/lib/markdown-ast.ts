// Parser markdown berbasis AST (unified/remark + GFM): menggantikan parser regex
// supaya nested list, blockquote, tabel GFM, dan link ikut terkonversi benar.
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import type { Root, RootContent, PhrasingContent, ListItem, Table } from "mdast";
import type { MdSection } from "./markdown";
import { normalizeTableHtml } from "./table-format";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(nodes: PhrasingContent[]): string {
  let out = "";
  for (const n of nodes) {
    switch (n.type) {
      case "text":
        out += esc(n.value);
        break;
      case "strong":
        out += `<strong>${inline(n.children)}</strong>`;
        break;
      case "emphasis":
        out += `<em>${inline(n.children)}</em>`;
        break;
      case "delete":
        out += `<s>${inline((n as any).children)}</s>`;
        break;
      case "inlineCode":
        out += `<code>${esc((n as any).value)}</code>`;
        break;
      case "break":
        out += "<br>";
        break;
      case "link": {
        const l = n as any;
        out += `<a href="${esc(l.url)}">${inline(l.children)}</a>`;
        break;
      }
      case "image": {
        const im = n as any;
        out += `<img src="${esc(im.url)}" alt="${esc(im.alt || "")}" />`;
        break;
      }
      default:
        if ("children" in (n as any)) out += inline((n as any).children);
        else if ("value" in (n as any)) out += esc((n as any).value);
    }
  }
  return out;
}

function blocks(nodes: RootContent[]): string {
  let out = "";
  for (const n of nodes) {
    switch (n.type) {
      case "paragraph":
        out += `<p>${inline((n as any).children)}</p>`;
        break;
      case "blockquote":
        out += `<blockquote>${blocks((n as any).children)}</blockquote>`;
        break;
      case "list":
        out += listHtml(n as any);
        break;
      case "table": {
        const t = n as Table;
        let tableHtml = "<table><tbody>";
        t.children.forEach((row, ri) => {
          tableHtml += "<tr>";
          for (const cell of row.children)
            tableHtml += ri === 0 ? `<th>${inline(cell.children as any)}</th>` : `<td>${inline(cell.children as any)}</td>`;
          tableHtml += "</tr>";
        });
        out += normalizeTableHtml(`${tableHtml}</tbody></table>`);
        break;
      }
      case "heading": {
        // heading di tengah konten (depth>=3) jadi h3; depth 1/2 ditangani caller
        out += `<h3>${inline((n as any).children)}</h3>`;
        break;
      }
      case "thematicBreak":
        out += `<p>— — —</p>`;
        break;
      case "html":
        // sisipkan apa adanya (trusted: file milik user sendiri)
        out += (n as any).value;
        break;
      default:
        break;
    }
  }
  return out;
}

function listHtml(node: any): string {
  const tag = node.ordered ? "ol" : "ul";
  let out = `<${tag}>`;
  for (const item of node.children as ListItem[]) {
    // anak li: paragraph + nested list
    const paras = item.children.filter((c: any) => c.type === "paragraph");
    const nested = item.children.filter((c: any) => c.type === "list");
    const other = item.children.filter((c: any) => c.type !== "paragraph" && c.type !== "list");
    out += `<li>${inline2(paras)}${other.map((o: any) => blocks([o])).join("")}${nested.map((nl: any) => listHtml(nl)).join("")}</li>`;
  }
  out += `</${tag}>`;
  return out;
}

function inline2(paras: any[]): string {
  return paras.map((p: any) => inline(p.children)).join("<br>");
}

export function markdownToSectionsAst(md: string): MdSection[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(md.replace(/\r\n/g, "\n")) as Root;
  const sections: MdSection[] = [];
  let cur: MdSection | null = null;
  const ensure = (title: string, level: 1 | 2) => {
    cur = { title, level, html: "" };
    sections.push(cur);
  };
  const push = (html: string) => {
    if (!cur) ensure("(Bagian awal)", 1);
    cur!.html += html;
  };

  for (const n of tree.children) {
    if (n.type === "heading") {
      const h = n as any;
      const text = inline(h.children).replace(/<[^>]+>/g, "").trim();
      if (h.depth === 1) ensure(text, 1);
      else if (h.depth === 2) ensure(text, 2);
      else push(`<h3>${inline(h.children)}</h3>`);
      continue;
    }
    push(blocks([n]));
  }
  return sections;
}
