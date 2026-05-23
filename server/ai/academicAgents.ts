import type { Message } from "../_core/llm";

export const ACADEMIC_AGENT_MODES = [
  "auto",
  "academic_planner",
  "university_researcher",
] as const;

export type AcademicAgentMode = (typeof ACADEMIC_AGENT_MODES)[number];
export type ResolvedAcademicAgent = Exclude<AcademicAgentMode, "auto">;

export function resolveAcademicAgent(
  mode: AcademicAgentMode,
  message: string
): ResolvedAcademicAgent {
  if (mode !== "auto") return mode;

  const normalized = message.toLowerCase();
  const researchSignals = [
    "university policy",
    "school policy",
    "catalog",
    "bulletin",
    "registrar",
    "department page",
    "official source",
    "source",
    "transfer credit",
    "ap credit",
    "placement",
    "waitlist",
    "override",
    "course rotation",
    "only offered",
    "offered every",
    "prereq exception",
    "residency requirement",
    "double count",
    "general education",
    "gen ed",
    "major declaration",
    "minor declaration",
    "petition",
    "audit",
  ];

  return researchSignals.some(signal => normalized.includes(signal))
    ? "university_researcher"
    : "academic_planner";
}

export function getAgentLabel(agent: ResolvedAcademicAgent) {
  return agent === "academic_planner"
    ? "Academic Planning Strategist"
    : "University Scheduling Researcher";
}

function compactContext(context: string, fallback: string) {
  const trimmed = context.trim();
  if (!trimmed) return fallback;

  return trimmed
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .join("\n");
}

export function buildAcademicAgentFallbackResponse({
  agent,
  message,
  profileContext,
  planContext,
  researchContext = "",
  errorMessage,
}: {
  agent: ResolvedAcademicAgent;
  message: string;
  profileContext: string;
  planContext: string;
  researchContext?: string;
  errorMessage?: string;
}) {
  const localModeNote = errorMessage
    ? `I'm answering in local fallback mode because the live AI provider is unavailable (${errorMessage}).`
    : "I'm answering in local fallback mode because the live AI provider is unavailable.";

  const profileSummary = compactContext(
    profileContext,
    "No saved student profile is available yet."
  );
  const planSummary = compactContext(
    planContext,
    "No saved degree plan is selected yet."
  );

  if (agent === "university_researcher") {
    const researchSummary = compactContext(
      researchContext,
      "No official source context was retrieved automatically."
    );

    return `${localModeNote}

I can still help you frame the research question.

Question: ${message}

Known student context:
${profileSummary}

Current plan context:
${planSummary}

Source retrieval context:
${researchSummary}

What to verify next:
- Check the official undergraduate catalog for requirement wording and catalog-year rules.
- Check the registrar or schedule-of-classes page for term availability and enrollment restrictions.
- Check the department advising page for prerequisite overrides, petitions, double-counting, and residency rules.
- Bring any official URL back here and I can use it as source context for a tighter answer.`;
  }

  const lowerMessage = message.toLowerCase();
  const tailoredSuggestions: string[] = [];

  if (lowerMessage.includes("graduate") || lowerMessage.includes("earlier")) {
    tailoredSuggestions.push("Compare the selected plan against the fastest saved variant and look for bottleneck courses that are offered in only one term.");
    tailoredSuggestions.push("Only accelerate by moving courses whose prerequisites are already satisfied and whose credit load keeps the semester realistic.");
  }

  if (lowerMessage.includes("drop") || lowerMessage.includes("fail")) {
    tailoredSuggestions.push("Identify every later course that depends on the changed course before moving it; one prerequisite shift can ripple across multiple semesters.");
  }

  if (lowerMessage.includes("workload") || lowerMessage.includes("stress")) {
    tailoredSuggestions.push("Balance technical, lab, and writing-heavy courses across terms instead of optimizing only for total credits.");
  }

  if (lowerMessage.includes("career") || lowerMessage.includes("internship")) {
    tailoredSuggestions.push("Prioritize career-track courses before recruiting windows, especially project-heavy courses that create portfolio evidence.");
  }

  if (tailoredSuggestions.length === 0) {
    tailoredSuggestions.push("Start by checking prerequisites, term availability, credit load, and whether the course supports your stated career track.");
    tailoredSuggestions.push("Use the researcher specialist for policies that need official catalog or registrar confirmation.");
  }

  return `${localModeNote}

Question: ${message}

Known student context:
${profileSummary}

Current plan context:
${planSummary}

Planning read:
${tailoredSuggestions.map(item => `- ${item}`).join("\n")}

Best next move:
- Pick the specific semester or course you want to change, then compare the ripple effects on prerequisites, graduation term, workload, and career readiness.`;
}

export function buildAcademicAgentSystemMessage({
  agent,
  profileContext,
  planContext,
  researchContext = "",
}: {
  agent: ResolvedAcademicAgent;
  profileContext: string;
  planContext: string;
  researchContext?: string;
}): Message {
  const sharedGrounding = `You are part of AcademiQ, an academic planning system for college students.${profileContext}${planContext}${researchContext}

Current date: May 8, 2026.

Ground rules:
- Be specific and practical.
- Distinguish known plan data from assumptions.
- When discussing courses, use course codes whenever available.
- Do not invent university-specific requirements, course rotations, deadlines, or policies.
- If a policy detail needs confirmation, say exactly what official source would verify it.`;

  if (agent === "university_researcher") {
    return {
      role: "system",
      content: `${sharedGrounding}

Specialist identity: University Scheduling Researcher.

Your job is to investigate the small institution-specific rules that make academic planning hard: registrar calendars, catalog year rules, transfer/AP/IB credit policies, course offering rotations, enrollment restrictions, waitlists, major/minor declaration timing, prerequisite enforcement, petition workflows, residency rules, double-counting rules, gen-ed overlays, sequencing traps, and department-specific exceptions.

Response style:
- Lead with the answer if the available context supports it.
- Otherwise produce a research brief with: what is known, what must be verified, where to verify it, and how the finding would change the student's plan.
- Prefer official sources such as registrar pages, undergraduate catalog pages, department requirement pages, advising handbooks, and course schedule pages.
- When retrieved sources are provided, cite them inline as [1], [2], etc. and include a short "Sources checked" list.
- Flag stale or ambiguous information and avoid confident claims without evidence.`,
    };
  }

  return {
    role: "system",
    content: `${sharedGrounding}

Specialist identity: Academic Planning Strategist.

Your job is to act like a sharp academic advisor and planning engine. Help students understand degree progress, prerequisite sequencing, workload balance, graduation timing, career-track preparation, what-if scenarios, and tradeoffs between faster, lower-stress, and more flexible plans.

Response style:
- Explain the planning logic in plain language.
- Identify prerequisite chains, bottleneck courses, risky semesters, and high-leverage alternatives.
- Suggest concrete next actions, including when to ask the researcher specialist to verify university-specific policy details.
- Keep the student's goals and constraints at the center.`,
  };
}
