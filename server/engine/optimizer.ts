/**
 * Constraint-Based Scheduling Optimizer
 *
 * Generates semester-by-semester degree plans satisfying:
 * Hard constraints: prerequisites, credit limits, course availability
 * Soft constraints: workload balance, difficulty spread, career timing
 *
 * Produces three plan variants:
 * - fastest_path: minimize total semesters
 * - lowest_stress_path: minimize per-semester difficulty/workload peaks
 * - most_flexible_path: maximize scheduling flexibility and elective options
 */

import { CourseGraph, CourseNode, topologicalSort, prerequisitesSatisfied } from './graph';

export type VariantType = 'fastest_path' | 'lowest_stress_path' | 'most_flexible_path';

export interface ScheduleConstraints {
  maxCreditsPerSemester: number;
  minCreditsPerSemester: number;
  startYear: number;
  startSemester: 'fall' | 'spring';
  targetSemesters?: number;
  targetTotalCredits?: number;
  maxSemesters?: number;
  avoidSummerClasses: boolean;
  completedCourseIds: number[];
  internshipSemester?: string | null;  // e.g. "fall-2026"
  careerTrackCourseIds?: number[];
}

export interface SemesterPlan {
  semesterIndex: number;
  year: number;
  term: 'fall' | 'spring' | 'summer';
  courseIds: number[];
  totalCredits: number;
  workloadScore: number;
  difficultyScore: number;
}

export function isPlaceholderCourseId(courseId: number) {
  return courseId < 0;
}

export interface GeneratedPlan {
  variantType: VariantType;
  semesters: SemesterPlan[];
  totalCredits: number;
  totalSemesters: number;
  estimatedGraduationYear: number;
  estimatedGraduationSemester: 'fall' | 'spring';
  scores: {
    workload: number;
    difficulty: number;
    flexibility: number;
    careerReadiness: number;
    overall: number;
  };
  courseLookup?: Map<number, CourseNode>;
}

function getSemesterLabel(year: number, term: 'fall' | 'spring' | 'summer'): string {
  return `${term}-${year}`;
}

function nextSemester(
  year: number,
  term: 'fall' | 'spring' | 'summer',
  avoidSummer: boolean
): { year: number; term: 'fall' | 'spring' | 'summer' } {
  if (term === 'fall') return { year, term: 'spring' };
  if (term === 'spring') {
    if (!avoidSummer) return { year, term: 'summer' };
    return { year: year + 1, term: 'fall' };
  }
  // summer
  return { year: year + 1, term: 'fall' };
}

function isCourseAvailable(course: CourseNode, term: 'fall' | 'spring' | 'summer'): boolean {
  if (term === 'fall') return course.availableFall;
  if (term === 'spring') return course.availableSpring;
  return course.availableSummer;
}

function computeWorkloadScore(courses: CourseNode[]): number {
  if (courses.length === 0) return 0;
  const totalHours = courses.reduce((s, c) => s + c.workloadHours, 0);
  // Normalize visible workload pressure. About 65 hours/week is an extreme
  // semester, so a full 16-18 credit technical term reads high without every
  // packed schedule flattening to 10/10.
  return Math.round(Math.min(10, (totalHours / 65) * 10) * 10) / 10;
}

function computeDifficultyScore(courses: CourseNode[]): number {
  if (courses.length === 0) return 0;
  const avg = courses.reduce((s, c) => s + c.difficultyLevel, 0) / courses.length;
  return avg * 2; // scale to 0-10
}

function makeCreditPlaceholder(id: number, credits: number): CourseNode {
  return {
    id,
    code: `ELECTIVE ${Math.abs(id)}`,
    name: "General Education / Free Elective",
    credits,
    difficultyLevel: 2,
    workloadHours: credits * 2,
    availableFall: true,
    availableSpring: true,
    availableSummer: true,
    isUpperDivision: false,
    tags: ["general-education", "free-elective"],
    careerTracks: [],
  };
}

/**
 * Core greedy scheduler with variant-specific heuristics.
 */
