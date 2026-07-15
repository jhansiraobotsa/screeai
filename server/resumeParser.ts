import { readFile } from "fs/promises";
import { extname } from "path";
import mammoth from "mammoth";

// PDF/DOCX extraction can emit NUL bytes and other control chars that Postgres
// rejects ("unsupported Unicode escape sequence"). Strip them before the text
// is stored or sent anywhere. Keep tab (\t), newline (\n), carriage return (\r).
export function sanitizeText(text: string): string {
  // Strip NUL + C0 control chars (keep \t \n \r), C1 control chars, and the
  // Unicode replacement char \uFFFD from bad decodes.
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFD]/g, "")
    .trim();
}

// Extract plain text from a resume file on disk. Returns null if it can't be
// read (e.g. a scanned-image PDF with no embedded text) — callers treat null
// as "not scored" rather than failing the application.
export async function extractResumeText(filePath: string): Promise<string | null> {
  try {
    const ext = extname(filePath).toLowerCase();
    if (ext === ".pdf") {
      const buffer = await readFile(filePath);
      // pdf-parse v2 API: new PDFParse({ data }).getText()
      const { PDFParse } = await import("pdf-parse");
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      const result = await parser.getText();
      await parser.destroy();
      const text = sanitizeText(result.text || "");
      return text.length > 0 ? text : null;
    }
    if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = sanitizeText(result.value || "");
      return text.length > 0 ? text : null;
    }
    return null;
  } catch (err) {
    console.error("[resumeParser] extract failed:", err);
    return null;
  }
}
