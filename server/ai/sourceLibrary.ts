import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { UniversityResearchSource } from "./universityResearch";

const MAX_LIBRARY_SOURCES = 200;
const DEFAULT_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

export type SourceCrawlStatus = "ready" | "failed";
export type SourceFreshness = "fresh" | "stale" | "unavailable";

export type SourceLibraryRecord = UniversityResearchSource & {
  id: string;
  schoolName: string;
  majorName: string;
  crawlStatus: SourceCrawlStatus;
  createdAt: string;
  updatedAt: string;
  lastFetchedAt: string | null;
  refreshAfter: string | null;
  lastError?: string;
};

export type SourceLibraryState = {
  updatedAt: string | null;
  sources: SourceLibraryRecord[];
};

function libraryPathFor(scope: string | number) {
  const safeScope = String(scope).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "global";
  return resolve(process.cwd(), "data/runtime", `source-library-${safeScope}.json`);
}

function recordId(schoolName: string, majorName: string, sourceIdentity: string) {
  return createHash("sha256")
    .update(`${schoolName.trim().toLowerCase()}\0${majorName.trim().toLowerCase()}\0${sourceIdentity}`)
    .digest("hex")
    .slice(0, 24);
}

export function sourceLibraryIdentity(source: UniversityResearchSource) {
  return source.url.startsWith("http://") || source.url.startsWith("https://")
    ? source.requestedUrl ?? source.url
    : source.contentHash ?? source.url;
}

export function sourceFreshness(record: SourceLibraryRecord, now = new Date()): SourceFreshness {
  if (record.crawlStatus === "failed" || !record.lastFetchedAt) return "unavailable";
  if (!record.refreshAfter) return "fresh";
  return new Date(record.refreshAfter).getTime() <= now.getTime() ? "stale" : "fresh";
}

export function mergeSourceLibraryRecords(
  state: SourceLibraryState,
  incoming: SourceLibraryRecord[],
): SourceLibraryState {
  const existing = new Map(state.sources.map(source => [source.id, source]));
  for (const source of incoming) {
    const previous = existing.get(source.id);
    existing.set(source.id, {
      ...previous,
      ...source,
      createdAt: previous?.createdAt ?? source.createdAt,
    });
  }

  const sources = Array.from(existing.values())
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, MAX_LIBRARY_SOURCES);
  return {
    updatedAt: incoming[0]?.updatedAt ?? state.updatedAt,
    sources,
  };
}

export async function readSourceLibrary(scope: string | number): Promise<SourceLibraryState> {
  try {
    return JSON.parse(await readFile(libraryPathFor(scope), "utf8")) as SourceLibraryState;
  } catch {
    return { updatedAt: null, sources: [] };
  }
}

async function writeSourceLibrary(scope: string | number, state: SourceLibraryState) {
  const path = libraryPathFor(scope);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function saveSourcesToLibrary({
  scope,
  schoolName,
  majorName,
  sources,
  now = new Date(),
}: {
  scope: string | number;
  schoolName: string;
  majorName: string;
  sources: UniversityResearchSource[];
  now?: Date;
}) {
  const timestamp = now.toISOString();
  const records: SourceLibraryRecord[] = sources.map(source => {
    const lastFetchedAt = source.retrievedAt ?? timestamp;
    return {
      ...source,
      id: recordId(schoolName, majorName, sourceLibraryIdentity(source)),
      schoolName,
      majorName,
      crawlStatus: "ready",
      createdAt: timestamp,
      updatedAt: timestamp,
      lastFetchedAt,
      refreshAfter: new Date(new Date(lastFetchedAt).getTime() + DEFAULT_REFRESH_INTERVAL_MS).toISOString(),
      lastError: undefined,
    };
  });
  const nextState = mergeSourceLibraryRecords(await readSourceLibrary(scope), records);
  await writeSourceLibrary(scope, nextState);
  return nextState;
}

export async function saveFailedWebSource({
  scope,
  schoolName,
  majorName,
  url,
  error,
  now = new Date(),
}: {
  scope: string | number;
  schoolName: string;
  majorName: string;
  url: string;
  error: string;
  now?: Date;
}) {
  const timestamp = now.toISOString();
  let requestedUrl = url;
  try {
    requestedUrl = new URL(url).toString();
  } catch {
    // Keep the submitted value so the failed attempt remains visible.
  }
  const record: SourceLibraryRecord = {
    id: recordId(schoolName, majorName, requestedUrl),
    schoolName,
    majorName,
    title: url,
    url,
    requestedUrl,
    excerpt: "",
    kind: "web",
    origin: "provided_url",
    crawlStatus: "failed",
    createdAt: timestamp,
    updatedAt: timestamp,
    lastFetchedAt: null,
    refreshAfter: null,
    lastError: error.slice(0, 300),
  };
  const nextState = mergeSourceLibraryRecords(await readSourceLibrary(scope), [record]);
  await writeSourceLibrary(scope, nextState);
  return nextState;
}

export async function removeSourceFromLibrary(scope: string | number, sourceId: string) {
  const state = await readSourceLibrary(scope);
  const sources = state.sources.filter(source => source.id !== sourceId);
  if (sources.length === state.sources.length) return null;
  const nextState = { updatedAt: new Date().toISOString(), sources };
  await writeSourceLibrary(scope, nextState);
  return nextState;
}