export function generatePlan(
  graph: CourseGraph,
  requiredCourseIds: number[],
  constraints: ScheduleConstraints,
  variant: VariantType
): GeneratedPlan {
  const completed = new Set<number>(constraints.completedCourseIds);
  const remaining = new Set<number>(
    requiredCourseIds.filter(id => !completed.has(id))
  );

  const semesters: SemesterPlan[] = [];
  let { year, term } = { year: constraints.startYear, term: constraints.startSemester as 'fall' | 'spring' | 'summer' };
  let semesterIndex = 0;
  const maxIterations = constraints.maxSemesters ?? 10;
  const targetTotalCredits = constraints.targetTotalCredits ?? 0;
  let plannedCredits = 0;
  let placeholderId = -1;

  while ((remaining.size > 0 || plannedCredits < targetTotalCredits) && semesterIndex < maxIterations) {
    // Skip this semester if it's the internship semester
    const semLabel = getSemesterLabel(year, term);
    if (constraints.internshipSemester && semLabel === constraints.internshipSemester) {
      const next = nextSemester(year, term, constraints.avoidSummerClasses);
      year = next.year;
      term = next.term;
      semesterIndex++;
      continue;
    }

    // Find all courses whose prerequisites are satisfied
    const eligible = Array.from(remaining).filter(id => {
      const course = graph.nodes.get(id);
      if (!course) return false;
      if (!isCourseAvailable(course, term)) return false;
      return prerequisitesSatisfied(graph, id, completed);
    });

    if (eligible.length === 0 && remaining.size > 0) {
      // No eligible courses this semester — advance
      const next = nextSemester(year, term, constraints.avoidSummerClasses);
      year = next.year;
      term = next.term;
      semesterIndex++;
      continue;
    }

    // Sort eligible courses based on variant strategy
    const sorted = sortCoursesByVariant(eligible, graph, variant, constraints, completed, remaining);

    // Greedily pick courses up to credit limit
    const selected: number[] = [];
    let credits = 0;

    for (const id of sorted) {
      const course = graph.nodes.get(id)!;
      if (credits + course.credits > constraints.maxCreditsPerSemester) continue;
      selected.push(id);
      credits += course.credits;
      if (variant === 'lowest_stress_path' && credits >= 15) break; // cap at 15 for low stress
    }

    // Ensure minimum credits if possible
    if (credits < constraints.minCreditsPerSemester && selected.length < eligible.length) {
      // Try to add more courses
      for (const id of sorted) {
        if (selected.includes(id)) continue;
        const course = graph.nodes.get(id)!;
        if (credits + course.credits <= constraints.maxCreditsPerSemester) {
          selected.push(id);
          credits += course.credits;
        }
      }
    }

    const remainingTargetCredits = Math.max(0, targetTotalCredits - plannedCredits - credits);
    if (remainingTargetCredits > 0 && credits < constraints.maxCreditsPerSemester) {
      const openCredits = constraints.maxCreditsPerSemester - credits;
      const preferredFloor = selected.length === 0 ? constraints.minCreditsPerSemester : 0;
      const fillerCredits = Math.min(openCredits, Math.max(preferredFloor, remainingTargetCredits));
      if (fillerCredits > 0) {
        selected.push(placeholderId);
        credits += fillerCredits;
        graph.nodes.set(placeholderId, makeCreditPlaceholder(placeholderId, fillerCredits));
        graph.successors.set(placeholderId, new Set());
        graph.predecessors.set(placeholderId, new Set());
        placeholderId--;
      }
    }

    if (selected.length === 0) {
      const next = nextSemester(year, term, constraints.avoidSummerClasses);
      year = next.year;
      term = next.term;
      semesterIndex++;
      continue;
    }

    const selectedCourses = selected.map(id => graph.nodes.get(id)!);

    semesters.push({
      semesterIndex,
      year,
      term,
      courseIds: selected,
      totalCredits: credits,
      workloadScore: computeWorkloadScore(selectedCourses),
      difficultyScore: computeDifficultyScore(selectedCourses),
    });

    for (const id of selected) {
      completed.add(id);
      remaining.delete(id);
    }
    plannedCredits += credits;

    const next = nextSemester(year, term, constraints.avoidSummerClasses);
    year = next.year;
    term = next.term;
    semesterIndex++;
  }

  // Compute plan scores
  const scores = computePlanScores(semesters, graph, constraints.careerTrackCourseIds ?? []);

  const lastSemester = semesters[semesters.length - 1];
  const gradYear = lastSemester?.year ?? year;
  const gradTerm = lastSemester?.term === 'summer' ? 'fall' : (lastSemester?.term ?? 'spring') as 'fall' | 'spring';

  const generatedPlan: GeneratedPlan = {
    variantType: variant,
    semesters,
    totalCredits: semesters.reduce((s, sem) => s + sem.totalCredits, 0),
    totalSemesters: semesters.length,
    estimatedGraduationYear: gradYear,
    estimatedGraduationSemester: gradTerm,
    scores,
  };

  Object.defineProperty(generatedPlan, "courseLookup", {
    value: new Map(graph.nodes),
    enumerable: false,
  });

  return generatedPlan;
}

