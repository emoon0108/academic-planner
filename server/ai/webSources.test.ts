import { describe, expect, it, vi } from "vitest";
import { isPrivateNetworkAddress, scrapeWebSource } from "./webSources";

const resolvePublic = async () => ["93.184.216.34"];

describe("web source scraping", () => {
  it("recognizes private and public network addresses", () => {
    expect(isPrivateNetworkAddress("127.0.0.1")).toBe(true);
    expect(isPrivateNetworkAddress("10.4.2.1")).toBe(true);
    expect(isPrivateNetworkAddress("192.168.1.5")).toBe(true);
    expect(isPrivateNetworkAddress("::1")).toBe(true);
    expect(isPrivateNetworkAddress("8.8.8.8")).toBe(false);
    expect(isPrivateNetworkAddress("2606:4700:4700::1111")).toBe(false);
  });

  it("blocks local targets before fetching", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(scrapeWebSource("http://localhost/catalog", { fetchImpl })).rejects.toThrow("Private or local");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("follows validated redirects and extracts HTML", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, {
        status: 302,
        headers: { location: "https://catalog.example.edu/programs/cs" },
      }))
      .mockResolvedValueOnce(new Response(
        "<html><head><title>Computer Science Requirements</title></head><body><h1>Major</h1><p>EECS 280 Data Structures (4 credits)</p></body></html>",
        { status: 200, headers: { "content-type": "text/html" } },
      ));

    const source = await scrapeWebSource("https://example.edu/cs", {
      fetchImpl,
      resolveHost: resolvePublic,
      now: () => new Date("2026-10-06T12:00:00.000Z"),
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(source.title).toBe("Computer Science Requirements");
    expect(source.url).toBe("https://catalog.example.edu/programs/cs");
    expect(source.requestedUrl).toBe("https://example.edu/cs");
    expect(source.excerpt).toContain("EECS 280 Data Structures");
    expect(source.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(source.retrievedAt).toBe("2026-10-06T12:00:00.000Z");
  });

  it("rejects declared responses above the source limit", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response("small", {
      status: 200,
      headers: {
        "content-type": "text/plain",
        "content-length": String(9 * 1024 * 1024),
      },
    }));
    await expect(scrapeWebSource("https://example.edu/catalog.txt", {
      fetchImpl,
      resolveHost: resolvePublic,
    })).rejects.toThrow("8 MB");
  });
});
