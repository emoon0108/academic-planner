import { describe, expect, it } from "vitest";
import { extractCoursesFromSources } from "./catalogResearchAgent";

describe("catalog source extraction", () => {
  it("extracts unique courses from Registrar-style CSV columns", () => {
    const courses = extractCoursesFromSources([
      {
        title: "Fall schedule.csv",
        url: "urn:academiq:source:schedule",
        kind: "csv",
        mimeType: "text/csv",
        excerpt: [
          "Subject,Catalog Nbr,Class Section,Course Title,Units",
          'EECS,280,001,"Programming and Introductory Data Structures",4',
          'EECS,280,002,"Programming and Introductory Data Structures",4',
          'EECS,445,001,"Introduction to Machine Learning",4',
        ].join("\n"),
      },
    ]);

    expect(courses).toEqual([
      {
        code: "EECS 280",
        name: "Programming and Introductory Data Structures",
        credits: 4,
        sourceUrl: "urn:academiq:source:schedule",
      },
      {
        code: "EECS 445",
        name: "Introduction to Machine Learning",
        credits: 4,
        sourceUrl: "urn:academiq:source:schedule",
      },
    ]);
  });

  it("keeps prose extraction as a fallback", () => {
    const courses = extractCoursesFromSources([
      {
        title: "Requirements",
        url: "https://catalog.example.edu/cs",
        kind: "web",
        excerpt: "The core includes EECS 281 Data Structures and Algorithms (4 credits).",
      },
    ]);

    expect(courses[0]).toMatchObject({ code: "EECS 281", credits: 4 });
  });

  it("does not treat navigation labels and concatenated years as courses", () => {
    const courses = extractCoursesFromSources([
      {
        title: "Program page",
        url: "https://catalog.example.edu/cs",
        kind: "web",
        excerpt: "FACULTY 100award-winning faculty. FALL 2026Winter guide. BUILDING 2260Hayward Street. CS 2010 Principal Product Manager, Apple TV Read more: alumni profile. EECS 445: Machine Learning (4 credits).",
      },
    ]);

    expect(courses).toEqual([
      {
        code: "EECS 445",
        name: "Machine Learning",
        credits: 4,
        sourceUrl: "https://catalog.example.edu/cs",
      },
    ]);
  });
});
