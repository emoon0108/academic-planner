import { createHash } from "node:crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { UniversityResearchSource } from "./universityResearch";

export const MAX_IMPORTED_SOURCE_BYTES = 8 * 1024 * 1024;
export const MAX_SOURCE_TEXT_CHARACTERS = 24_000;

const SUPPORTED_MIME_TYPES = new Set([
  "application/pdf",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
]);

export type ImportedSourceInput = {
  name: string;
  mimeType: string;
  dataBase64: string;
};

function normalizeWhitespace(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(html: string) {
  return normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<(?:br|\/p|\/div|\/li|\/tr|h[1-6])\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
  );
}

function extensionFor(name: string) {
  const match = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function normalizeMimeType(name: string, mimeType: string) {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  if (SUPPORTED_MIME_TYPES.has(normalized)) return normalized;

  const extension = extensionFor(name);
  if (extension === "pdf") return "application/pdf";
  if (extension === "csv") return "text/csv";
  if (extension === "html" || extension === "htm") return "text/html";
  if (extension === "md" || extension === "markdown") return "text/markdown";
  if (extension === "txt") return "text/plain";
  return normalized;
}

function kindForMimeType(mimeType: string): NonNullable<UniversityResearchSource["kind"]> {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "text/csv") return "csv";
  if (mimeType === "text/html") return "html";
  return "text";
}

function decodeBase64(dataBase64: string) {
  const payload = dataBase64.includes(",")
    ? dataBase64.slice(dataBase64.indexOf(",") + 1)
    : dataBase64;
  const compact = payload.replace(/\s+/g, "");

  if (!compact || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
    throw new Error("The imported source is not valid base64 data.");
  }

  const buffer = Buffer.from(compact, "base64");
  if (buffer.byteLength === 0) throw new Error("The imported source is empty.");
  if (buffer.byteLength > MAX_IMPORTED_SOURCE_BYTES) {
    throw new Error(`Imported sources must be ${MAX_IMPORTED_SOURCE_BYTES / 1024 / 1024} MB or smaller.`);
  }
  return buffer;
}

async function extractPdfText(buffer: Buffer) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  });
  const document = await loadingTask.promise;
  const pages: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map(item => ("str" in item ? item.str : ""))
        .filter(Boolean)
        .join(" ");
      if (text.trim()) pages.push(text);
      if (pages.join("\n\n").length >= MAX_SOURCE_TEXT_CHARACTERS) break;
    }
  } finally {
    await document.cleanup();
    await loadingTask.destroy();
  }

  return normalizeWhitespace(pages.join("\n\n"));
}

async function extractText(buffer: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return extractPdfText(buffer);

  const decoded = buffer.toString("utf8").replace(/^\uFEFF/, "");
  if (mimeType === "text/html") return stripHtml(decoded);
  return normalizeWhitespace(decoded);
}

function safeSourceName(name: string) {
  const normalized = name
    .replace(/[\\/]/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
  return normalized || "Imported source";
}

export async function createImportedSource(input: ImportedSourceInput): Promise<UniversityResearchSource> {
  const title = safeSourceName(input.name);
  const mimeType = normalizeMimeType(title, input.mimeType);
  if (!SUPPORTED_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported source type: ${input.mimeType || extensionFor(title) || "unknown"}.`);
  }

  const buffer = decodeBase64(input.dataBase64);
  const contentHash = createHash("sha256").update(buffer).digest("hex");
  const text = await extractText(buffer, mimeType);
  if (text.length < 20) {
    throw new Error(`${title} did not contain enough extractable text.`);
  }

  const sourceId = contentHash.slice(0, 24);
  return {
    id: sourceId,
    title,
    url: `urn:academiq:source:${sourceId}`,
    excerpt: text.slice(0, MAX_SOURCE_TEXT_CHARACTERS),
    kind: kindForMimeType(mimeType),
    origin: "upload",
    mimeType,
    byteLength: buffer.byteLength,
    contentHash,
    retrievedAt: new Date().toISOString(),
  };
}
