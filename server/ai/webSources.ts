import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createImportedSource, MAX_IMPORTED_SOURCE_BYTES } from "./sourceDocuments";
import type { UniversityResearchSource } from "./universityResearch";

const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 10_000;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

type ResolveHost = (hostname: string) => Promise<string[]>;
type FetchImplementation = typeof fetch;

export type ScrapeWebSourceOptions = {
  fetchImpl?: FetchImplementation;
  resolveHost?: ResolveHost;
  now?: () => Date;
};

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [first, second] = octets;
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 100 && second >= 64 && second <= 127)
    || first >= 224;
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

export function isPrivateNetworkAddress(address: string) {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

async function defaultResolveHost(hostname: string) {
  const results = await lookup(hostname, { all: true, verbatim: true });
  return results.map(result => result.address);
}

async function validatePublicUrl(rawUrl: string, resolveHost: ResolveHost) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error("Enter a valid website URL.");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Only HTTP and HTTPS sources are supported.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("Website URLs cannot contain credentials.");
  }

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Private or local network sources are not allowed.");
  }

  const literalVersion = isIP(hostname);
  const addresses = literalVersion ? [hostname] : await resolveHost(hostname);
  if (addresses.length === 0 || addresses.some(isPrivateNetworkAddress)) {
    throw new Error("Private or local network sources are not allowed.");
  }
  return parsed;
}

async function readLimitedBody(response: Response) {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_IMPORTED_SOURCE_BYTES) {
    throw new Error("Website content is larger than the 8 MB source limit.");
  }
  if (!response.body) throw new Error("The website returned an empty response.");

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_IMPORTED_SOURCE_BYTES) {
        await reader.cancel();
        throw new Error("Website content is larger than the 8 MB source limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), totalBytes);
}

function titleFromHtml(buffer: Buffer, fallbackUrl: URL) {
  const html = buffer.toString("utf8");
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (match?.[1] ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
  return title.slice(0, 180) || fallbackUrl.hostname;
}

function filenameFor(url: URL, mimeType: string) {
  const pathName = decodeURIComponent(url.pathname.split("/").pop() || "").slice(0, 140);
  if (pathName && /\.[a-z0-9]{2,8}$/i.test(pathName)) return pathName;
  if (mimeType === "application/pdf") return `${url.hostname}.pdf`;
  if (mimeType === "text/csv") return `${url.hostname}.csv`;
  if (mimeType === "text/plain") return `${url.hostname}.txt`;
  return `${url.hostname}.html`;
}

export async function scrapeWebSource(
  rawUrl: string,
  options: ScrapeWebSourceOptions = {},
): Promise<UniversityResearchSource> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const resolveHost = options.resolveHost ?? defaultResolveHost;
  const now = options.now ?? (() => new Date());
  let currentUrl = await validatePublicUrl(rawUrl, resolveHost);
  const requestedUrl = currentUrl.toString();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      response = await fetchImpl(currentUrl, {
        redirect: "manual",
        headers: {
          accept: "text/html,application/xhtml+xml,application/pdf,text/csv,text/plain;q=0.8",
          "user-agent": "AcademiQSourceBot/1.0 (+academic planning research)",
        },
        signal: controller.signal,
      });

      if (!REDIRECT_STATUSES.has(response.status)) break;
      const location = response.headers.get("location");
      if (!location) throw new Error("The website returned an invalid redirect.");
      if (redirectCount === MAX_REDIRECTS) throw new Error("The website redirected too many times.");
      currentUrl = await validatePublicUrl(new URL(location, currentUrl).toString(), resolveHost);
    }

    if (!response?.ok) {
      throw new Error(`The website returned HTTP ${response?.status ?? "unknown"}.`);
    }

    const mimeType = (response.headers.get("content-type") ?? "text/html").split(";")[0].trim().toLowerCase();
    if (!["text/html", "application/xhtml+xml", "application/pdf", "text/csv", "text/plain"].includes(mimeType)) {
      throw new Error(`Unsupported website content type: ${mimeType || "unknown"}.`);
    }
    const normalizedMimeType = mimeType === "application/xhtml+xml" ? "text/html" : mimeType;
    const buffer = await readLimitedBody(response);
    const imported = await createImportedSource({
      name: filenameFor(currentUrl, normalizedMimeType),
      mimeType: normalizedMimeType,
      dataBase64: buffer.toString("base64"),
    });
    const retrievedAt = now().toISOString();

    return {
      ...imported,
      id: createHash("sha256").update(currentUrl.toString()).digest("hex").slice(0, 24),
      title: normalizedMimeType === "text/html" ? titleFromHtml(buffer, currentUrl) : imported.title,
      url: currentUrl.toString(),
      requestedUrl,
      kind: normalizedMimeType === "text/html" ? "web" : imported.kind,
      origin: "provided_url",
      retrievedAt,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("The website did not respond within 10 seconds.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
