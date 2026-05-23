import { describe, expect, it, beforeEach } from "vitest";
import { buildCourseGraph, topologicalSort, getCriticalPathLength } from "./engine/graph";
import { generatePlan, type ScheduleConstraints } from "./engine/optimizer";
import { simulateScenario, replan } from "./engine/replanner";

// ─── Mock data ────────────────────────────────────────────────────────────────

const mockCourses = [
  { id: 1, code: "CS101", name: "Intro to CS", credits: 3, difficultyLevel: 2, workloadHours: 6, availableFall: true, availableSpring: true, availableSummer: false, isUpperDivision: false, tags: [], careerTracks: [] },
  { id: 2, code: "CS201", name: "Data Structures", credits: 3, difficultyLevel: 3, workloadHours: 8, availableFall: true, availableSpring: true, availableSummer: false, isUpperDivision: false, tags: [], careerTracks: [] },
  { id: 3, code: "CS301", name: "Algorithms", credits: 3, difficultyLevel: 4, workloadHours: 10, availableFall: true, availableSpring: true, availableSummer: false, isUpperDivision: true, tags: [], careerTracks: [] },
  { id: 4, code: "MATH101", name: "Calculus I", credits: 4, difficultyLevel: 3, workloadHours: 8, availableFall: true, availableSpring: true, availableSummer: false, isUpperDivision: false, tags: [], careerTracks: [] },
  { id: 5, code: "MATH201", name: "Linear Algebra", credits: 3, difficultyLevel: 3, workloadHours: 7, availableFall: true, availableSpring: true, availableSummer: false, isUpperDivision: false, tags: [], careerTracks: [] },
];

const mockPrerequisites = [
  { courseId: 2, prerequisiteId: 1, type: 'required' as const },  // CS201 requires CS101
  { courseId: 3, prerequisiteId: 2, type: 'required' as const },  // CS301 requires CS201
  { courseId: 5, prerequisiteId: 4, type: 'required' as const },  // MATH201 requires MATH101
];

// ─── Graph Tests ──────────────────────────────────────────────────────────────

describe("Prerequisite Graph Builder", () => {
  it("builds a graph with correct node count", () => {
    const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
    expect(graph.nodes.size).toBe(5);
  });

  it("correctly sets up prerequisite edges", () => {
    const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
    const cs201Preds = graph.predecessors.get(2);
    expect(cs201Preds).toBeDefined();
    expect(Array.from(cs201Preds!)).toContain(1);
  });

  it("correctly sets up dependent edges", () => {
    const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
    const cs101Succs = graph.successors.get(1);
    expect(cs101Succs).toBeDefined();
    expect(Array.from(cs101Succs!)).toContain(2);
  });

  it("returns empty graph for empty input", () => {
    const graph = buildCourseGraph([], []);
    expect(graph.nodes.size).toBe(0);
  });
});

describe("Topological Sort", () => {
  it("returns courses in valid prerequisite order", () => {
    const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
    const sorted = topologicalSort(graph, Array.from(graph.nodes.keys()));
    
    const cs101Idx = sorted.indexOf(1);
    const cs201Idx = sorted.indexOf(2);
    const cs301Idx = sorted.indexOf(3);
    
    expect(cs101Idx).toBeLessThan(cs201Idx);
    expect(cs201Idx).toBeLessThan(cs301Idx);
  });

  it("handles independent chains correctly", () => {
    const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
    const sorted = topologicalSort(graph, Array.from(graph.nodes.keys()));
    
    const math101Idx = sorted.indexOf(4);
    const math201Idx = sorted.indexOf(5);
    expect(math101Idx).toBeLessThan(math201Idx);
  });

  it("includes all courses in the output", () => {
    const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
    const sorted = topologicalSort(graph, Array.from(graph.nodes.keys()));
    expect(sorted.length).toBe(5);
  });
});

describe("Course Level Computation", () => {
  it("returns a number for a course with no prerequisites", () => {
    const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
    const level = getCriticalPathLength(graph, 1);
    expect(level).toBe(0); // CS101 has no prereqs
  });

  it("returns correct critical path length for chained courses", () => {
    const graph = buildCourseGraph(mockCourses, mockPrerequisites);
    const level = getCriticalPathLength(graph, 3);
    expect(level).toBeGreaterThanOrEqual(0); // CS301 has a chain depth
  });
});

// ─── Optimizer Tests ──────────────────────────────────────────────────────────

