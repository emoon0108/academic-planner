import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { invokeLLM } from "../_core/llm";
import { retrieveUniversityResearch, type UniversityResearchSource } from "./universityResearch";

export type ExtractedRequirementCategory = {
  name: string;
  type: "core" | "elective" | "general_education" | "capstone" | "thesis" | "free_elective";
  creditsRequired: number | null;
  coursesRequired: number | null;
  rules: string[];
  sourceUrl: string;
  courses: Array<{
    code: string;
    name: string;
    credits: number | null;
    required: boolean;
  }>;
};

export type CatalogResearchUpdate = {
  id: string;
  schoolName: string;
  majorName: string;
  status: "sources_found" | "needs_review" | "no_sources_found";
  confidence: "low" | "medium" | "high";
  sources: UniversityResearchSource[];
  extractedCourses: Array<{
    code: string;
    name: string;
    credits: number | null;
    sourceUrl: string;
  }>;
  structuredRequirements?: ExtractedRequirementCategory[];
  requirementHints: string[];
  notes: string[];
  importedAt?: string;
  importedSchoolId?: number;
  importedProgramId?: number;
  importedCourseIds?: number[];
  createdAt: string;
};

export type CatalogResearchState = {
  updatedAt: string | null;
  updates: CatalogResearchUpdate[];
};

export const DEFAULT_RESEARCH_TARGETS = [
  { schoolName: "University of Michigan", majorName: "Computer Science" },
  { schoolName: "Michigan State University", majorName: "Computer Science" },
  { schoolName: "University of California Berkeley", majorName: "Computer Science" },
  { schoolName: "University of Illinois Urbana-Champaign", majorName: "Computer Science" },
  { schoolName: "Georgia Institute of Technology", majorName: "Computer Science" },
  { schoolName: "Purdue University", majorName: "Computer Science" },
  { schoolName: "University of Washington", majorName: "Computer Science" },
  { schoolName: "Carnegie Mellon University", majorName: "Computer Science" },
];

export type CatalogResearchTarget = {
  schoolName: string;
  majorName: string;
  sourceUrls?: string[];
};

const STATE_PATH = resolve(process.cwd(), "server/data/catalog-research-updates.json");
const COURSE_PATTERN = /\b([A-Z]{2,8})\s*[- ]?(\d{3,4}[A-Z]?)\b[:\s-]*([^.;()]{3,100})?(?:\((\d+(?:\.\d+)?)\s*(?:credits?|cr)\))?/gi;
const REQUIREMENT_PATTERN = /\b(?:requirements?|credits?|prerequisites?|core|electives?|degree|major)\b[^.]{20,220}\./gi;
const REQUIREMENT_TYPES = new Set<ExtractedRequirementCategory["type"]>([
  "core",
  "elective",
  "general_education",
  "capstone",
  "thesis",
  "free_elective",
]);

function makeUpdateId(schoolName: string, majorName: string) {
  return `${schoolName}-${majorName}-${Date.now()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function readCatalogResearchState(): Promise<CatalogResearchState> {
  try {
    const raw = await readFile(STATE_PATH, "utf8");
    return JSON.parse(raw) as CatalogResearchState;
  } catch {
    return { updatedAt: null, updates: [] };
  }
}

export async function writeCatalogResearchState(state: CatalogResearchState) {
  await mkdir(dirname(STATE_PATH), { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function extractCoursesFromSources(sources: UniversityResearchSource[]) {
  const seen = new Set<string>();
  const courses: CatalogResearchUpdate["extractedCourses"] = [];

  for (const source of sources) {
    const matches = Array.from(source.excerpt.matchAll(COURSE_PATTERN));
    for (const match of matches) {
      const code = `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
      if (seen.has(code)) continue;
      seen.add(code);
      courses.push({
        code,
        name: (match[3] ?? "Catalog course").trim(),
        credits: match[4] ? Number(match[4]) : null,
        sourceUrl: source.url,
      });
      if (courses.length >= 24) return courses;
    }
  }

  return courses;
}

