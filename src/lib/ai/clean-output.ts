/**
 * AI Edit dan Parafrase mengisi editor dengan teks biasa.
 * Bersihkan Markdown yang kadang ikut dikembalikan model agar tanda format
 * tidak bocor ke naskah akademik.
 */
export function cleanAcademicOutput(text: string): string {
  return text
    .replace(/```[a-zA-Z0-9_-]*\s*/g, "")
    .replace(/```/g, "")
    .replace(/^\s*[*+-]\s+/gm, "")
    .replace(/\*\*([\s\S]*?)\*\*/g, "$1")
    .replace(/__([\s\S]*?)__/g, "$1")
    .replace(/\*([^*\r\n]+)\*/g, "$1")
    .replace(/_([^_\r\n]+)_/g, "$1")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\*/g, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
