import fs from "fs/promises";
import path from "path";
import { GoogleAIFileManager, FileState } from "@google/generative-ai/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { withModelFallback } from "@/lib/ai/retry";

function getGeminiModelChain(): string[] {
  const primary = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const fallbacks = (process.env.GEMINI_MODEL_FALLBACKS ?? "gemini-flash-latest,gemini-2.0-flash")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [primary, ...fallbacks.filter((m) => m !== primary)];
}

export type ParsedDocument = {
  text: string;
  metadata: {
    pageCount?: number;
    title?: string;
    author?: string;
  };
};

export async function parseFile(filePath: string, _mimeType: string): Promise<ParsedDocument> {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".pdf":
      return parsePdf(filePath);
    case ".docx":
      return parseDocx(filePath);
    case ".txt":
    case ".md":
      return parsePlainText(filePath);
    default:
      throw new Error(`Unsupported file type: ${ext}`);
  }
}

async function parsePdf(filePath: string): Promise<ParsedDocument> {
  // Use Gemini Files API — zero memory overhead, handles complex/scanned PDFs.
  // pdf-parse / pdfjs-dist OOMs on PDFs with complex font tables.
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("PDF parsing requires GEMINI_API_KEY (set AI_PROVIDER=gemini in .env.local)");
  }

  const buffer = await fs.readFile(filePath);
  const fileManager = new GoogleAIFileManager(apiKey);
  const genAI = new GoogleGenerativeAI(apiKey);

  const uploaded = await fileManager.uploadFile(buffer, {
    mimeType: "application/pdf",
    displayName: path.basename(filePath),
  });

  try {
    // Files API processes async — poll until ACTIVE
    let file = uploaded.file;
    while (file.state === FileState.PROCESSING) {
      await new Promise((r) => setTimeout(r, 2000));
      file = await fileManager.getFile(file.name);
    }
    if (file.state === FileState.FAILED) {
      throw new Error("Gemini failed to process this PDF");
    }

    const result = await withModelFallback(
      getGeminiModelChain(),
      (modelName) =>
        genAI.getGenerativeModel({ model: modelName }).generateContent([
          { fileData: { mimeType: file.mimeType, fileUri: file.uri } },
          {
            text: "Extract all text from this PDF document exactly as written. Return only the extracted text with no commentary, formatting, or markdown.",
          },
        ]),
      { label: "pdf-parse", retries: 2, baseDelayMs: 800 }
    );

    return {
      text: result.response.text(),
      metadata: {},
    };
  } finally {
    await fileManager.deleteFile(uploaded.file.name).catch(() => {});
  }
}

async function parseDocx(filePath: string): Promise<ParsedDocument> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ path: filePath });
  return { text: result.value, metadata: {} };
}

async function parsePlainText(filePath: string): Promise<ParsedDocument> {
  const text = await fs.readFile(filePath, "utf-8");
  return { text, metadata: {} };
}
