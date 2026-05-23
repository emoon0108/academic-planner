/**
 * Dynamic Replanning Engine
 *
 * Recomputes an updated optimal schedule when conditions change:
 * - A course is dropped or failed
 * - A new course becomes unavailable
 * - Student adds a second major or minor
 * - Graduation target changes
 *
 * Minimizes disruption to the existing plan by preserving already-completed
 * semesters and only replanning from the current semester forward.
 */

import { CourseGraph } from './graph';
import { generatePlan, ScheduleConstraints, SemesterPlan, GeneratedPlan, VariantType } from './optimizer';

export interface ReplanningTrigger {
  type: 'drop_course' | 'fail_course' | 'course_unavailable' | 'add_major' | 'change_graduation' | 'add_minor' | 'custom';
  courseId?: number;
  additionalCourseIds?: number[];
  newTargetSemesters?: number;
  description: string;
}

export interface ReplanningResult {
  updatedPlan: GeneratedPlan;
  disruptionScore: number;  // 0-10, lower = less disruption
  changedSemesters: number[];
  addedCourses: number[];
  removedCourses: number[];
  impactSummary: string;
}

/**
 * Replan from a given semester index forward, preserving completed semesters.
 */
export function replan(
  graph: CourseGraph,
  existingPlan: GeneratedPlan,
  trigger: ReplanningTrigger,
  requiredCourseIds: number[],
  constraints: ScheduleConstraints,
  currentSemesterIndex: number
): ReplanningResult {
  // Collect all completed courses (from semesters before current)
  const completedCourseIds = new Set<number>(constraints.completedCourseIds);
  const preservedSemesters: SemesterPlan[] = [];

  for (const sem of existingPlan.semesters) {
    if (sem.semesterIndex < currentSemesterIndex) {
      preservedSemesters.push(sem);
      for (const id of Array.from(sem.courseIds)) completedCourseIds.add(id);
    }
  }

  // Handle trigger-specific modifications
  let updatedRequired = [...requiredCourseIds];
  let updatedConstraints = { ...constraints, completedCourseIds: Array.from(completedCourseIds) };

  if (trigger.type === 'drop_course' || trigger.type === 'fail_course') {
    if (trigger.courseId) {
      // Remove from completed if it was previously completed
      completedCourseIds.delete(trigger.courseId);
      updatedConstraints.completedCourseIds = Array.from(completedCourseIds);
    }
  }

  if (trigger.type === 'add_major' || trigger.type === 'add_minor') {
    if (trigger.additionalCourseIds) {
      updatedRequired = Array.from(new Set([...updatedRequired, ...trigger.additionalCourseIds]));
    }
  }

  if (trigger.type === 'change_graduation') {
    if (trigger.newTargetSemesters) {
      updatedConstraints = { ...updatedConstraints };
    }
  }

  // Determine start of replanning
  const lastPreserved = preservedSemesters[preservedSemesters.length - 1];
  let replanYear = constraints.startYear;
  let replanTerm: 'fall' | 'spring' | 'summer' = constraints.startSemester;

  if (lastPreserved) {
    const { year, term } = lastPreserved;
    if (term === 'fall') { replanYear = year; replanTerm = 'spring'; }
    else if (term === 'spring') { replanYear = year + 1; replanTerm = 'fall'; }
    else { replanYear = year + 1; replanTerm = 'fall'; }
  }

  // Generate new plan from current semester forward
  const newConstraints: ScheduleConstraints = {
    ...updatedConstraints,
    startYear: replanYear,
    startSemester: replanTerm,
  };

  const newForwardPlan = generatePlan(
    graph,
    updatedRequired,
    newConstraints,
    existingPlan.variantType
  );

  // Re-index forward semesters
  const reindexedForward = newForwardPlan.semesters.map((sem, i) => ({
    ...sem,
    semesterIndex: preservedSemesters.length + i,
  }));

  const allSemesters = [...preservedSemesters, ...reindexedForward];

  // Compute disruption score
  const originalForward = existingPlan.semesters.filter(s => s.semesterIndex >= currentSemesterIndex);
  const disruptionScore = computeDisruptionScore(originalForward, reindexedForward);

  // Compute diff
  const originalCourseSet = new Set(originalForward.flatMap(s => s.courseIds));
  const newCourseSet = new Set(reindexedForward.flatMap(s => s.courseIds));
  const addedCourses = Array.from(newCourseSet.values()).filter(id => !originalCourseSet.has(id));
  const removedCourses = Array.from(originalCourseSet.values()).filter(id => !newCourseSet.has(id));
  const changedSemesters = reindexedForward
    .filter((sem, i) => {
      const orig = originalForward[i];
      if (!orig) return true;
      return JSON.stringify(sem.courseIds.sort()) !== JSON.stringify(orig.courseIds.sort());
    })
    .map(s => s.semesterIndex);

  const lastSem = allSemesters[allSemesters.length - 1];
  const gradYear = lastSem?.year ?? replanYear;
  const gradTerm = (lastSem?.term === 'summer' ? 'fall' : lastSem?.term ?? 'spring') as 'fall' | 'spring';

  const updatedPlan: GeneratedPlan = {
    ...newForwardPlan,
    semesters: allSemesters,
    totalCredits: allSemesters.reduce((s, sem) => s + sem.totalCredits, 0),
    totalSemesters: allSemesters.length,
    estimatedGraduationYear: gradYear,
    estimatedGraduationSemester: gradTerm,
  };

  const impactSummary = generateImpactSummary(trigger, disruptionScore, changedSemesters, addedCourses, removedCourses, graph);

  return {
    updatedPlan,
    disruptionScore,
    changedSemesters,
    addedCourses,
    removedCourses,
    impactSummary,
  };
}

