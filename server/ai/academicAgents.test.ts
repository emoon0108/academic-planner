import { describe, expect, it } from "vitest";
import {
  buildAcademicAgentFallbackResponse,
  buildAcademicAgentSystemMessage,
  getAgentLabel,
  resolveAcademicAgent,
} from "./academicAgents";

describe("academic agent routing", () => {
  it("keeps an explicit academic planner selection", () => {
    expect(resolveAcademicAgent("academic_planner", "Check transfer credit policy")).toBe(
      "academic_planner"
    );
  });

  it("keeps an explicit university researcher selection", () => {
    expect(resolveAcademicAgent("university_researcher", "Balance my workload")).toBe(
      "university_researcher"
    );
  });

  it("routes policy and catalog questions to the researcher in auto mode", () => {
    expect(resolveAcademicAgent("auto", "Can this course double count for gen ed?")).toBe(
      "university_researcher"
    );
    expect(resolveAcademicAgent("auto", "What does the registrar say about AP credit?")).toBe(
      "university_researcher"
    );
  });

  it("routes planning questions to the planner in auto mode", () => {
    expect(resolveAcademicAgent("auto", "Can I graduate one semester earlier?")).toBe(
      "academic_planner"
    );
  });

  it("builds distinct system prompts for each specialist", () => {
    const planner = buildAcademicAgentSystemMessage({
      agent: "academic_planner",
      profileContext: "",
      planContext: "",
    });
    const researcher = buildAcademicAgentSystemMessage({
      agent: "university_researcher",
      profileContext: "",
      planContext: "",
    });

    expect(String(planner.content)).toContain("Academic Planning Strategist");
    expect(String(researcher.content)).toContain("University Scheduling Researcher");
    expect(getAgentLabel("academic_planner")).toBe("Academic Planning Strategist");
  });

  it("builds a useful local fallback when the live provider is unavailable", () => {
    const response = buildAcademicAgentFallbackResponse({
      agent: "academic_planner",
      message: "How can I graduate one semester earlier?",
      profileContext: "\nStudent profile:\n- School: Test University\n- Primary major: Computer Science",
      planContext: "\n\nStudent's current degree plan (Fastest Path, fastest_path):\n- Total credits: 120",
      errorMessage: "OPENAI_API_KEY is not configured. Add OPENAI_API_KEY to .env or configure BUILT_IN_FORGE_API_KEY.",
    });

    expect(response).toContain("local fallback mode");
    expect(response).toContain("OPENAI_API_KEY is not configured");
    expect(response).toContain("Compare the selected plan");
    expect(response).toContain("Test University");
  });

  it("builds researcher fallback guidance with source-verification steps", () => {
    const response = buildAcademicAgentFallbackResponse({
      agent: "university_researcher",
      message: "What transfer credit policy should I verify?",
      profileContext: "",
      planContext: "",
      researchContext: "",
    });

    expect(response).toContain("official undergraduate catalog");
    expect(response).toContain("registrar");
    expect(response).toContain("No official source context");
  });
});
