export type TableCellTag = "th" | "td";

export type TableCellData = {
  tag: TableCellTag;
  html: string;
};

export type TableRowData = {
  cells: TableCellData[];
};

const TABLE_RE = /<table\b[^>]*>[\s\S]*?<\/table>/gi;
const ROW_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
const CELL_RE = /<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi;

function readRows(tableHtml: string): TableRowData[] {
  const rows: TableRowData[] = [];
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = ROW_RE.exec(tableHtml)) !== null) {
    const cells: TableCellData[] = [];
    let cellMatch: RegExpExecArray | null;
    CELL_RE.lastIndex = 0;
    while ((cellMatch = CELL_RE.exec(rowMatch[1])) !== null) {
      cells.push({
        tag: cellMatch[1].toLowerCase() === "th" ? "th" : "td",
        html: cellMatch[2].trim(),
      });
    }
    if (cells.length) rows.push({ cells });
  }
  return rows;
}

function renderRows(rows: TableRowData[]): string {
  const width = Math.max(...rows.map((row) => row.cells.length), 0);
  if (!width) return "";

  return rows
    .map((row, rowIndex) => {
      const cells = Array.from({ length: width }, (_, index) => row.cells[index] || { tag: "td" as const, html: "" });
      return `<tr>${cells
        .map((cell) => {
          const tag = rowIndex === 0 ? "th" : "td";
          return `<${tag}>${cell.html}</${tag}>`;
        })
        .join("")}</tr>`;
    })
    .join("");
}

/**
 * Keeps tables in one small HTML dialect shared by TipTap, Markdown, and DOCX.
 * The first row is the header, ragged rows are padded, and Word-only wrappers
 * such as thead/tbody are reduced to the structure TipTap can round-trip.
 */
export function normalizeTableHtml(html: string): string {
  return html.replace(TABLE_RE, (tableHtml) => {
    const rows = readRows(tableHtml);
    const rendered = renderRows(rows);
    return rendered ? `<table><tbody>${rendered}</tbody></table>` : tableHtml;
  });
}

export function getTableRows(tableHtml: string): TableRowData[] {
  const normalized = normalizeTableHtml(tableHtml);
  const table = normalized.match(TABLE_RE)?.[0] || normalized;
  return readRows(table);
}

export function countTables(html: string): number {
  return html.match(TABLE_RE)?.length || 0;
}
