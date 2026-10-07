import { describe, expect, it } from "vitest";
import { createImportedSource, MAX_IMPORTED_SOURCE_BYTES } from "./sourceDocuments";

function encode(text: string) {
  return Buffer.from(text, "utf8").toString("base64");
}

describe("imported source documents", () => {
  it("normalizes a text source and records provenance", async () => {
    const source = await createImportedSource({
      name: "  CS Requirements.txt  ",
      mimeType: "text/plain",
      dataBase64: encode("Computer Science requirements:\n\n\nEECS 281 (4 credits) is required."),
    });

    expect(source.title).toBe("CS Requirements.txt");
    expect(source.origin).toBe("upload");
    expect(source.kind).toBe("text");
    expect(source.url).toMatch(/^urn:academiq:source:/);
    expect(source.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(source.excerpt).toContain("EECS 281");
  });

  it("removes scripts and markup from imported HTML", async () => {
    const source = await createImportedSource({
      name: "catalog.html",
      mimeType: "text/html; charset=utf-8",
      dataBase64: encode("<h1>Requirements</h1><script>steal()</script><p>EECS 280 (4 credits)</p>"),
    });

    expect(source.kind).toBe("html");
    expect(source.excerpt).toContain("Requirements");
    expect(source.excerpt).toContain("EECS 280");
    expect(source.excerpt).not.toContain("steal");
  });

  it("infers CSV from the filename when the browser omits the MIME type", async () => {
    const source = await createImportedSource({
      name: "schedule.csv",
      mimeType: "application/octet-stream",
      dataBase64: encode("Subject,Catalog Nbr,Credits\nEECS,445,4"),
    });

    expect(source.kind).toBe("csv");
    expect(source.mimeType).toBe("text/csv");
  });

  it("rejects unsupported and oversized inputs", async () => {
    await expect(createImportedSource({
      name: "archive.zip",
      mimeType: "application/zip",
      dataBase64: encode("not really a zip but still unsupported"),
    })).rejects.toThrow("Unsupported source type");

    await expect(createImportedSource({
      name: "large.txt",
      mimeType: "text/plain",
      dataBase64: Buffer.alloc(MAX_IMPORTED_SOURCE_BYTES + 1, "a").toString("base64"),
    })).rejects.toThrow("8 MB or smaller");
  });
});

