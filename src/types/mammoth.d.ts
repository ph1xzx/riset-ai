declare module "mammoth" {
  export type MammothResult = {
    value: string;
    messages: { type: string; message: string }[];
  };
  export function convertToHtml(
    input: { buffer: Buffer } | { arrayBuffer: ArrayBuffer } | { path: string },
    options?: {
      styleMap?: string | string[];
      ignoreEmptyParagraphs?: boolean;
      includeDefaultStyleMap?: boolean;
    }
  ): Promise<MammothResult>;
  export function extractRawText(
    input: { buffer: Buffer } | { arrayBuffer: ArrayBuffer } | { path: string }
  ): Promise<MammothResult>;
}
