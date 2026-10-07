import { describe, expect, it } from "vitest";
import {
  mergeSourceLibraryRecords,
  sourceFreshness,
  sourceLibraryIdentity,
  type SourceLibraryRecord,
} from "./sourceLibrary";

function source(overrides: Partial<SourceLibraryRecord> = {}): SourceLibraryRecord {
  return {
    id: "source-1",
    schoolName: "University of Michigan",
    majorName: "Computer Science",
    title: "Catalog",
    url: "https://example.edu/catalog",
    excerpt: "EECS 280 Data Structures",
    kind: "web",
    origin: "provided_url",
    crawlStatus: "ready",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    lastFetchedAt: "2026-10-01T00:00:00.000Z",
    refreshAfter: "2026-10-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("source library", () => {
  it("updates matching sources without losing the original creation time", () => {
    const updated = source({
      title: "Updated catalog",
      createdAt: "2026-10-06T00:00:00.000Z",
      updatedAt: "2026-10-06T00:00:00.000Z",
    });
    const state = mergeSourceLibraryRecords({
      updatedAt: "2026-10-01T00:00:00.000Z",
      sources: [source()],
    }, [updated]);

    expect(state.sources).toHaveLength(1);
    expect(state.sources[0].title).toBe("Updated catalog");
    expect(state.sources[0].createdAt).toBe("2026-10-01T00:00:00.000Z");
  });

  it("reports fresh, stale, and failed source states", () => {
    expect(sourceFreshness(source(), new Date("2026-10-07T00:00:00.000Z"))).toBe("fresh");
    expect(sourceFreshness(source(), new Date("2026-10-09T00:00:00.000Z"))).toBe("stale");
    expect(sourceFreshness(source({ crawlStatus: "failed" }))).toBe("unavailable");
  });

  it("keeps the submitted URL as the stable identity after a redirect", () => {
    expect(sourceLibraryIdentity(source({
      requestedUrl: "https://example.edu/catalog",
      url: "https://catalog.example.edu/current",
    }))).toBe("https://example.edu/catalog");
  });
});