function extractRequirementHints(sources: UniversityResearchSource[]) {
  const hints = new Set<string>();
  for (const source of sources) {
    const matches = Array.from(source.excerpt.matchAll(REQUIREMENT_PATTERN));
    for (const match of matches) {
      hints.add(match[0].replace(/\s+/g, " ").trim());
      if (hints.size >= 12) return Array.from(hints);
    }
  }
  return Array.from(hints);
}

function normalizeRequirementType(value: unknown): ExtractedRequirementCategory["type"] {
  return typeof value === "string" && REQUIREMENT_TYPES.has(value as ExtractedRequirementCategory["type"])
    ? value as ExtractedRequirementCategory["type"]
    : "core";
}

function normalizePositiveInt(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
}

function normalizeStructuredRequirements(payload: unknown, sources: UniversityResearchSource[]): ExtractedRequirementCategory[] {
  if (!payload || typeof payload !== "object") return [];
  const categories = Array.isArray((payload as any).categories) ? (payload as any).categories : [];
  const sourceUrls = new Set(sources.map(source => source.url));
  const normalized: ExtractedRequirementCategory[] = [];

  for (const category of categories) {
    if (!category || typeof category !== "object") continue;
    const rawCourses = Array.isArray((category as any).courses) ? (category as any).courses : [];
    const courses = rawCourses
      .map((course: any) => ({
        code: typeof course?.code === "string" ? course.code.toUpperCase().replace(/\s+/, " ").trim().slice(0, 32) : "",
        name: typeof course?.name === "string" && course.name.trim() ? course.name.trim().slice(0, 256) : "Catalog course",
        credits: normalizePositiveInt(course?.credits),
        required: typeof course?.required === "boolean" ? course.required : true,
      }))
      .filter((course: { code: string }) => /^[A-Z]{2,8}\s*\d{3,4}[A-Z]?$/.test(course.code))
      .slice(0, 30);

    const sourceUrl = typeof (category as any).sourceUrl === "string" && sourceUrls.has((category as any).sourceUrl)
      ? (category as any).sourceUrl
      : sources[0]?.url ?? "";

    const name = typeof (category as any).name === "string" && (category as any).name.trim()
      ? (category as any).name.trim().slice(0, 128)
      : "Researched Requirements";

    const rules = Array.isArray((category as any).rules)
      ? (category as any).rules
          .filter((rule: unknown) => typeof rule === "string" && rule.trim())
          .map((rule: string) => rule.replace(/\s+/g, " ").trim().slice(0, 300))
          .slice(0, 8)
      : [];

    if (courses.length === 0 && rules.length === 0) continue;

    normalized.push({
      name,
      type: normalizeRequirementType((category as any).type),
      creditsRequired: normalizePositiveInt((category as any).creditsRequired),
      coursesRequired: normalizePositiveInt((category as any).coursesRequired),
      rules,
      sourceUrl,
      courses,
    });

    if (normalized.length >= 8) break;
  }

  return normalized;
}

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function extractStructuredRequirements({
  schoolName,
  majorName,
  sources,
}: {
  schoolName: string;
  majorName: string;
  sources: UniversityResearchSource[];
}) {
  if (sources.length === 0) return { categories: [] as ExtractedRequirementCategory[], notes: [] as string[] };

  const sourceText = sources
    .map((source, index) => `[${index + 1}] ${source.title}\nURL: ${source.url}\n${source.excerpt}`)
    .join("\n\n")
    .slice(0, 12000);

  try {
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content:
            "Extract undergraduate degree requirements from official university catalog excerpts. Use only the provided excerpts. Do not invent courses, credits, rules, or source URLs. If evidence is ambiguous, preserve the rule text and keep confidence implicit by returning fewer categories.",
        },
        {
          role: "user",
          content: `School: ${schoolName}\nProgram/major: ${majorName}\n\nReturn JSON with a categories array. Each category must include name, type, creditsRequired, coursesRequired, rules, sourceUrl, and courses. Course objects must include code, name, credits, and required.\n\nOfficial excerpts:\n${sourceText}`,
        },
      ],
      responseFormat: {
        type: "json_schema",
        json_schema: {
          name: "degree_requirement_extraction",
          strict: false,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              categories: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: { type: "string" },
                    type: { type: "string", enum: Array.from(REQUIREMENT_TYPES) },
                    creditsRequired: { type: ["integer", "null"] },
                    coursesRequired: { type: ["integer", "null"] },
                    rules: { type: "array", items: { type: "string" } },
                    sourceUrl: { type: "string" },
                    courses: {
                      type: "array",
                      items: {
                        type: "object",
                        additionalProperties: false,
                        properties: {
                          code: { type: "string" },
                          name: { type: "string" },
                          credits: { type: ["integer", "null"] },
                          required: { type: "boolean" },
                        },
                        required: ["code", "name", "credits", "required"],
                      },
                    },
                  },
                  required: ["name", "type", "creditsRequired", "coursesRequired", "rules", "sourceUrl", "courses"],
                },
              },
            },
            required: ["categories"],
          },
        },
      },
      maxTokens: 2500,
    });

    const content = response.choices[0]?.message.content;
    const raw = typeof content === "string" ? content : JSON.stringify(content);
    return {
      categories: normalizeStructuredRequirements(safeJsonParse(raw), sources),
      notes: ["AI extracted structured requirement categories from official source excerpts."],
    };
  } catch (error) {
    return {
      categories: [] as ExtractedRequirementCategory[],
      notes: [
        `Structured AI extraction was unavailable, so this update used source retrieval and regex hints only: ${error instanceof Error ? error.message : "unknown error"}`,
      ],
    };
  }
}

