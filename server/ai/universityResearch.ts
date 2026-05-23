import { callDataApi } from "../_core/dataApi";
import { ENV } from "../_core/env";

export type UniversityResearchSource = {
  title: string;
  url: string;
  excerpt: string;
};

export type UniversityResearchResult = {
  status: "sources_found" | "no_sources_found" | "unavailable";
  sources: UniversityResearchSource[];
  notes: string[];
};

type SearchCandidate = {
  title?: unknown;
  name?: unknown;
  url?: unknown;
  link?: unknown;
  href?: unknown;
  snippet?: unknown;
  description?: unknown;
  content?: unknown;
};

const DIRECT_URL_PATTERN = /https?:\/\/[^\s<>)"']+/gi;
const MAX_DIRECT_URLS = 3;
const MAX_SEARCH_QUERIES = 4;
const MAX_SEARCH_RESULTS = 5;
const MAX_SOURCES = 4;

const sourceCache = new Map<string, UniversityResearchSource>();

export function extractUrls(text: string): string[] {
  const matches = text.match(DIRECT_URL_PATTERN) ?? [];
  return Array.from(new Set(matches.map(url => url.replace(/[.,;:!?]+$/, ""))));
}

export function buildResearchQueries({
  message,
  schoolName,
  majorName,
}: {
  message: string;
  schoolName?: string | null;
  majorName?: string | null;
}): string[] {
  const school = schoolName?.trim();
  const major = majorName?.trim();
  const focus = message.replace(DIRECT_URL_PATTERN, "").replace(/\s+/g, " ").trim();
  const target = [school, major].filter(Boolean).join(" ");

  if (!school && !focus) return [];

  const base = target || school || "university";
  const queries = [
    `${base} ${focus} official academic catalog registrar`,
    `${base} ${focus} course schedule prerequisites`,
    `${base} ${focus} degree requirements advising`,
    `${base} ${focus} site:.edu`,
  ];

  return Array.from(new Set(queries.map(q => q.replace(/\s+/g, " ").trim())))
    .filter(Boolean)
    .slice(0, MAX_SEARCH_QUERIES);
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function isProbablyOfficialUniversityUrl(url: string, schoolName?: string | null) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    if (hostname.endsWith(".edu")) return true;

    const schoolTokens = (schoolName ?? "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(token => token.length > 3);

    return schoolTokens.some(token => hostname.includes(token));
  } catch {
    return false;
  }
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function titleFromHtml(html: string, fallbackUrl: string) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = stripHtml(titleMatch?.[1] ?? "");
  if (title) return title.slice(0, 160);

  try {
    return new URL(fallbackUrl).hostname;
  } catch {
    return fallbackUrl;
  }
}

async function fetchSource(url: string): Promise<UniversityResearchSource | null> {
  const cached = sourceCache.get(url);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      headers: {
        accept: "text/html,application/xhtml+xml,application/pdf;q=0.8,text/plain;q=0.7,*/*;q=0.5",
        "user-agent": "AcademiQ academic planning research bot",
      },
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/pdf")) {
      const source = {
        title: url,
        url,
        excerpt: "PDF source found. Open this official document to verify exact wording before relying on the policy.",
      };
      sourceCache.set(url, source);
      return source;
    }

    const html = await response.text();
    const text = stripHtml(html).slice(0, 1800);
    if (!text) return null;

    const source = {
      title: titleFromHtml(html, url),
      url,
      excerpt: text,
    };
    sourceCache.set(url, source);
    return source;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function collectCandidates(payload: unknown): SearchCandidate[] {
  if (!payload || typeof payload !== "object") return [];

  const seen = new Set<SearchCandidate>();
  const candidates: SearchCandidate[] = [];
  const queue: unknown[] = [payload];

  while (queue.length > 0 && candidates.length < 30) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    const maybeUrl = record.url ?? record.link ?? record.href;
    if (typeof maybeUrl === "string" && !seen.has(record)) {
      candidates.push(record);
      seen.add(record);
    }

    for (const value of Object.values(record)) {
      if (typeof value === "object" && value !== null) queue.push(value);
    }
  }

  return candidates;
}

