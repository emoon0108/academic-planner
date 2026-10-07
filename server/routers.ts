import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { notifyOwner } from "./_core/notification";
import {
  ACADEMIC_AGENT_MODES,
  buildAcademicAgentFallbackResponse,
  buildAcademicAgentSystemMessage,
  getAgentLabel,
  resolveAcademicAgent,
} from "./ai/academicAgents";
import {
  formatResearchContext,
  retrieveUniversityResearch,
} from "./ai/universityResearch";
import {
  DEFAULT_RESEARCH_TARGETS,
  readCatalogResearchState,
  runCatalogResearchCycle,
  runCatalogResearchImport,
  writeCatalogResearchState,
} from "./ai/catalogResearchAgent";
import { createImportedSource, MAX_IMPORTED_SOURCE_BYTES } from "./ai/sourceDocuments";
import {
  readSourceLibrary,
  removeSourceFromLibrary,
  saveFailedWebSource,
  saveSourcesToLibrary,
  sourceFreshness,
} from "./ai/sourceLibrary";
import { scrapeWebSource } from "./ai/webSources";
import * as db from "./db";
import { buildCourseGraph, getGraphVisualizationData, prerequisitesSatisfied, CourseNode, PrerequisiteEdge } from "./engine/graph";
import { generateAllVariants, generatePlan, isPlaceholderCourseId, ScheduleConstraints, GeneratedPlan } from "./engine/optimizer";
import { replan, simulateScenario } from "./engine/replanner";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseJson<T>(json: string | null | undefined, fallback: T): T {
  try { return json ? JSON.parse(json) : fallback; } catch { return fallback; }
}

async function buildGraphForSchool(schoolId: number) {
  const [rawCourses, rawPrereqs] = await Promise.all([
    db.getCoursesBySchool(schoolId),
    db.getPrerequisitesBySchool(schoolId),
  ]);

  const nodes: CourseNode[] = rawCourses.map(c => ({
    id: c.id,
    code: c.code,
    name: c.name,
    credits: c.credits,
    difficultyLevel: c.difficultyLevel,
    workloadHours: c.workloadHours,
    availableFall: c.availableFall,
    availableSpring: c.availableSpring,
    availableSummer: c.availableSummer,
    isUpperDivision: c.isUpperDivision,
    tags: parseJson<string[]>(c.tagsJson, []),
    careerTracks: parseJson<string[]>(c.careerTracksJson, []),
  }));

  const edges: PrerequisiteEdge[] = rawPrereqs.map(p => ({
    courseId: p.courseId,
    prerequisiteCourseId: p.prerequisiteCourseId,
    type: p.type as 'required' | 'corequisite' | 'recommended',
  }));

  return buildCourseGraph(nodes, edges);
}

async function getRequiredCourseIds(primaryMajorId: number, secondaryMajorId?: number | null, minorIds: number[] = []): Promise<number[]> {
  const programIds = [primaryMajorId, ...(secondaryMajorId ? [secondaryMajorId] : []), ...minorIds];
  const allReqs: number[] = [];

  for (const pid of programIds) {
    const cats = await db.getRequirementCategoriesByProgram(pid);
    for (const cat of cats) {
      const reqs = await db.getDegreeRequirementsByCategory(cat.id);
      for (const req of reqs) {
        if (req.isRequired) allReqs.push(req.courseId);
        else allReqs.push(req.courseId); // include electives too for planning
      }
    }
  }

  return Array.from(new Set(allReqs));
}

async function getTargetCredits(primaryMajorId: number, secondaryMajorId?: number | null, minorIds: number[] = []): Promise<number> {
  const [primaryMajor, secondaryMajor, ...minorPrograms] = await Promise.all([
    db.getProgramById(primaryMajorId),
    secondaryMajorId ? db.getProgramById(secondaryMajorId) : Promise.resolve(null),
    ...minorIds.map(id => db.getProgramById(id)),
  ]);

  const primaryCredits = primaryMajor?.type === "major"
    ? Math.max(primaryMajor.totalCreditsRequired, 120)
    : primaryMajor?.totalCreditsRequired ?? 120;
  const secondaryCredits = secondaryMajor?.type === "major"
    ? Math.max(secondaryMajor.totalCreditsRequired, 120)
    : secondaryMajor?.totalCreditsRequired ?? 0;
  const majorCredits = Math.max(primaryCredits, secondaryCredits);
  const minorCredits = minorPrograms.reduce((sum, program) => sum + (program?.totalCreditsRequired ?? 0), 0);

  return majorCredits + minorCredits;
}

function getTermRank(term: "fall" | "spring" | "summer") {
  return term === "spring" ? 0 : term === "summer" ? 1 : 2;
}

function compareSemesters(a: { year: number; term: "fall" | "spring" | "summer"; semesterIndex?: number }, b: { year: number; term: "fall" | "spring" | "summer"; semesterIndex?: number }) {
  if ((a.semesterIndex ?? -1) !== (b.semesterIndex ?? -1)) {
    return (a.semesterIndex ?? 0) - (b.semesterIndex ?? 0);
  }
  if (a.year !== b.year) return a.year - b.year;
  return getTermRank(a.term) - getTermRank(b.term);
}

