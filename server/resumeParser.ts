import { readFile } from "fs/promises";
import { extname } from "path";
import mammoth from "mammoth";

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
      const text = (result.text || "").trim();
      return text.length > 0 ? text : null;
    }
    if (ext === ".docx") {
      const result = await mammoth.extractRawText({ path: filePath });
      const text = (result.value || "").trim();
      return text.length > 0 ? text : null;
    }
    return null;
  } catch (err) {
    console.error("[resumeParser] extract failed:", err);
    return null;
  }
}