async function searchSources(query: string): Promise<SearchCandidate[]> {
  const apiIds = ["Google/search", "google/search", "Search/search"];

  for (const apiId of apiIds) {
    try {
      const payload = await callDataApi(apiId, {
        query: { q: query, gl: "US", hl: "en" },
      });
      const candidates = collectCandidates(payload);
      if (candidates.length > 0) return candidates;
    } catch {
      // Try the next known search API shape.
    }
  }

  return [];
}

export function formatResearchContext(result: UniversityResearchResult) {
  if (result.sources.length === 0) {
    return `\n\nUniversity source retrieval:\nStatus: ${result.status}\nNotes:\n${result.notes.map(note => `- ${note}`).join("\n")}`;
  }

  return `\n\nUniversity source retrieval:
Status: ${result.status}
Sources:
${result.sources
  .map(
    (source, index) => `[${index + 1}] ${source.title}
URL: ${source.url}
Excerpt: ${source.excerpt}`
  )
  .join("\n\n")}
Notes:
${result.notes.map(note => `- ${note}`).join("\n")}`;
}

export async function retrieveUniversityResearch({
  message,
  schoolName,
  majorName,
}: {
  message: string;
  schoolName?: string | null;
  majorName?: string | null;
}): Promise<UniversityResearchResult> {
  const notes: string[] = [];
  const sourceMap = new Map<string, UniversityResearchSource>();

  const directUrls = extractUrls(message)
    .filter(url => isProbablyOfficialUniversityUrl(url, schoolName))
    .slice(0, MAX_DIRECT_URLS);

  for (const url of directUrls) {
    const source = await fetchSource(url);
    if (source) sourceMap.set(source.url, source);
  }

  const queries = buildResearchQueries({ message, schoolName, majorName });
  for (const query of queries) {
    if (sourceMap.size >= MAX_SOURCES) break;

    const candidates = await searchSources(query);
    for (const candidate of candidates.slice(0, MAX_SEARCH_RESULTS)) {
      if (sourceMap.size >= MAX_SOURCES) break;

      const url = normalizeText(candidate.url ?? candidate.link ?? candidate.href);
      if (!url || sourceMap.has(url)) continue;
      if (!isProbablyOfficialUniversityUrl(url, schoolName)) continue;

      const fetched = await fetchSource(url);
      if (fetched) {
        sourceMap.set(url, {
          ...fetched,
          title: normalizeText(candidate.title ?? candidate.name) || fetched.title,
          excerpt: fetched.excerpt || normalizeText(candidate.snippet ?? candidate.description ?? candidate.content),
        });
      }
    }
  }

  if (directUrls.length === 0) {
    notes.push("No official source URLs were pasted by the student.");
  }

  if (sourceMap.size === 0 && queries.length > 0) {
    notes.push("No official pages could be retrieved automatically. Ask the student for a registrar, catalog, department, or course schedule URL.");
    if (!ENV.forgeApiUrl || !ENV.forgeApiKey) {
      notes.push("Automatic web search is not configured in this local app. Add BUILT_IN_FORGE_API_URL and BUILT_IN_FORGE_API_KEY, or paste official source URLs with the target.");
    }
  }

  if (sourceMap.size > 0) {
    notes.push("Use retrieved sources for citations, but tell the student to verify final decisions with an advisor or registrar when stakes are high.");
  }

  if (queries.length === 0) {
    notes.push("The student profile did not include enough school context to form a targeted university search.");
  }

  return {
    status: sourceMap.size > 0 ? "sources_found" : "no_sources_found",
    sources: Array.from(sourceMap.values()).slice(0, MAX_SOURCES),
    notes,
  };
}