function computeDisruptionScore(
  original: SemesterPlan[],
  updated: SemesterPlan[]
): number {
  if (original.length === 0) return 0;

  let changedCount = 0;
  const maxLen = Math.max(original.length, updated.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = original[i];
    const upd = updated[i];
    if (!orig || !upd) { changedCount++; continue; }
    const origSet = new Set(orig.courseIds);
    const updSet = new Set(upd.courseIds);
    const intersection = upd.courseIds.filter(id => origSet.has(id)).length;
    const union = new Set([...orig.courseIds, ...upd.courseIds]).size;
    if (union > 0 && intersection / union < 0.7) changedCount++;
  }

  return Math.min(10, (changedCount / maxLen) * 10);
}

function generateImpactSummary(
  trigger: ReplanningTrigger,
  disruptionScore: number,
  changedSemesters: number[],
  addedCourses: number[],
  removedCourses: number[],
  graph: CourseGraph
): string {
  const disruption = disruptionScore < 3 ? 'minimal' : disruptionScore < 6 ? 'moderate' : 'significant';
  const parts: string[] = [];

  parts.push(`Replanning triggered by: ${trigger.description}.`);
  parts.push(`Disruption level: ${disruption} (score: ${disruptionScore.toFixed(1)}/10).`);

  if (changedSemesters.length > 0) {
    parts.push(`${changedSemesters.length} semester(s) were modified.`);
  }

  if (addedCourses.length > 0) {
    const names = addedCourses.slice(0, 3).map(id => graph.nodes.get(id)?.code ?? `Course ${id}`);
    parts.push(`Added: ${names.join(', ')}${addedCourses.length > 3 ? ` and ${addedCourses.length - 3} more` : ''}.`);
  }

  if (removedCourses.length > 0) {
    const names = removedCourses.slice(0, 3).map(id => graph.nodes.get(id)?.code ?? `Course ${id}`);
    parts.push(`Removed: ${names.join(', ')}${removedCourses.length > 3 ? ` and ${removedCourses.length - 3} more` : ''}.`);
  }

  return parts.join(' ');
}

/**
 * Scenario Simulation Engine
 * Runs "what-if" analysis without modifying the actual plan.
 */
export interface ScenarioParams {
  type: 'drop_course' | 'add_major' | 'change_graduation' | 'fail_course' | 'add_minor' | 'custom';
  courseId?: number;
  additionalCourseIds?: number[];
  newTargetSemesters?: number;
  description?: string;
}

export function simulateScenario(
  graph: CourseGraph,
  currentPlan: GeneratedPlan,
  scenario: ScenarioParams,
  requiredCourseIds: number[],
  constraints: ScheduleConstraints,
  currentSemesterIndex: number
): ReplanningResult {
  const trigger: ReplanningTrigger = {
    type: scenario.type as ReplanningTrigger['type'],
    courseId: scenario.courseId,
    additionalCourseIds: scenario.additionalCourseIds,
    newTargetSemesters: scenario.newTargetSemesters,
    description: scenario.description ?? `Scenario: ${scenario.type}`,
  };

  return replan(graph, currentPlan, trigger, requiredCourseIds, constraints, currentSemesterIndex);
}