function normalizeExamName(examName: string) {
  return examName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isCourseAvailableInTerm(course: { availableFall: boolean; availableSpring: boolean; availableSummer: boolean }, term: "fall" | "spring" | "summer") {
  if (term === "fall") return course.availableFall;
  if (term === "spring") return course.availableSpring;
  return course.availableSummer;
}

function findCourseIdsByCodes(graph: ReturnType<typeof buildCourseGraph>, codes: string[]) {
  const wanted = new Set(codes.map(code => code.toUpperCase()));
  return Array.from(graph.nodes.values())
    .filter(course => wanted.has(course.code.toUpperCase()))
    .map(course => course.id);
}

function getApEquivalentCourseIds(
  graph: ReturnType<typeof buildCourseGraph>,
  profile: NonNullable<Awaited<ReturnType<typeof db.getStudentProfileByUserId>>>
) {
  const apCredits = parseJson<Array<{ courseId?: number; score?: number; examName?: string }>>(profile.apCreditsJson, []);
  const completed = new Set<number>();

  for (const credit of apCredits) {
    const score = credit.score ?? 0;
    if (score < 3) continue;
    if (credit.courseId && credit.courseId > 0) {
      completed.add(credit.courseId);
      continue;
    }

    const exam = normalizeExamName(credit.examName ?? "");
    let codes: string[] = [];

    if (exam === "calculus ab") codes = ["MATH 115"];
    if (exam === "calculus bc") codes = score >= 4 ? ["MATH 115", "MATH 116"] : ["MATH 115"];
    if (exam === "statistics") codes = ["STATS 250"];
    if (exam === "computer science a") codes = score >= 4 ? ["ENGR 101"] : [];
    if (exam === "physics c mechanics") codes = ["PHYSICS 140", "PHYSICS 141"];
    if (exam === "physics c e m") codes = ["PHYSICS 240", "PHYSICS 241"];
    if (exam === "chemistry") codes = ["CHEM 130", "CHEM 125"];

    for (const id of findCourseIdsByCodes(graph, codes)) completed.add(id);
  }

  return Array.from(completed);
}

function getUnmappedPriorCreditTotal(profile: NonNullable<Awaited<ReturnType<typeof db.getStudentProfileByUserId>>>) {
  const apCredits = parseJson<Array<{ courseId?: number; score?: number; credits?: number; examName?: string }>>(profile.apCreditsJson, []);
  const transferCredits = parseJson<Array<{ courseId?: number; credits?: number }>>(profile.transferCreditsJson, []);

  const apCreditTotal = apCredits.reduce((sum, credit) => {
    if ((credit.score ?? 0) < 3) return sum;
    if (credit.courseId && credit.courseId > 0) return sum;
    if (credit.examName) {
      const mappedExam = new Set([
        "calculus ab",
        "calculus bc",
        "statistics",
        "computer science a",
        "physics c mechanics",
        "physics c e m",
        "chemistry",
      ]);
      if (mappedExam.has(normalizeExamName(credit.examName))) return sum;
    }
    return sum + (credit.credits ?? 3);
  }, 0);
  const transferCreditTotal = transferCredits.reduce((sum, credit) => {
    if (credit.courseId && credit.courseId > 0) return sum;
    return sum + (credit.credits ?? 0);
  }, 0);

  return apCreditTotal + transferCreditTotal;
}

function getCareerTrackCourseIds(
  graph: ReturnType<typeof buildCourseGraph>,
  track: Awaited<ReturnType<typeof db.getCareerTrackById>> | undefined,
  requiredCourseIds: number[]
) {
  if (!track) return [];

  const slug = track.slug;
  const required = new Set(requiredCourseIds);
  const matches = Array.from(graph.nodes.values()).filter(course => {
    if (!required.has(course.id)) return false;
    if (course.careerTracks.includes(slug)) return true;

    const haystack = `${course.code} ${course.name} ${course.tags.join(" ")}`.toLowerCase();
    if (slug.includes("software") || slug.includes("full_stack") || slug.includes("frontend") || slug.includes("backend")) {
      return /(eecs|programming|data structures|web|systems|software|computer)/.test(haystack);
    }
    if (slug.includes("machine_learning") || slug.includes("artificial_intelligence") || slug.includes("data_science")) {
      return /(machine learning|statistics|linear algebra|data|eecs 445|stats|math 214)/.test(haystack);
    }
    if (slug.includes("cybersecurity")) {
      return /(systems|operating|computer organization|eecs 370|eecs 482)/.test(haystack);
    }
    if (slug.includes("engineering") || slug.includes("patent")) {
      return /(engineering|physics|math|design|capstone|technical)/.test(haystack);
    }
    if (slug.includes("finance") || slug.includes("consulting") || slug.includes("law") || slug.includes("policy")) {
      return /(economics|business|statistics|writing|communication|policy)/.test(haystack);
    }
    if (slug.includes("pre_med") || slug.includes("nursing") || slug.includes("public_health") || slug.includes("psychology")) {
      return /(biology|chem|health|psych|statistics)/.test(haystack);
    }
    return false;
  });

  return matches.map(course => course.id);
}

async function savePlanToDb(plan: GeneratedPlan, userId: number, name: string): Promise<number> {
  const planId = await db.createDegreePlan({
    userId,
    name,
    variantType: plan.variantType,
    totalCredits: plan.totalCredits,
    totalSemesters: plan.totalSemesters,
    estimatedGraduationYear: plan.estimatedGraduationYear,
    estimatedGraduationSemester: plan.estimatedGraduationSemester,
    scoresJson: JSON.stringify(plan.scores),
  });

  for (const sem of plan.semesters) {
    const semId = await db.createPlanSemester({
      planId,
      semesterIndex: sem.semesterIndex,
      year: sem.year,
      term: sem.term,
      totalCredits: sem.totalCredits,
      workloadScore: sem.workloadScore,
      difficultyScore: sem.difficultyScore,
    });

    for (const courseId of sem.courseIds) {
      const course = planCourseLookup(plan, courseId);
      await db.createPlanCourse({
        semesterId: semId,
        courseId,
        status: 'planned',
        notes: isPlaceholderCourseId(courseId) && course
          ? JSON.stringify({
              code: course.code,
              name: course.name,
              credits: course.credits,
              difficultyLevel: course.difficultyLevel,
              workloadHours: course.workloadHours,
              tags: course.tags,
              careerTracks: course.careerTracks,
            })
          : undefined,
      });
    }
  }

  return planId;
}

function planCourseLookup(plan: GeneratedPlan, courseId: number) {
  return (plan as GeneratedPlan & { courseLookup?: Map<number, CourseNode> }).courseLookup?.get(courseId);
}

function parsePlaceholderCourse(planCourse: { courseId: number; notes?: string | null }) {
  if (!isPlaceholderCourseId(planCourse.courseId)) return null;

  const parsed = parseJson<{
    code?: string;
    name?: string;
    credits?: number;
    difficultyLevel?: number;
    workloadHours?: number;
    tags?: string[];
    careerTracks?: string[];
  }>(planCourse.notes, {});

  return {
    id: planCourse.courseId,
    schoolId: 0,
    code: parsed.code ?? "ELECTIVE",
    name: parsed.name ?? "General Education / Free Elective",
    description: "Planner filler credit used to reach the configured credit target. Replace with an advisor-approved U-M distribution, intellectual breadth, or free elective course.",
    credits: parsed.credits ?? 0,
    difficultyLevel: parsed.difficultyLevel ?? 2,
    workloadHours: parsed.workloadHours ?? 0,
    availableFall: true,
    availableSpring: true,
    availableSummer: true,
    isUpperDivision: false,
    tagsJson: JSON.stringify(parsed.tags ?? ["general-education", "free-elective"]),
    careerTracksJson: JSON.stringify(parsed.careerTracks ?? []),
    createdAt: new Date(),
    tags: parsed.tags ?? ["general-education", "free-elective"],
    careerTracks: parsed.careerTracks ?? [],
  };
}

type PlanCoursePayload = {
  planCourseId: number;
  courseId: number;
  status: string;
  grade?: string | null;
  course: {
    id: number;
    code: string;
    name: string;
    credits: number;
    difficultyLevel: number;
    workloadHours: number;
    tags?: string[];
    careerTracks?: string[];
  } | null;
};

type SemesterPayload = {
  id: number;
  semesterIndex: number;
  year: number;
  term: "fall" | "spring" | "summer";
  totalCredits: number;
  workloadScore: number;
  difficultyScore: number;
  courses: PlanCoursePayload[];
};

async function getProgramRequirementTracking(programId: number, plannedCourseIds: Set<number>) {
  const program = await db.getProgramById(programId);
  const categories = await db.getRequirementCategoriesByProgram(programId);
  const tracking = [];

  for (const category of categories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
    const requirements = await db.getDegreeRequirementsByCategory(category.id);
    const items = requirements.map(req => {
      const alternatives = parseJson<number[]>(req.alternativeCourseIdsJson, []);
      const candidateIds = [req.courseId, ...alternatives];
      return {
        id: req.id,
        courseId: req.courseId,
        alternativeCourseIds: alternatives,
        isRequired: req.isRequired,
        satisfied: candidateIds.some(id => plannedCourseIds.has(id)),
        notes: req.notes,
      };
    });
    const satisfiedItems = items.filter(item => item.satisfied);
    const satisfiedCredits = satisfiedItems.length * 3;
    tracking.push({
      programId,
      programName: program?.name ?? "Program",
      categoryId: category.id,
      categoryName: category.name,
      type: category.type,
      creditsRequired: category.creditsRequired,
      coursesRequired: category.coursesRequired,
      satisfiedCount: satisfiedItems.length,
      totalCount: items.length,
      satisfiedCredits,
      complete: items.every(item => item.satisfied) || satisfiedCredits >= category.creditsRequired,
      requirements: items,
    });
  }

  return tracking;
}

async function analyzePlanForProfile(
  profile: NonNullable<Awaited<ReturnType<typeof db.getStudentProfileByUserId>>>,
  semesters: SemesterPayload[]
) {
  const minorIds = parseJson<number[]>(profile.minorIdsJson, []);
  const programIds = [
    profile.primaryMajorId,
    profile.secondaryMajorId,
    ...minorIds,
  ].filter((id): id is number => Boolean(id));
  const targetCredits = profile.primaryMajorId
    ? await getTargetCredits(profile.primaryMajorId, profile.secondaryMajorId, minorIds)
    : 120;
  const plannedCourseIds = new Set(
    semesters.flatMap(sem => sem.courses.map(pc => pc.courseId).filter(id => !isPlaceholderCourseId(id)))
  );
  const graph = profile.schoolId ? await buildGraphForSchool(profile.schoolId) : null;
  const requiredCourseIds = profile.primaryMajorId
    ? new Set(await getRequiredCourseIds(profile.primaryMajorId, profile.secondaryMajorId, minorIds))
    : new Set<number>();
  const requirementTracking = (await Promise.all(
    programIds.map(programId => getProgramRequirementTracking(programId, plannedCourseIds))
  )).flat();

  const issues: Array<{ severity: "error" | "warning" | "info"; title: string; detail: string; courseId?: number; semesterId?: number }> = [];
  const totalCredits = semesters.reduce((sum, sem) => sum + sem.totalCredits, 0);
  const missingCredits = Math.max(0, targetCredits - totalCredits);

  if (missingCredits > 0) {
    issues.push({
      severity: missingCredits > 12 ? "error" : "warning",
      title: "Credits below graduation target",
      detail: `${missingCredits} more credits are needed to reach the ${targetCredits}-credit target.`,
    });
  }

  for (const sem of semesters) {
    if (sem.totalCredits > 18) {
      issues.push({
        severity: "warning",
        title: "Heavy credit load",
        detail: `${sem.term} ${sem.year} has ${sem.totalCredits} credits.`,
        semesterId: sem.id,
      });
    }
    if (sem.workloadScore >= 8) {
      issues.push({
        severity: "warning",
        title: "High workload semester",
        detail: `${sem.term} ${sem.year} has a workload score of ${sem.workloadScore.toFixed(1)}/10.`,
        semesterId: sem.id,
      });
    }
  }

  const completed = new Set<number>();
  for (const sem of semesters) {
    for (const pc of sem.courses) {
      if (isPlaceholderCourseId(pc.courseId)) continue;
      if (!requiredCourseIds.has(pc.courseId)) {
        issues.push({
          severity: "info",
          title: "Course outside tracked requirements",
          detail: `${pc.course?.code ?? "A course"} is not attached to the selected program requirements. Keep it if it is an approved elective.`,
          courseId: pc.courseId,
          semesterId: sem.id,
        });
      }
      if (graph && !prerequisitesSatisfied(graph, pc.courseId, completed)) {
        issues.push({
          severity: "error",
          title: "Prerequisite timing issue",
          detail: `${pc.course?.code ?? "A course"} appears before one or more required prerequisites.`,
          courseId: pc.courseId,
          semesterId: sem.id,
        });
      }
      if (pc.course && !isCourseAvailableInTerm(pc.course as any, sem.term)) {
        issues.push({
          severity: "error",
          title: "Course offering mismatch",
          detail: `${pc.course.code} is not marked as offered in ${sem.term}. Move it to an offered term or choose an alternative.`,
          courseId: pc.courseId,
          semesterId: sem.id,
        });
      }
    }
    for (const pc of sem.courses) {
      if (!["dropped", "failed"].includes(pc.status)) completed.add(pc.courseId);
    }
  }

  const incompleteRequirementCount = requirementTracking.filter(category => !category.complete).length;
  if (incompleteRequirementCount > 0) {
    issues.push({
      severity: "warning",
      title: "Unmet requirement categories",
      detail: `${incompleteRequirementCount} requirement ${incompleteRequirementCount === 1 ? "category is" : "categories are"} not fully satisfied.`,
    });
  }

  const errorCount = issues.filter(issue => issue.severity === "error").length;
  const warningCount = issues.filter(issue => issue.severity === "warning").length;
  return {
    targetCredits,
    totalCredits,
    missingCredits,
    requirementTracking,
    health: {
      status: errorCount > 0 ? "needs_attention" : warningCount > 0 ? "review" : "healthy",
      errorCount,
      warningCount,
      infoCount: issues.filter(issue => issue.severity === "info").length,
      issues,
    },
  };
}

function extractCatalogPreview(sourceText: string) {
  const lines = sourceText.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const coursePattern = /\b([A-Z]{2,8})\s*[- ]?(\d{3,4}[A-Z]?)\b[:\s-]*([^.(]*)(?:\((\d+(?:\.\d+)?)\s*(?:credits?|cr)\))?/i;
  const prereqPattern = /(?:prereq(?:uisite)?s?|requires?)[:\s]+(.+)/i;
  const courses: Array<{ code: string; name: string; credits: number | null; sourceLine: string }> = [];
  const prerequisites: Array<{ courseCode: string; prerequisiteText: string }> = [];

  for (const line of lines) {
    const match = line.match(coursePattern);
    if (!match) continue;
    const code = `${match[1].toUpperCase()} ${match[2].toUpperCase()}`;
    courses.push({
      code,
      name: match[3]?.trim().replace(/\s+-\s*$/, "") || "Untitled Course",
      credits: match[4] ? Number(match[4]) : null,
      sourceLine: line,
    });
    const prereqMatch = line.match(prereqPattern);
    if (prereqMatch) {
      prerequisites.push({ courseCode: code, prerequisiteText: prereqMatch[1].trim() });
    }
  }

  return {
    courses,
    prerequisites,
    confidence: courses.length === 0 ? "low" : prerequisites.length > 0 ? "high" : "medium",
    notes: [
      "Preview only: review parsed courses before adding them to seed data.",
      "Prerequisites are preserved as text because catalogs vary widely in phrasing.",
    ],
  };
}

function serializeTimeline(plan: GeneratedPlan, graph: ReturnType<typeof buildCourseGraph>) {
  return plan.semesters.map(sem => ({
    semesterIndex: sem.semesterIndex,
    year: sem.year,
    term: sem.term,
    totalCredits: sem.totalCredits,
    courseCodes: sem.courseIds.map(id => graph.nodes.get(id)?.code ?? `Course ${id}`),
  }));
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    // Reset account: wipe all plans, scenarios, chat history, and student profile
    // but keep the user record so they can log back in and start fresh.
    resetAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await db.resetUserData(ctx.user.id);
      return { success: true } as const;
    }),

    // Delete account: wipe everything including the user record, then clear the session cookie.
    deleteAccount: protectedProcedure.mutation(async ({ ctx }) => {
      await db.deleteUserAccount(ctx.user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── Schools ────────────────────────────────────────────────────────────────
  schools: router({
    list: publicProcedure.query(async () => {
      return db.getAllSchools();
    }),
  }),

  // ─── Programs ───────────────────────────────────────────────────────────────
  programs: router({
    list: publicProcedure.input(z.object({ schoolId: z.number() })).query(async ({ input }) => {
      return db.getProgramsBySchool(input.schoolId);
    }),
  }),

  // ─── Courses ────────────────────────────────────────────────────────────────
  courses: router({
    list: publicProcedure.input(z.object({ schoolId: z.number() })).query(async ({ input }) => {
      const rawCourses = await db.getCoursesBySchool(input.schoolId);
      return rawCourses.map(c => ({
        ...c,
        tags: parseJson<string[]>(c.tagsJson, []),
        careerTracks: parseJson<string[]>(c.careerTracksJson, []),
      }));
    }),

    getGraph: publicProcedure.input(z.object({
      schoolId: z.number(),
      programId: z.number().optional(),
    })).query(async ({ input }) => {
      const graph = await buildGraphForSchool(input.schoolId);
      let courseIds = Array.from(graph.nodes.keys());

      if (input.programId) {
        const reqs = await db.getDegreeRequirementsByProgram(input.programId);
        const reqIds = new Set(reqs.map(r => r.courseId));
        courseIds = courseIds.filter(id => reqIds.has(id));
      }

      return getGraphVisualizationData(graph, courseIds);
    }),
  }),

  // ─── Career Tracks ───────────────────────────────────────────────────────────
  careerTracks: router({
    list: publicProcedure.query(async () => {
      const tracks = await db.getAllCareerTracks();
      return tracks.map(t => ({
        ...t,
        priorityCourseIds: parseJson<number[]>(t.priorityCourseIdsJson, []),
        recommendedByYear: parseJson<Record<string, number[]>>(t.recommendedByYearJson, {}),
      }));
    }),
  }),

  // ─── Student Profile ─────────────────────────────────────────────────────────
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      if (!profile) return null;
      return {
        ...profile,
        minorIds: parseJson<number[]>(profile.minorIdsJson, []),
        apCredits: parseJson<{ courseId: number; score: number }[]>(profile.apCreditsJson, []),
        transferCredits: parseJson<{ courseId: number; grade: string }[]>(profile.transferCreditsJson, []),
        completedCourseIds: parseJson<number[]>(profile.completedCourseIdsJson, []),
        preferences: parseJson(profile.preferencesJson, {
          workloadBalance: 'moderate',
          earlyGraduation: false,
          internshipSemester: null,
          maxCreditsPerSemester: 18,
          minCreditsPerSemester: 12,
          preferMorningClasses: false,
          avoidSummerClasses: true,
        }),
      };
    }),

    upsert: protectedProcedure.input(z.object({
      schoolId: z.number().optional(),
      primaryMajorId: z.number().optional(),
      secondaryMajorId: z.number().optional().nullable(),
      minorIds: z.array(z.number()).optional(),
      apCredits: z.array(z.object({ courseId: z.number(), score: z.number(), credits: z.number().optional(), examName: z.string().optional() })).optional(),
      transferCredits: z.array(z.object({ courseId: z.number(), grade: z.string().optional(), credits: z.number().optional(), description: z.string().optional() })).optional(),
      completedCourseIds: z.array(z.number()).optional(),
      targetGraduationYear: z.number().optional(),
      targetGraduationSemester: z.enum(['fall', 'spring']).optional(),
      startYear: z.number().optional(),
      startSemester: z.enum(['fall', 'spring']).optional(),
      careerTrackId: z.number().optional().nullable(),
      preferences: z.object({
        workloadBalance: z.enum(['light', 'moderate', 'heavy']).optional(),
        earlyGraduation: z.boolean().optional(),
        internshipSemester: z.string().nullable().optional(),
        maxCreditsPerSemester: z.number().optional(),
        minCreditsPerSemester: z.number().optional(),
        preferMorningClasses: z.boolean().optional(),
        avoidSummerClasses: z.boolean().optional(),
      }).optional(),
      isSetupComplete: z.boolean().optional(),
    })).mutation(async ({ ctx, input }) => {
      const existing = await db.getStudentProfileByUserId(ctx.user.id);
      const existingPrefs = existing ? parseJson(existing.preferencesJson, {}) : {};

      await db.upsertStudentProfile({
        userId: ctx.user.id,
        schoolId: input.schoolId,
        primaryMajorId: input.primaryMajorId,
        secondaryMajorId: input.secondaryMajorId ?? undefined,
        minorIdsJson: input.minorIds ? JSON.stringify(input.minorIds) : undefined,
        apCreditsJson: input.apCredits ? JSON.stringify(input.apCredits) : undefined,
        transferCreditsJson: input.transferCredits ? JSON.stringify(input.transferCredits) : undefined,
        completedCourseIdsJson: input.completedCourseIds ? JSON.stringify(input.completedCourseIds) : undefined,
        targetGraduationYear: input.targetGraduationYear,
        targetGraduationSemester: input.targetGraduationSemester,
        startYear: input.startYear,
        startSemester: input.startSemester,
        careerTrackId: input.careerTrackId ?? undefined,
        preferencesJson: input.preferences ? JSON.stringify({ ...existingPrefs, ...input.preferences }) : undefined,
        isSetupComplete: input.isSetupComplete,
      });

      return { success: true };
    }),
  }),

  // ─── Degree Requirements ──────────────────────────────────────────────────────
  requirements: router({
    getByProgram: publicProcedure.input(z.object({ programId: z.number() })).query(async ({ input }) => {
      const cats = await db.getRequirementCategoriesByProgram(input.programId);
      const result = [];
      for (const cat of cats) {
        const reqs = await db.getDegreeRequirementsByCategory(cat.id);
        result.push({
          ...cat,
          requirements: reqs.map(r => ({
            ...r,
            alternativeCourseIds: parseJson<number[]>(r.alternativeCourseIdsJson, []),
          })),
        });
      }
      return result;
    }),
  }),

  // ─── Catalog Tools ─────────────────────────────────────────────────────────
  catalog: router({
    previewImport: protectedProcedure.input(z.object({
      sourceText: z.string().min(20).max(50000),
      sourceName: z.string().optional(),
    })).mutation(async ({ input }) => {
      return {
        sourceName: input.sourceName ?? "Pasted catalog text",
        ...extractCatalogPreview(input.sourceText),
      };
    }),
  }),

  researchAgent: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const library = await readSourceLibrary(ctx.user.id);
      return {
        watchlist: DEFAULT_RESEARCH_TARGETS,
        state: await readCatalogResearchState(ctx.user.id),
        library: {
          updatedAt: library.updatedAt,
          sources: library.sources.map(source => {
            const { excerpt: _excerpt, ...summary } = source;
            return { ...summary, freshness: sourceFreshness(source) };
          }),
        },
      };
    }),

    runOnce: protectedProcedure.input(z.object({
      targets: z.array(z.object({
        schoolName: z.string().min(2),
        majorName: z.string().min(2),
        sourceUrls: z.array(z.string().url()).max(5).optional(),
      })).min(1).max(8).optional(),
    }).optional()).mutation(async ({ ctx, input }) => {
      const targets = input?.targets ?? DEFAULT_RESEARCH_TARGETS.slice(0, 3);
      const state = await runCatalogResearchCycle(targets, ctx.user.id);
      const updates = state.updates.slice(0, targets.length);
      for (const update of updates) {
        if (update.sources.length > 0) {
          await saveSourcesToLibrary({
            scope: ctx.user.id,
            schoolName: update.schoolName,
            majorName: update.majorName,
            sources: update.sources,
          });
        }
      }
      return state;
    }),

    scrapeUrls: protectedProcedure.input(z.object({
      schoolName: z.string().trim().min(2).max(160),
      majorName: z.string().trim().min(2).max(160),
      urls: z.array(z.string().url()).min(1).max(4),
    })).mutation(async ({ ctx, input }) => {
      const sources = [];
      const failures: Array<{ url: string; error: string }> = [];
      for (const url of Array.from(new Set(input.urls))) {
        try {
          sources.push(await scrapeWebSource(url));
        } catch (error) {
          const message = error instanceof Error ? error.message : "The website could not be retrieved.";
          failures.push({ url, error: message });
          await saveFailedWebSource({
            scope: ctx.user.id,
            schoolName: input.schoolName,
            majorName: input.majorName,
            url,
            error: message,
          });
        }
      }

      if (sources.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: failures[0]?.error ?? "No websites could be retrieved.",
        });
      }

      await saveSourcesToLibrary({
        scope: ctx.user.id,
        schoolName: input.schoolName,
        majorName: input.majorName,
        sources,
      });
      const state = await runCatalogResearchImport({
        schoolName: input.schoolName,
        majorName: input.majorName,
        sources,
        scope: ctx.user.id,
      });
      return { state, update: state.updates[0], failures };
    }),

    importSources: protectedProcedure.input(z.object({
      schoolName: z.string().trim().min(2).max(160),
      majorName: z.string().trim().min(2).max(160),
      files: z.array(z.object({
        name: z.string().trim().min(1).max(180),
        mimeType: z.string().max(120),
        dataBase64: z.string().min(1).max(Math.ceil(MAX_IMPORTED_SOURCE_BYTES * 4 / 3) + 128),
      })).min(1).max(4),
    })).mutation(async ({ ctx, input }) => {
      let sources;
      try {
        sources = await Promise.all(input.files.map(file => createImportedSource(file)));
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "The source could not be imported.",
        });
      }

      const uniqueSources = Array.from(new Map(
        sources.map(source => [source.contentHash ?? source.url, source]),
      ).values());

      await saveSourcesToLibrary({
        scope: ctx.user.id,
        schoolName: input.schoolName,
        majorName: input.majorName,
        sources: uniqueSources,
      });

      const state = await runCatalogResearchImport({
        schoolName: input.schoolName,
        majorName: input.majorName,
        sources: uniqueSources,
        scope: ctx.user.id,
      });
      return {
        state,
        update: state.updates[0],
        duplicateCount: sources.length - uniqueSources.length,
      };
    }),

    refreshSource: protectedProcedure.input(z.object({
      sourceId: z.string().min(1).max(64),
    })).mutation(async ({ ctx, input }) => {
      const library = await readSourceLibrary(ctx.user.id);
      const existing = library.sources.find(source => source.id === input.sourceId);
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Source not found." });
      if (!existing.url.startsWith("http://") && !existing.url.startsWith("https://")) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Uploaded files cannot be refreshed from the web." });
      }

      let refreshed;
      try {
        refreshed = await scrapeWebSource(existing.requestedUrl ?? existing.url);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The website could not be refreshed.";
        await saveFailedWebSource({
          scope: ctx.user.id,
          schoolName: existing.schoolName,
          majorName: existing.majorName,
          url: existing.requestedUrl ?? existing.url,
          error: message,
        });
        throw new TRPCError({ code: "BAD_REQUEST", message });
      }

      await saveSourcesToLibrary({
        scope: ctx.user.id,
        schoolName: existing.schoolName,
        majorName: existing.majorName,
        sources: [refreshed],
      });
      const state = await runCatalogResearchImport({
        schoolName: existing.schoolName,
        majorName: existing.majorName,
        sources: [refreshed],
        scope: ctx.user.id,
      });
      return { state, update: state.updates[0] };
    }),

    removeSource: protectedProcedure.input(z.object({
      sourceId: z.string().min(1).max(64),
    })).mutation(async ({ ctx, input }) => {
      const state = await removeSourceFromLibrary(ctx.user.id, input.sourceId);
      if (!state) throw new TRPCError({ code: "NOT_FOUND", message: "Source not found." });
      return state;
    }),

    approveImport: protectedProcedure.input(z.object({
      updateId: z.string(),
    })).mutation(async ({ ctx, input }) => {
      const state = await readCatalogResearchState(ctx.user.id);
      const update = state.updates.find(item => item.id === input.updateId);
      if (!update) throw new TRPCError({ code: "NOT_FOUND", message: "Research update not found." });
      if (update.extractedCourses.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This update has no extracted courses to import. Add a richer official catalog source first.",
        });
      }

      const school = await db.findOrCreateSchool({ name: update.schoolName });
      const program = await db.findOrCreateProgram({
        schoolId: school.id,
        name: update.majorName,
        type: "major",
        totalCreditsRequired: 120,
        description: `Imported from catalog research on ${new Date().toLocaleDateString()}. Verify official requirements before advising use.`,
      });

      const importedCourses: Awaited<ReturnType<typeof db.findOrCreateCourse>>[] = [];
      const importedCourseByCode = new Map<string, Awaited<ReturnType<typeof db.findOrCreateCourse>>>();
      for (const course of update.extractedCourses.slice(0, 40)) {
        const saved = await db.findOrCreateCourse({
          schoolId: school.id,
          code: course.code,
          name: course.name,
          credits: course.credits ?? 3,
          description: `Imported from ${course.sourceUrl}. Verify exact catalog wording before advising use.`,
          tags: ["catalog-import", "research-agent"],
        });
        importedCourses.push(saved);
        importedCourseByCode.set(saved.code.toUpperCase(), saved);
      }

      const existingCategories = await db.getRequirementCategoriesByProgram(program.id);
      const structuredRequirements = update.structuredRequirements ?? [];
      const createdCategoryIds: number[] = [];

      if (structuredRequirements.length > 0) {
        for (let index = 0; index < structuredRequirements.length; index += 1) {
          const requirementCategory = structuredRequirements[index];
          let categoryId = existingCategories.find(category => category.name === requirementCategory.name)?.id;
          const categoryCourses = requirementCategory.courses
            .map((course: { code: string }) => importedCourseByCode.get(course.code.toUpperCase()))
            .filter(Boolean) as Awaited<ReturnType<typeof db.findOrCreateCourse>>[];

          if (!categoryId) {
            categoryId = await db.createRequirementCategory({
              programId: program.id,
              name: requirementCategory.name,
              type: requirementCategory.type,
              creditsRequired: requirementCategory.creditsRequired
                ?? categoryCourses.reduce((sum, course) => sum + (course.credits ?? 3), 0),
              coursesRequired: requirementCategory.coursesRequired ?? categoryCourses.length,
              description: [
                "Imported by the catalog research agent. Review against the official catalog before advising use.",
                requirementCategory.rules.length ? `Rules: ${requirementCategory.rules.join(" ")}` : null,
                requirementCategory.sourceUrl ? `Source: ${requirementCategory.sourceUrl}` : null,
              ].filter(Boolean).join(" "),
              sortOrder: index,
            });
          }
          createdCategoryIds.push(categoryId);

          const existingRequirements = await db.getDegreeRequirementsByCategory(categoryId);
          const existingRequirementCourseIds = new Set(existingRequirements.map(req => req.courseId));
          for (const course of categoryCourses) {
            if (existingRequirementCourseIds.has(course.id)) continue;
            const sourceCourse = requirementCategory.courses.find((item: { code: string }) => item.code.toUpperCase() === course.code.toUpperCase());
            await db.createDegreeRequirement({
              categoryId,
              courseId: course.id,
              isRequired: sourceCourse?.required ?? true,
              notes: [
                "Imported from structured research-agent extraction.",
                requirementCategory.rules.length ? `Rules: ${requirementCategory.rules.join(" ")}` : null,
                requirementCategory.sourceUrl ? `Source: ${requirementCategory.sourceUrl}` : null,
              ].filter(Boolean).join(" "),
            });
          }
        }
      } else {
        let categoryId = existingCategories.find(category => category.name === "Researched Core Requirements")?.id;
        if (!categoryId) {
          categoryId = await db.createRequirementCategory({
            programId: program.id,
            name: "Researched Core Requirements",
            type: "core",
            creditsRequired: importedCourses.reduce((sum, course) => sum + (course.credits ?? 3), 0),
            coursesRequired: importedCourses.length,
            description: "Imported by the catalog research agent. Review against the official catalog before advising use.",
            sortOrder: 0,
          });
        }
        createdCategoryIds.push(categoryId);

        const existingRequirements = await db.getDegreeRequirementsByCategory(categoryId);
        const existingRequirementCourseIds = new Set(existingRequirements.map(req => req.courseId));
        for (const course of importedCourses) {
          if (existingRequirementCourseIds.has(course.id)) continue;
          await db.createDegreeRequirement({
            categoryId,
            courseId: course.id,
            isRequired: true,
            notes: "Imported from research-agent extracted catalog evidence.",
          });
        }
      }

      const categoryId = createdCategoryIds[0] ?? null;

      const nextState = {
        ...state,
        updatedAt: new Date().toISOString(),
        updates: state.updates.map(item => item.id === update.id
          ? {
              ...item,
              importedAt: new Date().toISOString(),
              importedSchoolId: school.id,
              importedProgramId: program.id,
              importedCourseIds: importedCourses.map(course => course.id),
              notes: Array.from(new Set([
                ...item.notes,
                "Approved import created or reused school, major, courses, and requirement records.",
              ])),
            }
          : item),
      };
      await writeCatalogResearchState(nextState, ctx.user.id);

      return {
        schoolId: school.id,
        programId: program.id,
        courseCount: importedCourses.length,
        requirementCategoryId: categoryId,
      };
    }),
  }),

  // ─── Plans ───────────────────────────────────────────────────────────────────
  plans: router({
    generate: protectedProcedure.input(z.object({
      save: z.boolean().optional().default(false),
    })).mutation(async ({ ctx, input }) => {
      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      if (!profile?.schoolId || !profile?.primaryMajorId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Please complete your student profile first.' });
      }

      const prefs = parseJson(profile.preferencesJson, {
        workloadBalance: 'moderate' as const,
        earlyGraduation: false,
        internshipSemester: null as string | null,
        maxCreditsPerSemester: 18,
        minCreditsPerSemester: 12,
        avoidSummerClasses: true,
      });

      const savedCompletedCourseIds = parseJson<number[]>(profile.completedCourseIdsJson, []);
      const minorIds = parseJson<number[]>(profile.minorIdsJson, []);

      const [graph, requiredCourseIds, targetCredits] = await Promise.all([
        buildGraphForSchool(profile.schoolId),
        getRequiredCourseIds(profile.primaryMajorId, profile.secondaryMajorId, minorIds),
        getTargetCredits(profile.primaryMajorId, profile.secondaryMajorId, minorIds),
      ]);

      if (requiredCourseIds.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This school/program is available for selection, but its course requirements have not been ingested yet. Use the Researcher agent to verify requirements, or add catalog requirements before generating a plan.',
        });
      }

      const completedCourseIds = Array.from(new Set([
        ...savedCompletedCourseIds,
        ...getApEquivalentCourseIds(graph, profile),
      ]));
      let careerTrackCourseIds: number[] = [];
      if (profile.careerTrackId) {
        const track = await db.getCareerTrackById(profile.careerTrackId);
        if (track) careerTrackCourseIds = getCareerTrackCourseIds(graph, track, requiredCourseIds);
      }

      const constraints: ScheduleConstraints = {
        maxCreditsPerSemester: prefs.maxCreditsPerSemester ?? 18,
        minCreditsPerSemester: prefs.minCreditsPerSemester ?? 12,
        startYear: profile.startYear ?? new Date().getFullYear(),
        startSemester: profile.startSemester ?? 'fall',
        avoidSummerClasses: prefs.avoidSummerClasses ?? true,
        completedCourseIds,
        internshipSemester: prefs.internshipSemester,
        careerTrackCourseIds,
        targetTotalCredits: Math.max(0, targetCredits - getUnmappedPriorCreditTotal(profile)),
        targetSemesters: prefs.earlyGraduation ? undefined : 8,
        maxSemesters: Math.max(8, Math.ceil(targetCredits / Math.max(1, prefs.maxCreditsPerSemester ?? 18)) + 2),
      };

      const plans = generateAllVariants(graph, requiredCourseIds, constraints);

      if (input.save) {
        const variantNames = {
          fastest_path: 'Fastest Path',
          lowest_stress_path: 'Lowest Stress Path',
          most_flexible_path: 'Most Flexible Path',
        };

        const savedIds: number[] = [];
        for (const plan of plans) {
          const id = await savePlanToDb(plan, ctx.user.id, variantNames[plan.variantType]);
          savedIds.push(id);
        }

        // Notify owner
        await notifyOwner({ title: 'New Plan Generated', content: `User ${ctx.user.name} generated a new degree plan.` }).catch(() => {});

        return { plans, savedIds };
      }

      return { plans, savedIds: [] };
    }),

    list: protectedProcedure.query(async ({ ctx }) => {
      const rawPlans = await db.getDegreePlansByUser(ctx.user.id);
      return rawPlans.map(p => ({
        ...p,
        scores: parseJson(p.scoresJson, { workload: 0, difficulty: 0, flexibility: 0, careerReadiness: 0, overall: 0 }),
      }));
    }),

    get: protectedProcedure.input(z.object({ planId: z.number() })).query(async ({ ctx, input }) => {
      const plan = await db.getDegreePlanById(input.planId);
      if (!plan || plan.userId !== ctx.user.id) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found.' });
      }

      const semesters = await db.getPlanSemesters(input.planId);
      const semestersWithCourses = await Promise.all(
        semesters.map(async sem => {
          const planCoursesData = await db.getPlanCoursesBySemester(sem.id);
          const courseIds = planCoursesData.map(pc => pc.courseId);
          const coursesData = await db.getCoursesByIds(courseIds);
          const courseMap = new Map(coursesData.map(c => [c.id, c]));

          const courses = planCoursesData.map(pc => ({
            planCourseId: pc.id,
            courseId: pc.courseId,
            status: pc.status,
            grade: pc.grade,
            course: courseMap.get(pc.courseId)
              ? {
                  ...courseMap.get(pc.courseId)!,
                  tags: parseJson<string[]>(courseMap.get(pc.courseId)!.tagsJson, []),
                  careerTracks: parseJson<string[]>(courseMap.get(pc.courseId)!.careerTracksJson, []),
                }
              : parsePlaceholderCourse(pc),
          }));
          const visibleCourses = courses.map(pc => pc.course).filter(Boolean);
          const totalCredits = visibleCourses.reduce((sum, course) => sum + (course?.credits ?? 0), 0);
          const totalWorkloadHours = visibleCourses.reduce((sum, course) => sum + (course?.workloadHours ?? 0), 0);
          const averageDifficulty = visibleCourses.length
            ? visibleCourses.reduce((sum, course) => sum + (course?.difficultyLevel ?? 0), 0) / visibleCourses.length
            : 0;

          return {
            ...sem,
            totalCredits,
            workloadScore: Math.round(Math.min(10, (totalWorkloadHours / 65) * 10) * 10) / 10,
            difficultyScore: Math.round(averageDifficulty * 2 * 10) / 10,
            courses,
          };
        })
      );

      const normalizedSemesters = semestersWithCourses.sort(compareSemesters);
      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      const analysis = profile
        ? await analyzePlanForProfile(profile, normalizedSemesters as SemesterPayload[])
        : {
            targetCredits: normalizedSemesters.reduce((sum, sem) => sum + (sem.totalCredits ?? 0), 0),
            totalCredits: normalizedSemesters.reduce((sum, sem) => sum + (sem.totalCredits ?? 0), 0),
            missingCredits: 0,
            requirementTracking: [],
            health: { status: "healthy", errorCount: 0, warningCount: 0, infoCount: 0, issues: [] },
          };

      return {
        ...plan,
        totalCredits: normalizedSemesters.reduce((sum, sem) => sum + (sem.totalCredits ?? 0), 0),
        scores: parseJson(plan.scoresJson, { workload: 0, difficulty: 0, flexibility: 0, careerReadiness: 0, overall: 0 }),
        semesters: normalizedSemesters,
        targetCredits: analysis.targetCredits,
        missingCredits: analysis.missingCredits,
        health: analysis.health,
        requirementTracking: analysis.requirementTracking,
      };
    }),

    setActive: protectedProcedure.input(z.object({ planId: z.number() })).mutation(async ({ ctx, input }) => {
      const plans = await db.getDegreePlansByUser(ctx.user.id);
      for (const p of plans) {
        await db.updateDegreePlan(p.id, { isActive: p.id === input.planId });
      }
      return { success: true };
    }),

    updateCourseStatus: protectedProcedure.input(z.object({
      planCourseId: z.number(),
      status: z.enum(['planned', 'enrolled', 'completed', 'dropped', 'failed', 'waived']),
      grade: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      await db.updatePlanCourseStatus(input.planCourseId, input.status, input.grade);
      return { success: true };
    }),

    updateProgress: protectedProcedure.input(z.object({
      courseId: z.number(),
      completed: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      if (!profile) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' });
      const completed = new Set(parseJson<number[]>(profile.completedCourseIdsJson, []));
      if (input.completed) completed.add(input.courseId);
      else completed.delete(input.courseId);
      await db.upsertStudentProfile({
        userId: ctx.user.id,
        completedCourseIdsJson: JSON.stringify(Array.from(completed)),
      });
      return { success: true, completedCourseIds: Array.from(completed) };
    }),

    moveCourse: protectedProcedure.input(z.object({
      planCourseId: z.number(),
      targetSemesterId: z.number(),
    })).mutation(async ({ ctx, input }) => {
      const planCourse = await db.getPlanCourseById(input.planCourseId);
      if (!planCourse) throw new TRPCError({ code: 'NOT_FOUND', message: 'Course assignment not found.' });

      const allPlans = await db.getDegreePlansByUser(ctx.user.id);
      const ownedPlanIds = new Set(allPlans.map(plan => plan.id));
      const allSemesters = (await Promise.all(allPlans.map(plan => db.getPlanSemesters(plan.id)))).flat();
      const semesterMap = new Map(allSemesters.map(sem => [sem.id, sem]));
      const sourceSemester = semesterMap.get(planCourse.semesterId);
      const targetSemester = semesterMap.get(input.targetSemesterId);

      if (!sourceSemester || !targetSemester || !ownedPlanIds.has(sourceSemester.planId) || sourceSemester.planId !== targetSemester.planId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Cannot move this course in the selected plan.' });
      }

      await db.movePlanCourse(input.planCourseId, input.targetSemesterId);
      return { success: true };
    }),

    recommendElectives: protectedProcedure.input(z.object({
      planId: z.number(),
      limit: z.number().min(1).max(20).optional().default(8),
    })).query(async ({ ctx, input }) => {
      const [plan, profile] = await Promise.all([
        db.getDegreePlanById(input.planId),
        db.getStudentProfileByUserId(ctx.user.id),
      ]);
      if (!plan || plan.userId !== ctx.user.id || !profile?.schoolId) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found.' });
      }
      const semesters = await db.getPlanSemesters(input.planId);
      const planCoursesData = (await Promise.all(semesters.map(sem => db.getPlanCoursesBySemester(sem.id)))).flat();
      const plannedIds = new Set(planCoursesData.map(pc => pc.courseId).filter(id => !isPlaceholderCourseId(id)));
      const minorIds = parseJson<number[]>(profile.minorIdsJson, []);
      const requiredIds = profile.primaryMajorId
        ? new Set(await getRequiredCourseIds(profile.primaryMajorId, profile.secondaryMajorId, minorIds))
        : new Set<number>();
      const allCourses = await db.getCoursesBySchool(profile.schoolId);
      const careerTrack = profile.careerTrackId ? await db.getCareerTrackById(profile.careerTrackId) : undefined;
      const careerSlug = careerTrack?.slug;
      const targetCredits = profile.primaryMajorId ? await getTargetCredits(profile.primaryMajorId, profile.secondaryMajorId, minorIds) : 120;
      const currentCredits = plan.totalCredits ?? 0;
      const needsCredits = Math.max(0, targetCredits - currentCredits);

      return allCourses
        .filter(course => !plannedIds.has(course.id) && !requiredIds.has(course.id))
        .map(course => {
          const tags = parseJson<string[]>(course.tagsJson, []);
          const careerTracks = parseJson<string[]>(course.careerTracksJson, []);
          const score =
            (careerSlug && careerTracks.includes(careerSlug) ? 5 : 0) +
            (course.isUpperDivision ? 2 : 0) +
            (tags.some(tag => /elective|general|breadth|distribution|writing/i.test(tag)) ? 3 : 0) +
            Math.max(0, 4 - course.difficultyLevel);
          return {
            id: course.id,
            code: course.code,
            name: course.name,
            credits: course.credits,
            difficultyLevel: course.difficultyLevel,
            availableTerms: [
              course.availableFall ? "fall" : null,
              course.availableSpring ? "spring" : null,
              course.availableSummer ? "summer" : null,
            ].filter(Boolean),
            tags,
            reason: needsCredits > 0
              ? `Helps close a ${needsCredits}-credit gap with a ${course.credits}-credit elective.`
              : careerSlug && careerTracks.includes(careerSlug)
                ? "Matches your selected career track."
                : "Adds flexible elective credit without duplicating a required course.",
            score,
          };
        })
        .sort((a, b) => b.score - a.score || a.difficultyLevel - b.difficultyLevel)
        .slice(0, input.limit);
    }),

    advisorReport: protectedProcedure.input(z.object({ planId: z.number() })).query(async ({ ctx, input }) => {
      const plan = await db.getDegreePlanById(input.planId);
      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      if (!plan || plan.userId !== ctx.user.id || !profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found.' });
      }
      const semesters = await db.getPlanSemesters(input.planId);
      const enrichedSemesters = await Promise.all(semesters.map(async sem => {
        const pcs = await db.getPlanCoursesBySemester(sem.id);
        const courses = await db.getCoursesByIds(pcs.map(pc => pc.courseId));
        const courseMap = new Map(courses.map(course => [course.id, course]));
        const enrichedCourses = pcs.map(pc => {
          const course = courseMap.get(pc.courseId);
          return {
            planCourseId: pc.id,
            courseId: pc.courseId,
            status: pc.status,
            grade: pc.grade,
            course: course
              ? { ...course, tags: parseJson<string[]>(course.tagsJson, []), careerTracks: parseJson<string[]>(course.careerTracksJson, []) }
              : parsePlaceholderCourse(pc),
          };
        });
        return {
          ...sem,
          courses: enrichedCourses,
          totalCredits: enrichedCourses.reduce((sum, pc) => sum + (pc.course?.credits ?? 0), 0),
          workloadScore: sem.workloadScore ?? 0,
          difficultyScore: sem.difficultyScore ?? 0,
        };
      }));
      const normalizedSemesters = enrichedSemesters.sort(compareSemesters);
      const analysis = await analyzePlanForProfile(profile, normalizedSemesters as SemesterPayload[]);
      const school = profile.schoolId ? (await db.getAllSchools()).find(s => s.id === profile.schoolId) : null;
      const primaryMajor = profile.primaryMajorId ? await db.getProgramById(profile.primaryMajorId) : null;
      const lines = [
        `Advisor Validation Report: ${plan.name}`,
        `Student: ${ctx.user.name ?? "Student"}`,
        `School: ${school?.name ?? "Unknown"}`,
        `Primary major: ${primaryMajor?.name ?? "Unknown"}`,
        `Credits: ${analysis.totalCredits}/${analysis.targetCredits}`,
        `Estimated graduation: ${plan.estimatedGraduationSemester} ${plan.estimatedGraduationYear}`,
        "",
        "Plan health:",
        ...analysis.health.issues.map(issue => `- [${issue.severity.toUpperCase()}] ${issue.title}: ${issue.detail}`),
        analysis.health.issues.length ? "" : "- No issues detected.",
        "",
        "Requirement tracking:",
        ...analysis.requirementTracking.map(req => `- ${req.programName} / ${req.categoryName}: ${req.satisfiedCount}/${req.totalCount} (${req.complete ? "complete" : "open"})`),
        "",
        "Advisor questions:",
        "- Are placeholder/free elective credits acceptable for this program?",
        "- Do listed electives satisfy residency, upper-level, and distribution rules?",
        "- Are course offering assumptions current for the planned terms?",
      ];
      return { markdown: lines.join("\n"), analysis };
    }),

    replan: protectedProcedure.input(z.object({
      planId: z.number(),
      triggerType: z.enum(['drop_course', 'fail_course', 'course_unavailable', 'add_major', 'change_graduation', 'add_minor', 'custom']),
      courseId: z.number().optional(),
      additionalCourseIds: z.array(z.number()).optional(),
      description: z.string().optional(),
      currentSemesterIndex: z.number().default(0),
      save: z.boolean().optional().default(true),
    })).mutation(async ({ ctx, input }) => {
      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      if (!profile?.schoolId || !profile?.primaryMajorId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Profile incomplete.' });
      }

      const prefs = parseJson(profile.preferencesJson, {
        workloadBalance: 'moderate' as const,
        earlyGraduation: false,
        internshipSemester: null as string | null,
        maxCreditsPerSemester: 18,
        minCreditsPerSemester: 12,
        avoidSummerClasses: true,
      });

      const completedCourseIds = parseJson<number[]>(profile.completedCourseIdsJson, []);
      const minorIds = parseJson<number[]>(profile.minorIdsJson, []);

      const [graph, requiredCourseIds, existingPlanData] = await Promise.all([
        buildGraphForSchool(profile.schoolId),
        getRequiredCourseIds(profile.primaryMajorId, profile.secondaryMajorId, minorIds),
        db.getDegreePlanById(input.planId),
      ]);

      if (!existingPlanData) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found.' });

      const semesters = await db.getPlanSemesters(input.planId);
      const semestersWithCourses = await Promise.all(
        semesters.map(async sem => {
          const pcs = await db.getPlanCoursesBySemester(sem.id);
          return { ...sem, courseIds: pcs.map(pc => pc.courseId) };
        })
      );

      const existingPlan: GeneratedPlan = {
        variantType: existingPlanData.variantType as any,
        semesters: semestersWithCourses.map(s => ({
          semesterIndex: s.semesterIndex,
          year: s.year,
          term: s.term,
          courseIds: s.courseIds,
          totalCredits: s.totalCredits ?? 0,
          workloadScore: s.workloadScore ?? 0,
          difficultyScore: s.difficultyScore ?? 0,
        })),
        totalCredits: existingPlanData.totalCredits ?? 0,
        totalSemesters: existingPlanData.totalSemesters ?? 0,
        estimatedGraduationYear: existingPlanData.estimatedGraduationYear ?? 2028,
        estimatedGraduationSemester: existingPlanData.estimatedGraduationSemester ?? 'spring',
        scores: parseJson(existingPlanData.scoresJson, { workload: 0, difficulty: 0, flexibility: 0, careerReadiness: 0, overall: 0 }),
      };

      const constraints: ScheduleConstraints = {
        maxCreditsPerSemester: prefs.maxCreditsPerSemester ?? 18,
        minCreditsPerSemester: prefs.minCreditsPerSemester ?? 12,
        startYear: profile.startYear ?? new Date().getFullYear(),
        startSemester: profile.startSemester ?? 'fall',
        avoidSummerClasses: prefs.avoidSummerClasses ?? true,
        completedCourseIds,
        internshipSemester: prefs.internshipSemester,
      };

      const result = replan(
        graph,
        existingPlan,
        {
          type: input.triggerType,
          courseId: input.courseId,
          additionalCourseIds: input.additionalCourseIds,
          description: input.description ?? `Replanning: ${input.triggerType}`,
        },
        requiredCourseIds,
        constraints,
        input.currentSemesterIndex
      );

      let newPlanId: number | undefined;
      if (input.save) {
        newPlanId = await savePlanToDb(result.updatedPlan, ctx.user.id, `Replanned Plan (${new Date().toLocaleDateString()})`);
      }

      return {
        ...result,
        newPlanId,
        beforeTimeline: serializeTimeline(existingPlan, graph),
        afterTimeline: serializeTimeline(result.updatedPlan, graph),
      };
    }),

    simulate: protectedProcedure.input(z.object({
      planId: z.number(),
      scenarioType: z.enum(['drop_course', 'add_major', 'change_graduation', 'fail_course', 'add_minor', 'custom']),
      courseId: z.number().optional(),
      additionalCourseIds: z.array(z.number()).optional(),
      description: z.string().optional(),
      currentSemesterIndex: z.number().default(0),
      saveName: z.string().optional(),
    })).mutation(async ({ ctx, input }) => {
      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      if (!profile?.schoolId || !profile?.primaryMajorId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Profile incomplete.' });
      }

      const prefs = parseJson(profile.preferencesJson, {
        workloadBalance: 'moderate' as const,
        earlyGraduation: false,
        internshipSemester: null as string | null,
        maxCreditsPerSemester: 18,
        minCreditsPerSemester: 12,
        avoidSummerClasses: true,
      });

      const completedCourseIds = parseJson<number[]>(profile.completedCourseIdsJson, []);
      const minorIds = parseJson<number[]>(profile.minorIdsJson, []);

      const [graph, requiredCourseIds, existingPlanData] = await Promise.all([
        buildGraphForSchool(profile.schoolId),
        getRequiredCourseIds(profile.primaryMajorId, profile.secondaryMajorId, minorIds),
        db.getDegreePlanById(input.planId),
      ]);

      if (!existingPlanData) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found.' });

      const semesters = await db.getPlanSemesters(input.planId);
      const semestersWithCourses = await Promise.all(
        semesters.map(async sem => {
          const pcs = await db.getPlanCoursesBySemester(sem.id);
          return { ...sem, courseIds: pcs.map(pc => pc.courseId) };
        })
      );

      const existingPlan: GeneratedPlan = {
        variantType: existingPlanData.variantType as any,
        semesters: semestersWithCourses.map(s => ({
          semesterIndex: s.semesterIndex,
          year: s.year,
          term: s.term,
          courseIds: s.courseIds,
          totalCredits: s.totalCredits ?? 0,
          workloadScore: s.workloadScore ?? 0,
          difficultyScore: s.difficultyScore ?? 0,
        })),
        totalCredits: existingPlanData.totalCredits ?? 0,
        totalSemesters: existingPlanData.totalSemesters ?? 0,
        estimatedGraduationYear: existingPlanData.estimatedGraduationYear ?? 2028,
        estimatedGraduationSemester: existingPlanData.estimatedGraduationSemester ?? 'spring',
        scores: parseJson(existingPlanData.scoresJson, { workload: 0, difficulty: 0, flexibility: 0, careerReadiness: 0, overall: 0 }),
      };

      const constraints: ScheduleConstraints = {
        maxCreditsPerSemester: prefs.maxCreditsPerSemester ?? 18,
        minCreditsPerSemester: prefs.minCreditsPerSemester ?? 12,
        startYear: profile.startYear ?? new Date().getFullYear(),
        startSemester: profile.startSemester ?? 'fall',
        avoidSummerClasses: prefs.avoidSummerClasses ?? true,
        completedCourseIds,
        internshipSemester: prefs.internshipSemester,
      };

      const result = simulateScenario(
        graph,
        existingPlan,
        {
          type: input.scenarioType,
          courseId: input.courseId,
          additionalCourseIds: input.additionalCourseIds,
          description: input.description,
        },
        requiredCourseIds,
        constraints,
        input.currentSemesterIndex
      );

      // Save scenario
      await db.createScenarioSimulation({
        userId: ctx.user.id,
        basePlanId: input.planId,
        name: input.saveName ?? `What if: ${input.scenarioType}`,
        scenarioType: input.scenarioType,
        parametersJson: JSON.stringify({ courseId: input.courseId, additionalCourseIds: input.additionalCourseIds }),
        resultPlanDataJson: JSON.stringify(result.updatedPlan),
        impactSummary: result.impactSummary,
      });

      return {
        ...result,
        beforeTimeline: serializeTimeline(existingPlan, graph),
        afterTimeline: serializeTimeline(result.updatedPlan, graph),
      };
    }),

    compare: protectedProcedure.input(z.object({
      planIds: z.array(z.number()).min(2).max(3),
    })).query(async ({ ctx, input }) => {
      const plans = await Promise.all(input.planIds.map(id => db.getDegreePlanById(id)));
      const validPlans = plans.filter(Boolean);
      return validPlans.map(p => ({
        id: p!.id,
        name: p!.name,
        variantType: p!.variantType,
        totalCredits: p!.totalCredits,
        totalSemesters: p!.totalSemesters,
        estimatedGraduationYear: p!.estimatedGraduationYear,
        estimatedGraduationSemester: p!.estimatedGraduationSemester,
        scores: parseJson(p!.scoresJson, { workload: 0, difficulty: 0, flexibility: 0, careerReadiness: 0, overall: 0 }),
      }));
    }),
    exportPdf: protectedProcedure.input(z.object({ planId: z.number() })).mutation(async ({ ctx, input }) => {
      const plan = await db.getDegreePlanById(input.planId);
      if (!plan || plan.userId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND', message: 'Plan not found.' });
      const semesters = await db.getPlanSemesters(input.planId);
      const semestersWithCourses = await Promise.all(
        semesters.map(async sem => {
          const pcs = await db.getPlanCoursesBySemester(sem.id);
          const courseIds = pcs.map(pc => pc.courseId);
          const courses = await db.getCoursesByIds(courseIds);
          const courseMap = new Map(courses.map(course => [course.id, course]));
          const enrichedCourses = pcs.map(pc => {
            const course = courseMap.get(pc.courseId);
            return {
              planCourseId: pc.id,
              courseId: pc.courseId,
              status: pc.status,
              grade: pc.grade,
              course: course
                ? {
                    ...course,
                    tags: parseJson<string[]>(course.tagsJson, []),
                    careerTracks: parseJson<string[]>(course.careerTracksJson, []),
                  }
                : parsePlaceholderCourse(pc),
            };
          });
          const visibleCourses = enrichedCourses.map(pc => pc.course).filter(Boolean);
          const totalCredits = visibleCourses.reduce((sum, course) => sum + (course?.credits ?? 0), 0);
          return { ...sem, totalCredits, courses: enrichedCourses };
        })
      );
      const normalizedSemesters = semestersWithCourses.sort(compareSemesters);
      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      const analysis = profile
        ? await analyzePlanForProfile(profile, normalizedSemesters as SemesterPayload[])
        : null;
      // Return structured data for client-side PDF generation
      return {
        planName: plan.name,
        variantType: plan.variantType,
        totalCredits: normalizedSemesters.reduce((sum, sem) => sum + (sem.totalCredits ?? 0), 0),
        targetCredits: analysis?.targetCredits ?? plan.totalCredits,
        missingCredits: analysis?.missingCredits ?? 0,
        totalSemesters: normalizedSemesters.length,
        estimatedGraduation: `${plan.estimatedGraduationSemester} ${plan.estimatedGraduationYear}`,
        scores: parseJson(plan.scoresJson, { workload: 0, difficulty: 0, flexibility: 0, careerReadiness: 0, overall: 0 }),
        health: analysis?.health,
        requirementTracking: analysis?.requirementTracking ?? [],
        semesters: normalizedSemesters.map(s => ({
          year: s.year,
          term: s.term,
          totalCredits: s.totalCredits,
          courses: s.courses.map((pc: any) => ({
            courseId: pc.courseId,
            status: pc.status,
            code: pc.course?.code,
            name: pc.course?.name,
            credits: pc.course?.credits,
            difficultyLevel: pc.course?.difficultyLevel,
            workloadHours: pc.course?.workloadHours,
          })),
        })),
        generatedAt: new Date().toISOString(),
      };
    }),
  }),

  // ─── Chat Assistant ──────────────────────────────────────────────────────────
  chat: router({
    getHistory: protectedProcedure.input(z.object({
      planId: z.number().optional(),
    })).query(async ({ ctx, input }) => {
      return db.getChatMessagesByUser(ctx.user.id, input.planId);
    }),

    sendMessage: protectedProcedure.input(z.object({
      message: z.string().min(1).max(2000),
      planId: z.number().optional(),
      agentMode: z.enum(ACADEMIC_AGENT_MODES).optional().default("auto"),
    })).mutation(async ({ ctx, input }) => {
      // Save user message
      await db.createChatMessage({ userId: ctx.user.id, planId: input.planId, role: 'user', content: input.message });

      // Build context
      let planContext = '';
      if (input.planId) {
        const plan = await db.getDegreePlanById(input.planId);
        if (plan) {
          const semesters = await db.getPlanSemesters(input.planId);
          const semestersWithCourses = await Promise.all(
            semesters
              .sort((a, b) => a.semesterIndex - b.semesterIndex)
              .map(async sem => {
                const plannedCourses = await db.getPlanCoursesBySemester(sem.id);
                const courses = await db.getCoursesByIds(plannedCourses.map(pc => pc.courseId));
                const courseMap = new Map(courses.map(course => [course.id, course]));
                return {
                  ...sem,
                  courses: plannedCourses
                    .map(pc => courseMap.get(pc.courseId))
                    .filter(Boolean)
                    .map(course => `${course!.code} (${course!.credits} cr)`)
                    .join(', '),
                };
              })
          );

          planContext = `\n\nStudent's current degree plan (${plan.name}, ${plan.variantType}):\n`;
          planContext += `- Total credits: ${plan.totalCredits}, Total semesters: ${plan.totalSemesters}\n`;
          planContext += `- Estimated graduation: ${plan.estimatedGraduationSemester} ${plan.estimatedGraduationYear}\n`;
          planContext += `- Scores: ${plan.scoresJson}\n`;
          planContext += `- Semesters:\n`;
          for (const sem of semestersWithCourses) {
            planContext += `  - ${sem.term} ${sem.year}: ${sem.courses || 'No courses listed'}\n`;
          }
        }
      }

      const profile = await db.getStudentProfileByUserId(ctx.user.id);
      let profileContext = '';
      let schoolName: string | null = null;
      let majorName: string | null = null;
      if (profile) {
        const school = profile.schoolId ? (await db.getAllSchools()).find(s => s.id === profile.schoolId) : null;
        const major = profile.primaryMajorId ? await db.getProgramById(profile.primaryMajorId) : null;
        const secondaryMajor = profile.secondaryMajorId ? await db.getProgramById(profile.secondaryMajorId) : null;
        const careerTrack = profile.careerTrackId ? await db.getCareerTrackById(profile.careerTrackId) : null;
        const preferences = parseJson(profile.preferencesJson, {});
        schoolName = school?.name ?? null;
        majorName = major?.name ?? null;
        profileContext = `\nStudent profile:
- School: ${school?.name ?? 'Unknown school'}
- Primary major: ${major?.name ?? 'Unknown major'}
- Secondary major: ${secondaryMajor?.name ?? 'None'}
- Career track: ${careerTrack?.name ?? 'None selected'}
- Start: ${profile.startSemester ?? 'unknown'} ${profile.startYear ?? 'unknown'}
- Target graduation: ${profile.targetGraduationSemester ?? 'unknown'} ${profile.targetGraduationYear ?? 'unknown'}
- Preferences: ${JSON.stringify(preferences)}`;
      }

      const history = await db.getChatMessagesByUser(ctx.user.id, input.planId);
      const recentHistory = history.slice(-11, -1);
      const resolvedAgent = resolveAcademicAgent(input.agentMode, input.message);
      let researchContext = '';

      if (resolvedAgent === "university_researcher") {
        const research = await retrieveUniversityResearch({
          message: input.message,
          schoolName,
          majorName,
        });
        researchContext = formatResearchContext(research);
      }

      let assistantMessage: string;

      try {
        const response = await invokeLLM({
          messages: [
            buildAcademicAgentSystemMessage({
              agent: resolvedAgent,
              profileContext,
              planContext,
              researchContext,
            }),
            ...recentHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content as string })),
            { role: 'user', content: input.message },
          ],
        });

        const rawContent = response.choices[0]?.message?.content;
        assistantMessage = (typeof rawContent === 'string' ? rawContent : null) ?? 'I apologize, I could not generate a response.';
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "unknown error";
        console.warn("[Chat Assistant] Falling back after LLM failure:", errorMessage);
        assistantMessage = buildAcademicAgentFallbackResponse({
          agent: resolvedAgent,
          message: input.message,
          profileContext,
          planContext,
          researchContext,
          errorMessage,
        });
      }

      await db.createChatMessage({ userId: ctx.user.id, planId: input.planId, role: 'assistant', content: assistantMessage });

      return { message: assistantMessage, agent: resolvedAgent, agentLabel: getAgentLabel(resolvedAgent) };
    }),
  }),

  // ─── Scenarios ───────────────────────────────────────────────────────────────
  scenarios: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return db.getScenariosByUser(ctx.user.id);
    }),
  }),
});

export type AppRouter = typeof appRouter;
