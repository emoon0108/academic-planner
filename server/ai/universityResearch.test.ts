import { describe, expect, it } from "vitest";
import {
  buildResearchQueries,
  extractUrls,
  formatResearchContext,
} from "./universityResearch";

describe("university research retrieval helpers", () => {
  it("extracts and normalizes direct source URLs", () => {
    expect(
      extractUrls("Check https://catalog.example.edu/cs, and https://registrar.example.edu.")
    ).toEqual(["https://catalog.example.edu/cs", "https://registrar.example.edu"]);
  });

  it("builds targeted university research queries", () => {
    const queries = buildResearchQueries({
      message: "Can CS 201 double count for gen ed?",
      schoolName: "Example University",
      majorName: "Computer Science",
    });

    expect(queries[0]).toContain("Example University Computer Science");
    expect(queries[0]).toContain("official academic catalog registrar");
    expect(queries.some(query => query.includes("site:.edu"))).toBe(true);
  });

  it("formats retrieved sources as citeable context", () => {
    const context = formatResearchContext({
      status: "sources_found",
      notes: ["Verify final decisions with an advisor."],
      sources: [
        {
          title: "Example Catalog",
          url: "https://catalog.example.edu/cs",
          excerpt: "Computer Science degree requirements and prerequisite rules.",
        },
      ],
    });

    expect(context).toContain("[1] Example Catalog");
    expect(context).toContain("https://catalog.example.edu/cs");
    expect(context).toContain("Verify final decisions with an advisor.");
  });
});
