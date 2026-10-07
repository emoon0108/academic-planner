import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { invokeLLM } from "../_core/llm";
import {
  retrieveUniversityResearch,
  type UniversityResearchResult,
  type UniversityResearchSource,
} from "./universityResearch";

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

const LEGACY_STATE_PATH = resolve(process.cwd(), "server/data/catalog-research-updates.json");
const CUSTOM_STATE_PATH = process.env.ACADEMIQ_RESEARCH_STATE_PATH
  ? resolve(process.env.ACADEMIQ_RESEARCH_STATE_PATH)
  : null;
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

function statePathFor(scope: string | number) {
  if (CUSTOM_STATE_PATH && scope === "global") return CUSTOM_STATE_PATH;
  const safeScope = String(scope).replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80) || "global";
  return resolve(process.cwd(), "data/runtime", `catalog-research-${safeScope}.json`);
}

export async function readCatalogResearchState(scope: string | number = "global"): Promise<CatalogResearchState> {
  try {
    const raw = await readFile(statePathFor(scope), "utf8");
    return JSON.parse(raw) as CatalogResearchState;
  } catch {
    if (scope !== "global") return { updatedAt: null, updates: [] };
    try {
      const legacy = await readFile(LEGACY_STATE_PATH, "utf8");
      return JSON.parse(legacy) as CatalogResearchState;
    } catch {
      return { updatedAt: null, updates: [] };
    }
  }
}

export async function writeCatalogResearchState(state: CatalogResearchState, scope: string | number = "global") {
  const statePath = statePathFor(scope);
  await mkdir(dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function parseCsvRows(text: string, maxRows = 5_000) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length && rows.length < maxRows; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (character === "," && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }
    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field.trim());
      field = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    field += character;
  }

  if ((field || row.length > 0) && rows.length < maxRows) {
    row.push(field.trim());
    if (row.some(Boolean)) rows.push(row);
  }
  return rows;
}

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function findColumn(headers: string[], aliases: string[]) {
  return headers.findIndex(header => aliases.includes(header));
}

function extractCoursesFromCsv(source: UniversityResearchSource): CatalogResearchUpdate["extractedCourses"] {
  const rows = parseCsvRows(source.excerpt);
  if (rows.length < 2) return [];

  const headers = rows[0].map(normalizedHeader);
  const subjectIndex = findColumn(headers, ["subject", "subjectcode", "subj"]);
  const catalogIndex = findColumn(headers, ["catalognbr", "catalognumber", "catalogno", "coursenumber", "coursenum"]);
  const titleIndex = findColumn(headers, ["coursetitle", "title", "longtitle", "description"]);
  const creditsIndex = findColumn(headers, ["credits", "credit", "units", "minimumunits", "minunits"]);
  if (subjectIndex < 0 || catalogIndex < 0) return [];

  const courses = new Map<string, CatalogResearchUpdate["extractedCourses"][number]>();
  for (const row of rows.slice(1)) {
    const subject = (row[subjectIndex] ?? "").toUpperCase().replace(/[^A-Z]/g, "");
    const catalog = (row[catalogIndex] ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
    if (!/^[A-Z]{2,8}$/.test(subject) || !/^\d{3,4}[A-Z]?$/.test(catalog)) continue;

    const code = `${subject} ${catalog}`;
    const parsedCredits = Number.parseFloat(row[creditsIndex] ?? "");
    const name = (row[titleIndex] ?? "Catalog course").replace(/\s+/g, " ").trim().slice(0, 256) || "Catalog course";
    if (!courses.has(code)) {
      courses.set(code, {
        code,
        name,
        credits: Number.isFinite(parsedCredits) && parsedCredits > 0 ? parsedCredits : null,
        sourceUrl: source.url,
      });
    }
    if (courses.size >= 40) break;
  }
  return Array.from(courses.values());
}

export function extractCoursesFromSources(sources: UniversityResearchSource[]) {
  const seen = new Set<string>();
  const courses: CatalogResearchUpdate["extractedCourses"] = [];

  for (const source of sources) {
    if (source.kind === "csv" || source.mimeType === "text/csv") {
      for (const course of extractCoursesFromCsv(source)) {
        if (seen.has(course.code)) continue;
        seen.add(course.code);
        courses.push(course);
        if (courses.length >= 40) return courses;
      }
    }

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
      if (courses.length >= 40) return courses;
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

async function buildCatalogResearchUpdate(
  target: Pick<CatalogResearchTarget, "schoolName" | "majorName">,
  result: UniversityResearchResult
): Promise<CatalogResearchUpdate> {
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
  const hasEvidence = structured.categories.length > 0 || mergedCourses.length > 0 || requirementHints.length > 0;
  const confidence = result.sources.length >= 2 && hasEvidence
    ? "high"
    : result.sources.length > 0
      ? "medium"
      : "low";

  return {
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
  };
}

async function prependResearchUpdates(newUpdates: CatalogResearchUpdate[], scope: string | number) {
  const state = await readCatalogResearchState(scope);

  const nextState = {
    updatedAt: new Date().toISOString(),
    updates: [...newUpdates, ...state.updates].slice(0, 100),
  };
  await writeCatalogResearchState(nextState, scope);
  return nextState;
}

export async function runCatalogResearchCycle(
  targets: CatalogResearchTarget[] = DEFAULT_RESEARCH_TARGETS.slice(0, 3),
  scope: string | number = "global"
) {
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
    newUpdates.push(await buildCatalogResearchUpdate(target, result));
  }

  return prependResearchUpdates(newUpdates, scope);
}

export async function runCatalogResearchImport({
  schoolName,
  majorName,
  sources,
  scope = "global",
}: {
  schoolName: string;
  majorName: string;
  sources: UniversityResearchSource[];
  scope?: string | number;
}) {
  const update = await buildCatalogResearchUpdate(
    { schoolName, majorName },
    {
      status: sources.length > 0 ? "sources_found" : "no_sources_found",
      sources,
      notes: [
        `${sources.length} uploaded source${sources.length === 1 ? " was" : "s were"} parsed locally.`,
        "When structured AI extraction is configured, source excerpts are sent to that model provider for schema extraction.",
        "Uploaded sources are evidence candidates, not trusted catalog records, until reviewed and approved.",
      ],
    }
  );

  return prependResearchUpdates([update], scope);
}