function sortCoursesByVariant(
  eligible: number[],
  graph: CourseGraph,
  variant: VariantType,
  constraints: ScheduleConstraints,
  completed: Set<number>,
  remaining: Set<number>
): number[] {
  return eligible.sort((a, b) => {
    const ca = graph.nodes.get(a)!;
    const cb = graph.nodes.get(b)!;
    const careerIds = new Set(constraints.careerTrackCourseIds ?? []);
    const careerA = careerIds.has(a) ? 1 : 0;
    const careerB = careerIds.has(b) ? 1 : 0;

    if (careerA !== careerB) return careerB - careerA;

    if (variant === 'fastest_path') {
      // Prioritize: courses that unlock the most other courses, then by difficulty desc
      const unlockA = countUnlocked(a, graph, remaining);
      const unlockB = countUnlocked(b, graph, remaining);
      if (unlockB !== unlockA) return unlockB - unlockA;
      return cb.difficultyLevel - ca.difficultyLevel; // harder first to unblock
    }

    if (variant === 'lowest_stress_path') {
      // Prioritize: lower difficulty, lower workload
      if (ca.difficultyLevel !== cb.difficultyLevel) return ca.difficultyLevel - cb.difficultyLevel;
      return ca.workloadHours - cb.workloadHours;
    }

    if (variant === 'most_flexible_path') {
      // Prioritize: courses that unlock the most options, then easier ones
      const unlockA = countUnlocked(a, graph, remaining);
      const unlockB = countUnlocked(b, graph, remaining);
      if (unlockB !== unlockA) return unlockB - unlockA;
      return ca.difficultyLevel - cb.difficultyLevel;
    }

    return 0;
  });
}

function countUnlocked(courseId: number, graph: CourseGraph, remaining: Set<number>): number {
  const successors = graph.successors.get(courseId) ?? new Set<number>();
  return Array.from(successors).filter(id => remaining.has(id)).length;
}

function computePlanScores(
  semesters: SemesterPlan[],
  graph: CourseGraph,
  careerTrackCourseIds: number[]
): GeneratedPlan['scores'] {
  if (semesters.length === 0) {
    return { workload: 10, difficulty: 10, flexibility: 10, careerReadiness: 0, overall: 7 };
  }

  // Workload score: inverse of workload variance (lower variance = higher score)
  const workloads = semesters.map(s => s.workloadScore);
  const avgWorkload = workloads.reduce((a, b) => a + b, 0) / workloads.length;
  const workloadVariance = workloads.reduce((s, w) => s + Math.pow(w - avgWorkload, 2), 0) / workloads.length;
  const workloadScore = Math.max(0, 10 - workloadVariance);

  // Difficulty score: inverse of difficulty variance
  const difficulties = semesters.map(s => s.difficultyScore);
  const avgDiff = difficulties.reduce((a, b) => a + b, 0) / difficulties.length;
  const diffVariance = difficulties.reduce((s, d) => s + Math.pow(d - avgDiff, 2), 0) / difficulties.length;
  const difficultyScore = Math.max(0, 10 - diffVariance);

  // Flexibility score: based on average courses per semester (fewer = more flexible)
  const avgCourses = semesters.reduce((s, sem) => s + sem.courseIds.length, 0) / semesters.length;
  const flexibilityScore = Math.min(10, Math.max(0, 10 - (avgCourses - 3) * 1.5));

  // Career readiness: fraction of career track courses included
  const allCourseIds = new Set(semesters.flatMap(s => s.courseIds));
  const careerScore = careerTrackCourseIds.length > 0
    ? (careerTrackCourseIds.filter(id => allCourseIds.has(id)).length / careerTrackCourseIds.length) * 10
    : 5;

  const overall = (workloadScore + difficultyScore + flexibilityScore + careerScore) / 4;

  return {
    workload: Math.round(workloadScore * 10) / 10,
    difficulty: Math.round(difficultyScore * 10) / 10,
    flexibility: Math.round(flexibilityScore * 10) / 10,
    careerReadiness: Math.round(careerScore * 10) / 10,
    overall: Math.round(overall * 10) / 10,
  };
}

/**
 * Generate all three plan variants.
 */
export function generateAllVariants(
  graph: CourseGraph,
  requiredCourseIds: number[],
  constraints: ScheduleConstraints
): GeneratedPlan[] {
  const variants: VariantType[] = ['fastest_path', 'lowest_stress_path', 'most_flexible_path'];
  return variants.map(v => generatePlan(graph, requiredCourseIds, constraints, v));
}