export async function runCatalogResearchCycle(targets: CatalogResearchTarget[] = DEFAULT_RESEARCH_TARGETS.slice(0, 3)) {
  const state = await readCatalogResearchState();
  const newUpdates: CatalogResearchUpdate[] = [];

  for (const target of targets) {
    const result = await retrieveUniversityResearch({
      schoolName: target.schoolName,
      majorName: target.majorName,
      message: [
        `${target.schoolName} ${target.majorName} undergraduate degree requirements official catalog prerequisites course requirements`,
        ...(target.sourceUrls ?? []),
      ].join("\n"),
    });
    const extractedCourses = extractCoursesFromSources(result.sources);
    const requirementHints = extractRequirementHints(result.sources);
    const structured = await extractStructuredRequirements({
      schoolName: target.schoolName,
      majorName: target.majorName,
      sources: result.sources,
    });
    const structuredCourses = structured.categories.flatMap(category =>
      category.courses.map(course => ({
        code: course.code,
        name: course.name,
        credits: course.credits,
        sourceUrl: category.sourceUrl,
      }))
    );
    const mergedCourses = [...structuredCourses, ...extractedCourses].filter((course, index, all) =>
      all.findIndex(item => item.code === course.code) === index
    );
    const confidence = result.sources.length >= 2 && (structured.categories.length > 0 || mergedCourses.length > 0 || requirementHints.length > 0)
      ? "high"
      : result.sources.length > 0
        ? "medium"
        : "low";

    newUpdates.push({
      id: makeUpdateId(target.schoolName, target.majorName),
      schoolName: target.schoolName,
      majorName: target.majorName,
      status: result.sources.length > 0 ? "sources_found" : "no_sources_found",
      confidence,
      sources: result.sources,
      extractedCourses: mergedCourses,
      structuredRequirements: structured.categories,
      requirementHints,
      notes: [
        ...result.notes,
        ...structured.notes,
        "Review this update before converting it into production degree requirements.",
      ],
      createdAt: new Date().toISOString(),
    });
  }

  const nextState = {
    updatedAt: new Date().toISOString(),
    updates: [...newUpdates, ...state.updates].slice(0, 100),
  };
  await writeCatalogResearchState(nextState);
  return nextState;
}
