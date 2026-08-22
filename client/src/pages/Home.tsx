import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getLoginUrl, hasLoginConfig } from "@/const";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import {
  GraduationCap, Zap, BarChart3, GitBranch, RefreshCw, Brain,
  ArrowRight, CheckCircle2, Sparkles, Target, BookOpen, Search,
  Database, FlaskConical, AlertTriangle, ClipboardList, ShieldCheck
} from "lucide-react";

const features = [
  {
    icon: GitBranch,
    title: "Prerequisite Graph Engine",
    description: "Automatically constructs a dependency graph of all required courses, visualizing the optimal path through your degree.",
    color: "oklch(0.65 0.22 270)",
  },
  {
    icon: Zap,
    title: "Constraint Optimizer",
    description: "Generates semester plans satisfying hard constraints (prerequisites, credit limits) and soft constraints (workload, difficulty).",
    color: "oklch(0.70 0.18 200)",
  },
  {
    icon: BarChart3,
    title: "Workload Heatmap",
    description: "Visualize difficulty and workload distribution across all semesters to identify and balance high-stress periods.",
    color: "oklch(0.72 0.18 150)",
  },
  {
    icon: RefreshCw,
    title: "Dynamic Replanning Engine",
    description: "Automatically recomputes your optimal schedule when a course is dropped, failed, or unavailable — with minimal disruption.",
    color: "oklch(0.75 0.18 50)",
  },
  {
    icon: Brain,
    title: "AI Chat Assistant",
    description: "Ask AcademiQ anything about your degree plan. Get explanations, optimizations, and what-if analysis in natural language.",
    color: "oklch(0.65 0.22 270)",
  },
  {
    icon: Target,
    title: "Career-Aware Optimization",
    description: "Prioritize courses for internship readiness, grad school preparation, or specific industry tracks based on your goals.",
    color: "oklch(0.70 0.18 200)",
  },
];

const planVariants = [
  {
    name: "Fastest Path",
    description: "Maximize course load to graduate as early as possible",
    icon: "⚡",
    color: "oklch(0.65 0.22 270)",
  },
  {
    name: "Lowest Stress Path",
    description: "Balance workload and difficulty for a sustainable pace",
    icon: "🌿",
    color: "oklch(0.72 0.18 150)",
  },
  {
    name: "Most Flexible Path",
    description: "Maximize scheduling options and elective freedom",
    icon: "🔀",
    color: "oklch(0.75 0.18 50)",
  },
];

const sampleSemesters = [
  {
    term: "Fall",
    year: 2026,
    credits: 15,
    workload: 6.4,
    courses: ["CS 101", "MATH 115", "FYWR 100", "STATS 250"],
  },
  {
    term: "Spring",
    year: 2027,
    credits: 16,
    workload: 7.1,
    courses: ["CS 201", "MATH 116", "PHYS 140", "ECON 101"],
  },
  {
    term: "Fall",
    year: 2027,
    credits: 14,
    workload: 5.8,
    courses: ["CS 281", "MATH 214", "TECH COMM", "HUM 210"],
  },
];

