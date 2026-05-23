/**
 * Prerequisite Dependency Graph Builder
 * Constructs a directed acyclic graph (DAG) of course prerequisites
 * and provides topological ordering for scheduling.
 */

export interface CourseNode {
  id: number;
  code: string;
  name: string;
  credits: number;
  difficultyLevel: number;
  workloadHours: number;
  availableFall: boolean;
  availableSpring: boolean;
  availableSummer: boolean;
  isUpperDivision: boolean;
  tags: string[];
  careerTracks: string[];
}

export interface PrerequisiteEdge {
  courseId: number;
  prerequisiteCourseId: number;
  prerequisiteId?: number;
  type: 'required' | 'corequisite' | 'recommended';
}

export interface CourseGraph {
  nodes: Map<number, CourseNode>;
  // adjacency: courseId -> set of courses that depend on it (successors)
  successors: Map<number, Set<number>>;
  // adjacency: courseId -> set of prerequisites (predecessors)
  predecessors: Map<number, Set<number>>;
  edges: PrerequisiteEdge[];
}

export function buildCourseGraph(
  courses: CourseNode[],
  prerequisites: PrerequisiteEdge[]
): CourseGraph {
  const nodes = new Map<number, CourseNode>();
  const successors = new Map<number, Set<number>>();
  const predecessors = new Map<number, Set<number>>();

  for (const course of courses) {
    nodes.set(course.id, course);
    successors.set(course.id, new Set());
    predecessors.set(course.id, new Set());
  }

  const normalizedEdges: PrerequisiteEdge[] = [];

  for (const edge of prerequisites) {
    const prerequisiteCourseId = edge.prerequisiteCourseId ?? edge.prerequisiteId;
    if (!prerequisiteCourseId) continue;

    const normalizedEdge = {
      ...edge,
      prerequisiteCourseId,
    };
    normalizedEdges.push(normalizedEdge);

    if (edge.type === 'required' || edge.type === 'corequisite') {
      successors.get(prerequisiteCourseId)?.add(edge.courseId);
      predecessors.get(edge.courseId)?.add(prerequisiteCourseId);
    }
  }

  return { nodes, successors, predecessors, edges: normalizedEdges };
}

/**
 * Topological sort using Kahn's algorithm.
 * Returns courses in an order where all prerequisites come before dependents.
 */
export function topologicalSort(graph: CourseGraph, courseIds: number[]): number[] {
  const inDegree = new Map<number, number>();
  const filtered = new Set(courseIds);

  for (const id of courseIds) {
    const prereqs = graph.predecessors.get(id) ?? new Set();
    const filteredPrereqs = Array.from(prereqs).filter(p => filtered.has(p));
    inDegree.set(id, filteredPrereqs.length);
  }

  const queue: number[] = [];
  for (const [id, deg] of Array.from(inDegree.entries())) {
    if (deg === 0) queue.push(id);
  }

  const result: number[] = [];
  while (queue.length > 0) {
    // Sort by difficulty to process easier courses first within same level
    queue.sort((a, b) => {
      const nodeA = graph.nodes.get(a);
      const nodeB = graph.nodes.get(b);
      return (nodeA?.difficultyLevel ?? 3) - (nodeB?.difficultyLevel ?? 3);
    });

    const current = queue.shift()!;
    result.push(current);

    const successors = graph.successors.get(current) ?? new Set<number>();
    for (const succ of Array.from(successors)) {
      if (!filtered.has(succ)) continue;
      const newDeg = (inDegree.get(succ) ?? 0) - 1;
      inDegree.set(succ, newDeg);
      if (newDeg === 0) queue.push(succ);
    }
  }

  return result;
}

/**
 * Get all transitive prerequisites for a course.
 */
export function getAllPrerequisites(graph: CourseGraph, courseId: number): Set<number> {
  const visited = new Set<number>();
  const stack = Array.from(graph.predecessors.get(courseId) ?? []);

  while (stack.length > 0) {
    const curr = stack.pop()!;
    if (visited.has(curr)) continue;
    visited.add(curr);
    for (const prereq of Array.from(graph.predecessors.get(curr) ?? [])) {
      if (!visited.has(prereq)) stack.push(prereq);
    }
  }

  return visited;
}

/**
 * Check if a course's prerequisites are satisfied given a set of completed courses.
 */
export function prerequisitesSatisfied(
  graph: CourseGraph,
  courseId: number,
  completedIds: Set<number>
): boolean {
  const prereqs = graph.predecessors.get(courseId) ?? new Set<number>();
  for (const prereq of Array.from(prereqs)) {
    if (!completedIds.has(prereq)) return false;
  }
  return true;
}

/**
 * Get the critical path length (depth) for a course in the prerequisite chain.
 */
export function getCriticalPathLength(graph: CourseGraph, courseId: number): number {
  const memo = new Map<number, number>();

  function dfs(id: number): number {
    if (memo.has(id)) return memo.get(id)!;
    const prereqs = graph.predecessors.get(id) ?? new Set<number>();
    if (prereqs.size === 0) {
      memo.set(id, 0);
      return 0;
    }
    const maxDepth = Math.max(...Array.from(prereqs).map(p => dfs(p))) + 1;
    memo.set(id, maxDepth);
    return maxDepth;
  }

  return dfs(courseId);
}

/**
 * Compute graph data for visualization (nodes + edges with positions).
 */
export function getGraphVisualizationData(
  graph: CourseGraph,
  courseIds: number[]
): { nodes: Array<{ id: number; label: string; level: number; credits: number; difficulty: number }>; edges: Array<{ from: number; to: number; type: string }> } {
  const nodes = courseIds.map(id => {
    const node = graph.nodes.get(id)!;
    return {
      id,
      label: node.code,
      level: getCriticalPathLength(graph, id),
      credits: node.credits,
      difficulty: node.difficultyLevel,
    };
  });

  const edges = graph.edges
    .filter(e => courseIds.includes(e.courseId) && courseIds.includes(e.prerequisiteCourseId))
    .map(e => ({ from: e.prerequisiteCourseId, to: e.courseId, type: e.type }));

  return { nodes, edges };
}
