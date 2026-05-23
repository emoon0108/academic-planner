import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getLoginUrl, hasLoginConfig } from "@/const";
import {
  GraduationCap, FlaskConical, RefreshCw, ArrowLeft, Loader2,
  AlertTriangle, CheckCircle2, ChevronRight, Plus, Trash2,
  BookOpen, Calendar, BarChart3, Zap, Target, ArrowRight
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { href: "/career", label: "Career Tracks", icon: "Target" },
  { href: "/scenarios", label: "Scenario Simulation", icon: "FlaskConical" },
  { href: "/chat", label: "AI Assistant", icon: "MessageSquare" },
];

function TimelineComparison({ before, after }: { before?: any[]; after?: any[] }) {
  if (!before?.length || !after?.length) return null;
  const max = Math.max(before.length, after.length);
  const rows = Array.from({ length: max }, (_, index) => ({
    before: before[index],
    after: after[index],
  }));

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2">Before / After Timeline</h4>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {rows.map((row, index) => {
          const beforeCodes = row.before?.courseCodes ?? [];
          const afterCodes = row.after?.courseCodes ?? [];
          const changed = JSON.stringify(beforeCodes) !== JSON.stringify(afterCodes);
          return (
            <div key={index} className={`rounded-lg border p-3 ${changed ? "border-primary/40 bg-primary/10" : "border-border bg-secondary/20"}`}>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>{row.before ? `${row.before.term} ${row.before.year}` : "New semester"}</span>
                {changed && <Badge variant="secondary" className="text-xs bg-primary/15 text-primary">Changed</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground mb-1">Before</div>
                  <div className="font-mono">{beforeCodes.join(", ") || "—"}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-1">After</div>
                  <div className="font-mono">{afterCodes.join(", ") || "—"}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ScenarioPage() {
  const { isAuthenticated, loading: authLoading, user, logout } = useAuth();
  const [, navigate] = useLocation();

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [scenarioType, setScenarioType] = useState<'drop_course' | 'fail_course' | 'course_unavailable' | 'add_major' | 'change_graduation_target' | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [simulationResult, setSimulationResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const { data: plans } = trpc.plans.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: profile } = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });

  const activePlan = plans?.find(p => p.isActive) ?? plans?.[0];

  useEffect(() => {
    if (activePlan && !selectedPlanId) setSelectedPlanId(activePlan.id);
  }, [activePlan]);

  const { data: planDetail } = trpc.plans.get.useQuery(
    { planId: selectedPlanId! },
    { enabled: !!selectedPlanId }
  );

  const simulateMutation = trpc.plans.simulate.useMutation({
    onSuccess: (data) => {
      setSimulationResult(data);
      setIsRunning(false);
      toast.success("Simulation complete!");
    },
    onError: (err) => {
      toast.error(err.message);
      setIsRunning(false);
    },
  });

  const applyReplanMutation = trpc.plans.replan.useMutation({
    onSuccess: (data) => {
      toast.success("Replanning complete! " + data.impactSummary);
      if (data.newPlanId) navigate(`/plan/${data.newPlanId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (!hasLoginConfig()) return;
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const allCourses = planDetail?.semesters?.flatMap((s: any) => s.courses) ?? [];

  const runSimulation = () => {
    if (!selectedPlanId || !scenarioType) return;
    setIsRunning(true);
    setSimulationResult(null);
    simulateMutation.mutate({
      planId: selectedPlanId!,
      scenarioType: (scenarioType === 'course_unavailable' ? 'drop_course' : scenarioType) as any,
      courseId: selectedCourseId ?? undefined,
    });
  };

  const scenarioTypes = [
    { id: 'drop_course', label: 'Drop a Course', desc: 'What happens if I drop a course this semester?', icon: Trash2, color: 'oklch(0.60 0.22 25)' },
    { id: 'fail_course', label: 'Fail a Course', desc: 'How does failing a course affect my graduation timeline?', icon: AlertTriangle, color: 'oklch(0.70 0.22 50)' },
    { id: 'course_unavailable', label: 'Course Unavailable', desc: 'What if a required course is not offered next semester?', icon: Calendar, color: 'oklch(0.65 0.22 270)' },
    { id: 'add_major', label: 'Add a Second Major', desc: 'How does adding another major change my plan?', icon: Plus, color: 'oklch(0.70 0.18 200)' },
    { id: 'change_graduation_target', label: 'Change Graduation Target', desc: 'What if I want to graduate a semester earlier or later?', icon: Target, color: 'oklch(0.72 0.18 150)' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <div className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-border bg-sidebar">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm text-sidebar-foreground">AcademiQ</div>
              <div className="text-xs text-muted-foreground">Academic Planner</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/career", label: "Career Tracks" },
            { href: "/scenarios", label: "Scenario Simulation" },
            { href: "/chat", label: "AI Assistant" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                item.href === "/scenarios"
                  ? 'bg-sidebar-primary/15 text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}>
                {item.label}
              </div>
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="px-3 py-2 text-sm text-muted-foreground truncate">{user?.name}</div>
        </div>
      </div>

      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8 max-w-4xl">
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <FlaskConical className="w-6 h-6 text-primary" />
              Scenario Simulation
            </h1>
            <p className="text-muted-foreground text-sm">
              Run "what-if" analyses to see how changes affect your degree plan. The Dynamic Replanning Engine will compute an updated optimal schedule.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Setup */}
            <div className="space-y-5">
              {/* Plan selector */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold mb-3 text-sm">Select Plan to Simulate</h3>
                <div className="space-y-2">
                  {plans?.map(plan => (
                    <button
                      key={plan.id}
                      onClick={() => setSelectedPlanId(plan.id)}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                        selectedPlanId === plan.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary/20 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{plan.name}</span>
                        {plan.isActive && <Badge variant="secondary" className="text-xs bg-primary/15 text-primary border-primary/20">Active</Badge>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Scenario type */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h3 className="font-semibold mb-3 text-sm">Scenario Type</h3>
                <div className="space-y-2">
                  {scenarioTypes.map(type => (
                    <button
                      key={type.id}
                      onClick={() => { setScenarioType(type.id as any); setSelectedCourseId(null); }}
                      className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                        scenarioType === type.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary/20 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <type.icon className="w-4 h-4 shrink-0" style={{ color: type.color }} />
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-xs text-muted-foreground">{type.desc}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Course selector (when relevant) */}
              {(scenarioType === 'drop_course' || scenarioType === 'fail_course' || scenarioType === 'course_unavailable') && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="font-semibold mb-3 text-sm">Select Course</h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {allCourses.map((pc: any) => (
                      <button
                        key={pc.planCourseId}
                        onClick={() => setSelectedCourseId(pc.courseId)}
                        className={`w-full text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                          selectedCourseId === pc.courseId ? 'border-primary bg-primary/10' : 'border-border bg-secondary/20 hover:border-primary/40'
                        }`}
                      >
                        <span className="font-mono text-xs text-primary mr-2">{pc.course?.code}</span>
                        {pc.course?.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <Button
                onClick={runSimulation}
                disabled={!selectedPlanId || !scenarioType || isRunning}
                className="w-full"
                size="lg"
              >
                {isRunning ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running Simulation...</>
                ) : (
                  <><FlaskConical className="w-4 h-4 mr-2" /> Run Simulation</>
                )}
              </Button>
            </div>

            {/* Right: Results */}
            <div>
              {!simulationResult && !isRunning && (
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center h-full flex flex-col items-center justify-center">
                  <FlaskConical className="w-10 h-10 text-muted-foreground mb-4" />
                  <h3 className="font-semibold mb-2">No simulation yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Configure a scenario on the left and click Run Simulation to see the impact analysis.
                  </p>
                </div>
              )}

              {isRunning && (
                <div className="rounded-xl border border-border bg-card p-12 text-center h-full flex flex-col items-center justify-center">
                  <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                  <h3 className="font-semibold mb-2">Running simulation...</h3>
                  <p className="text-sm text-muted-foreground">The replanning engine is computing the impact.</p>
                </div>
              )}

              {simulationResult && (
                <div className="space-y-4">
                  <div className="rounded-xl border border-border bg-card p-5">
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-primary" />
                      Simulation Results
                    </h3>

                    {/* Impact summary */}
                    <div className={`rounded-lg p-4 mb-4 ${
                      simulationResult.feasible ? 'bg-green-500/10 border border-green-500/20' : 'bg-destructive/10 border border-destructive/20'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        {simulationResult.feasible
                          ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                          : <AlertTriangle className="w-4 h-4 text-destructive" />}
                        <span className="font-medium text-sm">
                          {simulationResult.feasible ? 'Feasible — Plan can be adjusted' : 'Infeasible — Significant disruption'}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">{simulationResult.impactSummary}</p>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-2 gap-3 mb-4">
                      {[
                        { label: "Graduation Delay", value: simulationResult.graduationDelay === 0 ? "None" : `+${simulationResult.graduationDelay} sem`, positive: simulationResult.graduationDelay === 0 },
                        { label: "Courses Rescheduled", value: simulationResult.coursesRescheduled ?? 0, positive: (simulationResult.coursesRescheduled ?? 0) < 3 },
                        { label: "Affected Semesters", value: simulationResult.affectedSemesters ?? 0, positive: (simulationResult.affectedSemesters ?? 0) < 2 },
                        { label: "Feasible", value: simulationResult.feasible ? "Yes" : "No", positive: simulationResult.feasible },
                      ].map(metric => (
                        <div key={metric.label} className="rounded-lg border border-border bg-secondary/20 p-3">
                          <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
                          <div className={`font-semibold text-sm ${metric.positive ? 'text-green-400' : 'text-orange-400'}`}>
                            {String(metric.value)}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Alternatives */}
                    {simulationResult.alternatives && simulationResult.alternatives.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Alternative Courses</h4>
                        <div className="space-y-1">
                          {simulationResult.alternatives.map((alt: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/20 text-sm">
                              <span className="font-mono text-xs text-primary">{alt.code}</span>
                              <span className="text-muted-foreground">{alt.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <TimelineComparison before={simulationResult.beforeTimeline} after={simulationResult.afterTimeline} />

                    {simulationResult.feasible && (
                      <Button
                        className="w-full mt-4"
              onClick={() => applyReplanMutation.mutate({
                        planId: selectedPlanId!,
                        triggerType: (scenarioType === 'course_unavailable' ? 'drop_course' : scenarioType ?? 'custom') as any,
                        courseId: selectedCourseId ?? undefined,
                      })}
                        disabled={applyReplanMutation.isPending}
                      >
                        {applyReplanMutation.isPending ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Applying Replan...</>
                        ) : (
                          <><RefreshCw className="w-4 h-4 mr-2" /> Apply Replan & View Updated Plan</>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