const supportedSamples = [
  "University of Michigan",
  "Michigan State University",
  "State University of Technology",
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [, navigate] = useLocation();
  const [universityQuery, setUniversityQuery] = useState("");
  const [requestedSchool, setRequestedSchool] = useState("");
  const [demoMode, setDemoMode] = useState<"plan" | "scenario">("plan");
  const { data: schools } = trpc.schools.list.useQuery();
  const { data: careerTracks } = trpc.careerTracks.list.useQuery();

  const normalizedQuery = universityQuery.trim().toLowerCase();
  const matchedSchool = useMemo(() => {
    if (!normalizedQuery) return null;
    return schools?.find(school =>
      school.name.toLowerCase().includes(normalizedQuery) ||
      school.shortName.toLowerCase().includes(normalizedQuery)
    ) ?? null;
  }, [normalizedQuery, schools]);

  const searchedSupported = Boolean(normalizedQuery && matchedSchool);
  const searchedPending = Boolean(normalizedQuery && !matchedSchool);

  const handleGetStarted = () => {
    if (isAuthenticated) {
      navigate("/dashboard");
    } else if (!hasLoginConfig()) {
      navigate("/setup");
    } else {
      window.location.href = getLoginUrl();
    }
  };

  const handleResearchRequest = () => {
    const school = requestedSchool || universityQuery;
    if (!school.trim()) return;
    setRequestedSchool(school);
    if (isAuthenticated) navigate("/research-agent");
    else handleGetStarted();
  };

  return (
    <div className="academiq-shell min-h-screen bg-background text-foreground">
      {/* Navigation */}
      <nav className="academiq-nav fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-tight">AcademiQ</span>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              isAuthenticated ? (
                <Button onClick={() => navigate("/dashboard")} size="sm">
                  Open Dashboard <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleGetStarted} size="sm">
                  Get Started <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )
            )}
          </div>
        </div>
      </nav>

      <section className="academiq-hero pt-28 pb-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_440px] gap-10 items-center">
            <div>
              <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium border border-primary/20 bg-primary/10 text-primary">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                Degree audit prototype · UMich-first catalog
              </Badge>

              <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 leading-[1.08]">
                A degree plan that survives <em>registration week.</em>
              </h1>

              <p className="text-xl text-muted-foreground max-w-2xl mb-8 leading-relaxed">
                Search your school, preview a sample plan, and see how AcademiQ catches prerequisite, workload, credit, and catalog-data risks before they become graduation problems.
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button size="lg" onClick={handleGetStarted} className="text-base px-7 h-12">
                  Start with my university
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => setDemoMode("plan")} className="text-base px-7 h-12 bg-secondary/50">
                  Explore sample plan
                </Button>
                <Button size="lg" variant="outline" onClick={() => isAuthenticated ? navigate("/research-agent") : handleGetStarted()} className="text-base px-7 h-12 bg-secondary/50">
                  Research my school
                </Button>
              </div>
            </div>

            <div className="catalog-card rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold">Search Your University</h2>
                  <p className="text-sm text-muted-foreground">Check support or request catalog research.</p>
                </div>
                <Search className="w-5 h-5 text-primary" />
              </div>
              <div className="flex gap-2">
                <input
                  value={universityQuery}
                  onChange={event => setUniversityQuery(event.target.value)}
                  placeholder="Michigan, Berkeley, Georgia Tech..."
                  className="h-11 flex-1 rounded-lg border border-border bg-secondary/30 px-3 text-sm outline-none focus:border-primary"
                />
                <Button onClick={handleResearchRequest} variant="outline" className="h-11 bg-secondary/50">
                  Request
                </Button>
              </div>

              {normalizedQuery && (
                <div className={`mt-4 rounded-lg border p-4 ${searchedSupported ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    {searchedSupported ? <CheckCircle2 className="w-4 h-4 text-green-300" /> : <RefreshCw className="w-4 h-4 text-amber-300" />}
                    <span className="text-sm font-medium">
                      {searchedSupported ? `${matchedSchool?.name} is supported` : "Not in the live catalog yet"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {searchedSupported
                      ? "You can start setup and generate plans with available catalog data."
                      : "Send it to the Research Agent so official catalog sources can be found and approved."}
                  </p>
                </div>
              )}

              <div className="mt-5 grid grid-cols-3 gap-3">
                {[
                  { value: schools?.length ?? supportedSamples.length, label: "Schools" },
                  { value: careerTracks?.length ?? 0, label: "Tracks" },
                  { value: "Daily", label: "Research" },
                ].map(stat => (
                  <div key={stat.label} className="rounded-lg bg-secondary/20 p-3 text-center">
                    <div className="text-xl font-bold text-primary">{stat.value}</div>
                    <div className="text-xs text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="plan-preview-section py-10 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="text-3xl font-bold mb-2">Try the product before setup</h2>
              <p className="text-muted-foreground">A sample academic plan with the same checks used in the real dashboard.</p>
            </div>
            <div className="rounded-lg border border-border bg-secondary/30 p-1">
              <button
                onClick={() => setDemoMode("plan")}
                className={`px-4 py-2 rounded-md text-sm ${demoMode === "plan" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Plan Preview
              </button>
              <button
                onClick={() => setDemoMode("scenario")}
                className={`px-4 py-2 rounded-md text-sm ${demoMode === "scenario" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              >
                Scenario Preview
              </button>
            </div>
          </div>

          {demoMode === "plan" ? (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">Sample CS Plan</h3>
                    <p className="text-sm text-muted-foreground">45 credits shown · 120-credit target · Spring 2030 graduation</p>
                  </div>
                  <Badge variant="secondary" className="bg-green-500/15 text-green-300">Healthy</Badge>
                </div>
                <div className="space-y-3">
                  {sampleSemesters.map(semester => (
                    <div key={`${semester.term}-${semester.year}`} className="rounded-lg border border-border bg-secondary/20 p-4">
                      <div className="flex items-center justify-between gap-3 mb-3">
                        <div>
                          <div className="font-medium">{semester.term} {semester.year}</div>
                          <div className="text-xs text-muted-foreground">{semester.credits} credits</div>
                        </div>
                        <div className="text-xs px-2 py-1 rounded-full heat-medium">Workload {semester.workload}/10</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {semester.courses.map(course => (
                          <span key={course} className="font-mono text-xs rounded-md bg-background/60 border border-border px-2 py-1 text-primary">{course}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                {[
                  { icon: ShieldCheck, title: "Prereqs satisfied", desc: "Every dependent course waits until prerequisites are complete." },
                  { icon: AlertTriangle, title: "One risk flagged", desc: "Spring 2027 is workload-heavy and worth discussing with an advisor." },
                  { icon: ClipboardList, title: "Advisor report ready", desc: "Export issues, assumptions, requirements, and questions." },
                ].map(item => (
                  <div key={item.title} className="rounded-xl border border-border bg-card p-4">
                    <item.icon className="w-5 h-5 text-primary mb-3" />
                    <div className="font-medium text-sm">{item.title}</div>
                    <div className="text-sm text-muted-foreground mt-1">{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <FlaskConical className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">What if CS 201 is dropped?</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Before", courses: ["CS 201", "MATH 116", "PHYS 140", "ECON 101"], tone: "border-border" },
                  { label: "After", courses: ["MATH 116", "PHYS 140", "ECON 101", "HUM 210"], tone: "border-primary/50 bg-primary/10" },
                ].map(column => (
                  <div key={column.label} className={`rounded-lg border ${column.tone} p-4`}>
                    <div className="text-sm font-medium mb-3">{column.label}: Spring 2027</div>
                    <div className="space-y-2">
                      {column.courses.map(course => (
                        <div key={course} className="rounded-md bg-secondary/40 px-3 py-2 font-mono text-xs">{course}</div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-muted-foreground">
                AcademiQ moves the dependent course chain forward, reports the affected semesters, and keeps the graduation delay visible.
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Status */}
      <section className="status-section py-16 px-4">
        <div className="container max-w-6xl mx-auto">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">Catalog Data Status</h2>
                <p className="text-muted-foreground text-sm">The planner separates source-backed data from research-agent discoveries awaiting approval.</p>
              </div>
              <Button variant="outline" className="bg-secondary/50" onClick={() => isAuthenticated ? navigate("/research-agent") : handleGetStarted()}>
                <Database className="w-4 h-4 mr-2" />
                Open Research Agent
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {[
                { label: "Live universities", value: schools?.length ?? 0, icon: GraduationCap },
                { label: "Career tracks", value: careerTracks?.length ?? 0, icon: Target },
                { label: "Research cadence", value: "Daily", icon: RefreshCw },
                { label: "Import mode", value: "Review", icon: CheckCircle2 },
              ].map(item => (
                <div key={item.label} className="rounded-lg border border-border bg-secondary/20 p-4">
                  <item.icon className="w-5 h-5 text-primary mb-3" />
                  <div className="text-2xl font-bold">{item.value}</div>
                  <div className="text-sm text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="machinery-section py-16 px-4">
        <div className="container max-w-5xl mx-auto">
          <div className="machinery-heading mb-12">
            <span>ENGINE / 06 MODULES</span>
            <h2 className="text-3xl font-bold mb-3">The machinery under the plan</h2>
            <p className="text-muted-foreground">Prerequisites, credits, workload, catalog confidence, and career targets stay visible.</p>
          </div>
          <div className="feature-ledger grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <div key={feature.title} className="feature-entry rounded-xl border border-border bg-card p-6 transition-all">
                <span className="feature-number">0{index + 1}</span>
                <div className="feature-icon w-10 h-10 mb-4 flex items-center justify-center">
                  <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="method-section py-16 px-4">
        <div className="container max-w-3xl mx-auto">
          <div className="method-heading mb-12">
            <span>FROM TRANSCRIPT TO TERM MAP</span>
            <h2 className="text-3xl font-bold mb-3">Four moves. Every assumption exposed.</h2>
          </div>
          <div className="space-y-4">
            {[
              { step: "01", title: "Set up your profile", desc: "Enter your school, major(s), minor(s), AP/transfer credits, and career goals." },
              { step: "02", title: "Generate optimized plans", desc: "The constraint engine builds three complete multi-year degree plans in seconds." },
              { step: "03", title: "Compare and choose", desc: "Review the fastest, lowest-stress, and most flexible paths side by side." },
              { step: "04", title: "Adapt as you go", desc: "Drop a class, add a major, or change your graduation target — the replanning engine updates your schedule automatically." },
            ].map(item => (
              <div key={item.step} className="method-row flex gap-5 p-5 rounded-xl border border-border bg-card">
                <div className="text-2xl font-bold text-primary/40 font-mono w-10 shrink-0">{item.step}</div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="plan-cta py-24 px-4">
        <div className="container max-w-2xl mx-auto text-center">
          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-12">
            <GraduationCap className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="text-3xl font-bold mb-4">Bring one transcript. Leave with eight accountable terms.</h2>
            <p className="text-muted-foreground mb-8">
              Generate a 120-credit baseline, see the risky semester, and keep every catalog assumption in view.
            </p>
            <Button size="lg" onClick={handleGetStarted} className="text-base px-10 h-12">
              Build my baseline
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4" />
            <span>AcademiQ — Adaptive Academic Planning Engine</span>
          </div>
          <span>Built with constraint optimization</span>
        </div>
      </footer>
    </div>
  );
}