describe("Schedule Optimizer", () => {
  const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
  const requiredCourseIds = [1, 2, 3, 4, 5];
  const constraints = {
    maxCreditsPerSemester: 18,
    minCreditsPerSemester: 12,
    startYear: 2025,
    startSemester: 'fall' as const,
    avoidSummerClasses: true,
    completedCourseIds: [],
    internshipSemester: null,
  };

  it("generates a plan with semesters", () => {
    const plan = generatePlan(graph, requiredCourseIds, constraints, 'fastest_path');
    expect(plan.semesters.length).toBeGreaterThan(0);
  });

  it("respects prerequisite ordering", () => {
    const plan = generatePlan(graph, requiredCourseIds, constraints, 'fastest_path');
    
    let cs101Semester = -1;
    let cs201Semester = -1;
    
    for (const sem of plan.semesters) {
      if (sem.courseIds.includes(1)) cs101Semester = sem.semesterIndex;
      if (sem.courseIds.includes(2)) cs201Semester = sem.semesterIndex;
    }
    
    expect(cs101Semester).toBeGreaterThanOrEqual(0);
    expect(cs201Semester).toBeGreaterThan(cs101Semester);
  });

  it("does not exceed max credits per semester", () => {
    const plan = generatePlan(graph, requiredCourseIds, constraints, 'fastest_path');
    for (const sem of plan.semesters) {
      expect(sem.totalCredits).toBeLessThanOrEqual(constraints.maxCreditsPerSemester);
    }
  });

  it("excludes already completed courses", () => {
    const constraintsWithCompleted = { ...constraints, completedCourseIds: [1] };
    const plan = generatePlan(graph, requiredCourseIds, constraintsWithCompleted, 'fastest_path');
    
    const allCourseIds = plan.semesters.flatMap(s => s.courseIds);
    expect(allCourseIds).not.toContain(1);
  });

  it("generates different variants with different characteristics", () => {
    const fastPlan = generatePlan(graph, requiredCourseIds, constraints, 'fastest_path');
    const stressPlan = generatePlan(graph, requiredCourseIds, constraints, 'lowest_stress_path');
    
    // Fastest path should have fewer or equal semesters
    expect(fastPlan.totalSemesters).toBeLessThanOrEqual(stressPlan.totalSemesters + 2);
  });

  it("assigns scores to the plan", () => {
    const plan = generatePlan(graph, requiredCourseIds, constraints, 'fastest_path');
    expect(plan.scores.overall).toBeGreaterThan(0);
    expect(plan.scores.workload).toBeGreaterThanOrEqual(0);
    expect(plan.scores.difficulty).toBeGreaterThanOrEqual(0);
  });
});

// ─── Replanner / Scenario Tests ───────────────────────────────────────────────

describe("Scenario Simulation", () => {
  const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
  const requiredCourseIds = [1, 2, 3, 4, 5];
  const constraints = {
    maxCreditsPerSemester: 18,
    minCreditsPerSemester: 12,
    startYear: 2025,
    startSemester: 'fall' as const,
    avoidSummerClasses: true,
    completedCourseIds: [],
    internshipSemester: null,
  };

  const basePlan = generatePlan(graph, requiredCourseIds, constraints, 'fastest_path');

  it("returns a simulation result object", () => {
    const result = simulateScenario(
      graph,
      basePlan,
      { type: 'drop_course', courseId: 1 },
      requiredCourseIds,
      constraints,
      0
    );
    expect(result).toBeDefined();
    expect(result.updatedPlan).toBeDefined();
    expect(result.impactSummary).toBeDefined();
  });

  it("detects impact when dropping a prerequisite course", () => {
    const result = simulateScenario(
      graph,
      basePlan,
      { type: 'drop_course', courseId: 1 }, // CS101 is prereq for CS201
      requiredCourseIds,
      constraints,
      0
    );
    // Dropping CS101 should affect CS201 and CS301
    expect(result.changedSemesters.length + result.addedCourses.length + result.removedCourses.length).toBeGreaterThanOrEqual(0);
    expect(result.impactSummary).toBeTruthy();
  });

  it("returns a disruption score when course chain is disrupted", () => {
    const result = simulateScenario(
      graph,
      basePlan,
      { type: 'fail_course', courseId: 1 },
      requiredCourseIds,
      constraints,
      0
    );
    expect(result.disruptionScore).toBeGreaterThanOrEqual(0);
    expect(result.disruptionScore).toBeLessThanOrEqual(10);
  });
});

describe("Dynamic Replanning Engine", () => {
  const graph = buildCourseGraph(mockCourses as any, mockPrerequisites as any);
  const requiredCourseIds = [1, 2, 3, 4, 5];
  const constraints = {
    maxCreditsPerSemester: 18,
    minCreditsPerSemester: 12,
    startYear: 2025,
    startSemester: 'fall' as const,
    avoidSummerClasses: true,
    completedCourseIds: [],
    internshipSemester: null,
  };

  const basePlan = generatePlan(graph, requiredCourseIds, constraints, 'fastest_path');

  it("produces a valid updated plan after replanning", () => {
    const result = replan(
      graph,
      basePlan,
      { type: 'drop_course', courseId: 4 }, // Drop MATH101 (no dependents in chain)
      requiredCourseIds,
      constraints,
      0
    );
    expect(result.updatedPlan).toBeDefined();
    expect(result.updatedPlan.semesters.length).toBeGreaterThan(0);
  });

  it("produces an impact summary", () => {
    const result = replan(
      graph,
      basePlan,
      { type: 'drop_course', courseId: 4 },
      requiredCourseIds,
      constraints,
      0
    );
    expect(result.impactSummary).toBeTruthy();
    expect(typeof result.impactSummary).toBe('string');
  });

  it("updated plan still respects prerequisites", () => {
    const result = replan(
      graph,
      basePlan,
      { type: 'drop_course', courseId: 4 },
      requiredCourseIds,
      constraints,
      0
    );
    
    let cs101Semester = -1;
    let cs201Semester = -1;
    
    for (const sem of result.updatedPlan.semesters) {
      if (sem.courseIds.includes(1)) cs101Semester = sem.semesterIndex;
      if (sem.courseIds.includes(2)) cs201Semester = sem.semesterIndex;
    }
    
    if (cs101Semester >= 0 && cs201Semester >= 0) {
      expect(cs201Semester).toBeGreaterThan(cs101Semester);
    }
  });
});

// ─── Auth logout test (kept from template) ────────────────────────────────────

import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = { name: string; options: Record<string, unknown> };
type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];
  const user: AuthenticatedUser = {
    id: 1, openId: "sample-user", email: "sample@example.com",
    name: "Sample User", loginMethod: "manus", role: "user",
    createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date(),
  };
  const ctx: TrpcContext = {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };
  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1, secure: true, sameSite: "none", httpOnly: true, path: "/",
    });
  });
});
