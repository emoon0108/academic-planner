import { useState, useEffect, useCallback } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { getLoginUrl, hasLoginConfig } from "@/const";
import {
  GraduationCap, ArrowLeft, BarChart3, GitBranch, RefreshCw,
  Loader2, BookOpen, AlertTriangle, CheckCircle2, Clock,
  ChevronDown, ChevronUp, Download, Sparkles, Target, Calendar,
  ShieldCheck, ListChecks, ArrowUpDown, Info, MoveRight,
  ClipboardList, Upload, FileText, CheckSquare, Square, Lightbulb
} from "lucide-react";

// Sidebar reuse
import Dashboard from "./Dashboard";

const ADVISOR_PRINT_STYLES = `
  :root{color:#18231d;background:#eee7d6}
  *{box-sizing:border-box}
  body{max-width:850px;margin:0 auto;padding:44px 52px;background:#faf6ea;font-family:"Avenir Next","Trebuchet MS",sans-serif;line-height:1.55}
  header{border-top:10px solid #1d4b3a;border-bottom:2px solid #18231d;padding:20px 0 16px;margin-bottom:30px}
  header span{font-size:11px;font-weight:700;letter-spacing:.18em;color:#795a00}
  h1{margin:5px 0 0;font:700 38px/1 Georgia,serif;letter-spacing:-.035em}
  .report{white-space:pre-wrap;font-size:14px}
  @media print{body{padding:20px;background:white}header{break-after:avoid}}
`;

const PLAN_PRINT_STYLES = `
  :root{color:#18231d;background:#eee7d6}
  *{box-sizing:border-box}
  body{max-width:900px;margin:0 auto;padding:42px 48px;background:#faf6ea;font-family:"Avenir Next","Trebuchet MS",sans-serif;line-height:1.45}
  .folio{border-top:10px solid #1d4b3a;padding-top:14px;color:#795a00;font-size:11px;font-weight:700;letter-spacing:.18em}
  h1,h2,h3{font-family:Georgia,serif;letter-spacing:-.025em}
  h1{font-size:36px;margin:7px 0 4px}
  h2{font-size:22px;border-bottom:2px solid #18231d;padding-bottom:6px}
  .meta{color:#5e655d;font-size:13px;margin-bottom:24px}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:20px 0;border:2px solid #18231d}
  .box{padding:13px;border-right:1px solid #18231d;background:#f1c84b}
  .box:last-child{border-right:0}
  .box .val{font:700 24px/1 Georgia,serif}
  .box .lbl{margin-top:6px;font-size:10px;text-transform:uppercase;letter-spacing:.09em}
  .section{margin-top:30px}
  .semester{margin-bottom:20px;page-break-inside:avoid}
  .semester h3{font-size:17px;border-bottom:1px solid #8d918a;padding-bottom:6px;margin-bottom:8px}
  .course{display:grid;grid-template-columns:90px 1fr 70px 80px;gap:12px;padding:6px 0;font-size:13px;border-bottom:1px solid #cec8b9}
  .issue{border-left:7px solid #b74a31;background:#f3e1cb;padding:9px 12px;margin:7px 0;font-size:13px}
  .req{display:flex;justify-content:space-between;border-bottom:1px solid #cec8b9;padding:7px 0;font-size:13px}
  @media print{body{padding:18px;background:white}.grid{break-inside:avoid}}
`;

function SemesterCard({
  semester,
  courses,
  semesters,
  onMoveCourse,
  movingCourse,
}: {
  semester: any;
  courses: any[];
  semesters: any[];
  onMoveCourse: (planCourseId: number, targetSemesterId: number) => void;
  movingCourse?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const termColors: Record<string, string> = {
    fall: 'oklch(0.65 0.22 270)',
    spring: 'oklch(0.70 0.18 150)',
    summer: 'oklch(0.75 0.18 50)',
  };
  const color = termColors[semester.term] ?? termColors.fall;

  const workloadClass =
    semester.workloadScore < 4 ? 'heat-low' :
    semester.workloadScore < 6 ? 'heat-medium' :
    semester.workloadScore < 8 ? 'heat-high' : 'heat-very-high';

  return (
    <div
      className={`rounded-xl border bg-card overflow-hidden semester-${semester.term} ${dragOver ? "border-primary ring-1 ring-primary/40" : "border-border"}`}
      onDragOver={event => {
        event.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={event => {
        event.preventDefault();
        setDragOver(false);
        const planCourseId = Number(event.dataTransfer.getData("text/plan-course-id"));
        if (planCourseId) onMoveCourse(planCourseId, semester.id);
      }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <div>
            <div className="font-semibold capitalize">
              {semester.term} {semester.year}
            </div>
            <div className="text-xs text-muted-foreground">
              {courses.length} courses · {semester.totalCredits} credits
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${workloadClass}`}>
            Workload {semester.workloadScore?.toFixed(1)}/10
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </div>

      {expanded && (
        <div className="px-5 pb-4 space-y-2">
          {courses.map(pc => (
            <div
              key={pc.planCourseId}
              draggable
              onDragStart={event => {
                event.dataTransfer.setData("text/plan-course-id", String(pc.planCourseId));
                event.dataTransfer.effectAllowed = "move";
              }}
              className="flex items-center gap-3 py-2 border-t border-border/50 cursor-grab active:cursor-grabbing"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary font-medium">{pc.course?.code}</span>
                  <span className="text-sm truncate">{pc.course?.name}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                  <span>{pc.course?.credits} cr</span>
                  <span>Difficulty: {pc.course?.difficultyLevel}/5</span>
                  <span>~{pc.course?.workloadHours}h/wk</span>
                </div>
              </div>
              <StatusBadge status={pc.status} />
              <label className="sr-only" htmlFor={`move-${pc.planCourseId}`}>Move course</label>
              <select
                id={`move-${pc.planCourseId}`}
                value={semester.id}
                disabled={movingCourse === pc.planCourseId}
                onChange={event => onMoveCourse(pc.planCourseId, Number(event.target.value))}
                className="h-8 max-w-36 rounded-md border border-border bg-secondary/40 px-2 text-xs text-foreground outline-none focus:border-primary"
              >
                {semesters.map(target => (
                  <option key={target.id} value={target.id}>
                    {target.term} {target.year}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CatalogImportPanel() {
  const [sourceText, setSourceText] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const previewImport = trpc.catalog.previewImport.useMutation({
    onSuccess: data => {
      setPreview(data);
      toast.success(`Parsed ${data.courses.length} catalog courses`);
    },
    onError: err => toast.error(err.message),
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-2">
        <Upload className="w-4 h-4 text-primary" />
        Catalog Ingestion Preview
      </h3>
      <p className="text-sm text-muted-foreground mb-4">
        Paste catalog text to extract course codes, titles, credits, and prerequisite notes before adding seed data.
      </p>
      <textarea
        value={sourceText}
        onChange={event => setSourceText(event.target.value)}
        placeholder="EECS 281 Data Structures and Algorithms (4 credits). Prerequisites: EECS 280..."
        className="min-h-32 w-full rounded-lg border border-border bg-secondary/30 p-3 text-sm outline-none focus:border-primary"
      />
      <Button
        className="mt-3"
        size="sm"
        disabled={sourceText.trim().length < 20 || previewImport.isPending}
        onClick={() => previewImport.mutate({ sourceText })}
      >
        {previewImport.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
        Preview Import
      </Button>
      {preview && (
        <div className="mt-4 space-y-2">
          <div className="text-xs text-muted-foreground">Confidence: {preview.confidence}</div>
          {preview.courses.slice(0, 6).map((course: any) => (
            <div key={`${course.code}-${course.sourceLine}`} className="rounded-lg border border-border bg-secondary/20 px-3 py-2 text-sm">
              <span className="font-mono text-primary mr-2">{course.code}</span>
              {course.name}
              <span className="text-muted-foreground ml-2">{course.credits ? `${course.credits} cr` : "credits unknown"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanHealthPanel({ plan }: { plan: any }) {
  const health = plan.health;
  const statusConfig: Record<string, { label: string; className: string }> = {
    healthy: { label: "Healthy", className: "border-green-500/30 bg-green-500/10 text-green-300" },
    review: { label: "Review", className: "border-amber-500/30 bg-amber-500/10 text-amber-300" },
    needs_attention: { label: "Needs Attention", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  };
  const cfg = statusConfig[health?.status] ?? statusConfig.review;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              Plan Health
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {plan.totalCredits} of {plan.targetCredits ?? plan.totalCredits} credits planned
              {plan.missingCredits > 0 ? ` · ${plan.missingCredits} credits missing` : ""}
            </p>
          </div>
          <Badge variant="secondary" className={`border ${cfg.className}`}>{cfg.label}</Badge>
        </div>
      </div>

      {health?.issues?.length ? (
        <div className="space-y-2">
          {health.issues.map((issue: any, index: number) => (
            <div key={`${issue.title}-${index}`} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                {issue.severity === "error" ? (
                  <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                ) : issue.severity === "warning" ? (
                  <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5" />
                ) : (
                  <Info className="w-4 h-4 text-primary mt-0.5" />
                )}
                <div>
                  <div className="font-medium text-sm">{issue.title}</div>
                  <div className="text-sm text-muted-foreground mt-0.5">{issue.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No prerequisite, credit, workload, or requirement issues detected.
        </div>
      )}
    </div>
  );
}

function RequirementTracker({ plan }: { plan: any }) {
  const tracking = plan.requirementTracking ?? [];
  if (!tracking.length) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        No structured requirements are available for this program yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tracking.map((category: any) => {
        const pct = category.totalCount > 0 ? (category.satisfiedCount / category.totalCount) * 100 : category.complete ? 100 : 0;
        return (
          <div key={`${category.programId}-${category.categoryId}`} className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary" />
                  {category.categoryName}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">{category.programName}</p>
              </div>
              <Badge variant="secondary" className={category.complete ? "bg-green-500/15 text-green-300" : "bg-amber-500/15 text-amber-300"}>
                {category.complete ? "Complete" : "Open"}
              </Badge>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {category.satisfiedCount}/{category.totalCount} listed courses satisfied · {category.creditsRequired} credits expected
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ElectiveRecommendations({ planId }: { planId: number }) {
  const { data: electives, isLoading } = trpc.plans.recommendElectives.useQuery({ planId, limit: 8 });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-primary" />
        Requirement-Aware Elective Picker
      </h3>
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      ) : electives?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {electives.map((course: any) => (
            <div key={course.id} className="rounded-lg border border-border bg-secondary/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-mono text-xs text-primary">{course.code}</div>
                <Badge variant="secondary" className="text-xs">{course.credits} cr</Badge>
              </div>
              <div className="font-medium text-sm mt-1">{course.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{course.reason}</div>
              <div className="text-xs text-muted-foreground mt-2">
                Offered: {course.availableTerms.join(", ") || "unknown"} · Difficulty {course.difficultyLevel}/5
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No elective recommendations available yet.</p>
      )}
    </div>
  );
}

function AdvisorReportPanel({ planId }: { planId: number }) {
  const [report, setReport] = useState<string>("");
  const advisorReport = trpc.plans.advisorReport.useQuery({ planId }, { enabled: false });

  const loadReport = async () => {
    const result = await advisorReport.refetch();
    if (result.data?.markdown) setReport(result.data.markdown);
  };

  const printReport = () => {
    const html = `<!DOCTYPE html><html><head><title>Advisor Report</title><style>${ADVISOR_PRINT_STYLES}</style></head><body><header><span>ACADEMIQ / ADVISOR BRIEF</span><h1>Plan validation</h1></header><main class="report">${report.replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch))}</main></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) setTimeout(() => win.print(), 500);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          Advisor-Grade Validation Report
        </h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="bg-secondary/50" onClick={loadReport} disabled={advisorReport.isFetching}>
            {advisorReport.isFetching ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ClipboardList className="w-4 h-4 mr-2" />}
            Generate
          </Button>
          {report && (
            <Button size="sm" onClick={printReport}>
              <Download className="w-4 h-4 mr-2" />
              Print
            </Button>
          )}
        </div>
      </div>
      {report ? (
        <pre className="max-h-96 overflow-auto rounded-lg border border-border bg-secondary/20 p-4 text-xs whitespace-pre-wrap">{report}</pre>
      ) : (
        <p className="text-sm text-muted-foreground">Generate a concise audit with issues, requirement status, assumptions, and advisor questions.</p>
      )}
    </div>
  );
}

function ProgressControls({ plan, completedCourseIds, onToggle, pendingCourseId }: {
  plan: any;
  completedCourseIds: number[];
  onToggle: (courseId: number, completed: boolean) => void;
  pendingCourseId?: number;
}) {
  const completed = new Set(completedCourseIds ?? []);
  const courses = plan.semesters.flatMap((sem: any) => sem.courses).filter((pc: any) => pc.course && pc.courseId > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        <CheckSquare className="w-4 h-4 text-primary" />
        Student Progress Mode
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {courses.map((pc: any) => {
          const isDone = completed.has(pc.courseId);
          return (
            <button
              key={pc.planCourseId}
              onClick={() => onToggle(pc.courseId, !isDone)}
              disabled={pendingCourseId === pc.courseId}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                isDone ? "border-green-500/30 bg-green-500/10" : "border-border bg-secondary/20 hover:border-primary/40"
              }`}
            >
              {isDone ? <CheckSquare className="w-4 h-4 text-green-300" /> : <Square className="w-4 h-4 text-muted-foreground" />}
              <span className="font-mono text-xs text-primary">{pc.course.code}</span>
              <span className="truncate">{pc.course.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { label: string; className: string }> = {
    planned: { label: "Planned", className: "bg-muted text-muted-foreground" },
    enrolled: { label: "Enrolled", className: "bg-primary/15 text-primary" },
    completed: { label: "Completed", className: "bg-green-500/15 text-green-400" },
    dropped: { label: "Dropped", className: "bg-orange-500/15 text-orange-400" },
    failed: { label: "Failed", className: "bg-destructive/15 text-destructive" },
    waived: { label: "Waived", className: "bg-purple-500/15 text-purple-400" },
  };
  const cfg = configs[status] ?? configs.planned;
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
}

function WorkloadHeatmap({ semesters }: { semesters: any[] }) {
  const maxWorkload = Math.max(...semesters.map(s => s.workloadScore ?? 0), 1);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        Workload Heatmap
      </h3>
      <div className="space-y-3">
        {semesters.map(sem => {
          const pct = ((sem.workloadScore ?? 0) / 10) * 100;
          const color =
            sem.workloadScore < 4 ? 'oklch(0.72 0.18 150)' :
            sem.workloadScore < 6 ? 'oklch(0.75 0.18 80)' :
            sem.workloadScore < 8 ? 'oklch(0.70 0.22 50)' : 'oklch(0.60 0.22 25)';

          return (
            <div key={sem.id} className="flex items-center gap-3">
              <div className="w-24 text-xs text-muted-foreground capitalize shrink-0">
                {sem.term} {sem.year}
              </div>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: color }}
                />
              </div>
              <div className="w-10 text-xs text-right text-muted-foreground">
                {sem.workloadScore?.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'oklch(0.72 0.18 150)' }} />Low</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'oklch(0.75 0.18 80)' }} />Medium</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'oklch(0.70 0.22 50)' }} />High</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm" style={{ background: 'oklch(0.60 0.22 25)' }} />Very High</span>
      </div>
    </div>
  );
}

function DifficultyChart({ semesters }: { semesters: any[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        Difficulty Distribution
      </h3>
      <div className="space-y-3">
        {semesters.map(sem => {
          const pct = ((sem.difficultyScore ?? 0) / 10) * 100;
          return (
            <div key={sem.id} className="flex items-center gap-3">
              <div className="w-24 text-xs text-muted-foreground capitalize shrink-0">
                {sem.term} {sem.year}
              </div>
              <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: 'oklch(0.65 0.22 270)' }}
                />
              </div>
              <div className="w-10 text-xs text-right text-muted-foreground">
                {sem.difficultyScore?.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PlanView() {
  const params = useParams<{ id: string }>();
  const planId = parseInt(params.id ?? '0');
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();

  const { data: plan, isLoading, refetch } = trpc.plans.get.useQuery(
    { planId },
    { enabled: isAuthenticated && !!planId }
  );
  const { data: profile, refetch: refetchProfile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const replanMutation = trpc.plans.replan.useMutation({
    onSuccess: (data) => {
      toast.success("Plan updated! " + data.impactSummary);
      if (data.newPlanId) navigate(`/plan/${data.newPlanId}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const moveCourseMutation = trpc.plans.moveCourse.useMutation({
    onSuccess: () => {
      toast.success("Course moved. Plan health has been rechecked.");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateProgressMutation = trpc.plans.updateProgress.useMutation({
    onSuccess: () => {
      toast.success("Progress updated. Future plan generation will respect completed courses.");
      refetchProfile();
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const exportPdfMutation = trpc.plans.exportPdf.useMutation({
    onSuccess: (data) => {
      const esc = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] ?? ch));
      const issues = data.health?.issues ?? [];
      const html = `<!DOCTYPE html><html><head><title>${esc(data.planName)}</title><style>${PLAN_PRINT_STYLES}</style></head><body><div class="folio">ACADEMIQ / DEGREE DESK EXPORT</div><h1>${esc(data.planName)}</h1><div class="meta">Graduation: ${esc(data.estimatedGraduation)} | ${data.totalCredits}/${data.targetCredits} credits | ${data.totalSemesters} semesters | Generated ${new Date(data.generatedAt).toLocaleDateString()}</div><div class="grid"><div class="box"><div class="val">${(data.scores as any).workload?.toFixed(1)}</div><div class="lbl">Workload</div></div><div class="box"><div class="val">${(data.scores as any).difficulty?.toFixed(1)}</div><div class="lbl">Difficulty</div></div><div class="box"><div class="val">${(data.scores as any).careerReadiness?.toFixed(1)}</div><div class="lbl">Career</div></div><div class="box"><div class="val">${(data.scores as any).overall?.toFixed(1)}</div><div class="lbl">Overall</div></div></div><div class="section"><h2>Plan Health</h2>${issues.length ? issues.map((i: any) => `<div class="issue"><strong>${esc(i.title)}</strong><br>${esc(i.detail)}</div>`).join("") : "<p>No issues detected.</p>"}</div><div class="section"><h2>Requirement Tracking</h2>${(data.requirementTracking ?? []).map((r: any) => `<div class="req"><span>${esc(r.programName)}: ${esc(r.categoryName)}</span><span>${r.satisfiedCount}/${r.totalCount} ${r.complete ? "complete" : "open"}</span></div>`).join("")}</div><div class="section"><h2>Semester Schedule</h2>${data.semesters.map(s => `<div class="semester"><h3>${esc(s.term.charAt(0).toUpperCase()+s.term.slice(1))} ${s.year} — ${s.totalCredits} credits</h3>${s.courses.map((c: any) => `<div class="course"><span>${esc(c.code)}</span><span>${esc(c.name)}</span><span>${c.credits ?? 0} cr</span><span>${esc(c.status)}</span></div>`).join('')}</div>`).join('')}</div></body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const win = window.open(url, '_blank');
      if (win) setTimeout(() => win.print(), 600);
      toast.success('PDF export ready — use Print → Save as PDF in the new tab');
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (!hasLoginConfig()) return;
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Plan not found</h2>
          <Button onClick={() => navigate("/dashboard")}>Back to Dashboard</Button>
        </div>
      </div>
    );
  }

  const variantLabels: Record<string, { label: string; emoji: string }> = {
    fastest_path: { label: "Fastest Path", emoji: "⚡" },
    lowest_stress_path: { label: "Lowest Stress Path", emoji: "🌿" },
    most_flexible_path: { label: "Most Flexible Path", emoji: "🔀" },
    custom: { label: "Custom Plan", emoji: "✏️" },
  };
  const variant = variantLabels[plan.variantType] ?? variantLabels.custom;
  const scores = plan.scores as { workload: number; difficulty: number; flexibility: number; careerReadiness: number; overall: number };

  const handleExportPDF = () => exportPdfMutation.mutate({ planId });
  const handleMoveCourse = (planCourseId: number, targetSemesterId: number) => {
    moveCourseMutation.mutate({ planCourseId, targetSemesterId });
  };
  const handleProgressToggle = (courseId: number, completed: boolean) => {
    updateProgressMutation.mutate({ courseId, completed });
  };

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
              <div className="text-xs text-muted-foreground">Plan View</div>
            </div>
          </div>
        </div>
        <div className="px-3 py-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-all w-full"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>
        </div>
      </div>

      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8 max-w-5xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{variant.emoji}</span>
                <h1 className="text-2xl font-bold">{plan.name}</h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{plan.totalSemesters} semesters</span>
                <span>{plan.totalCredits} credits</span>
                <span>Graduation: {plan.estimatedGraduationSemester} {plan.estimatedGraduationYear}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportPDF} className="bg-secondary/50">
                <Download className="w-4 h-4 mr-2" /> Export PDF
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-secondary/50"
                onClick={() => navigate("/scenarios")}
              >
                <RefreshCw className="w-4 h-4 mr-2" /> Simulate
              </Button>
            </div>
          </div>

          {/* Score cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {[
              { label: "Workload Balance", value: scores.workload, color: "oklch(0.70 0.18 200)" },
              { label: "Difficulty Balance", value: scores.difficulty, color: "oklch(0.72 0.18 150)" },
              { label: "Flexibility", value: scores.flexibility, color: "oklch(0.75 0.18 50)" },
              { label: "Career Readiness", value: scores.careerReadiness, color: "oklch(0.65 0.22 270)" },
            ].map(score => (
              <div key={score.label} className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs text-muted-foreground mb-2">{score.label}</div>
                <div className="text-2xl font-bold mb-2" style={{ color: score.color }}>{score.value.toFixed(1)}</div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(score.value / 10) * 100}%`, background: score.color }} />
                </div>
              </div>
            ))}
          </div>

          <Tabs defaultValue="schedule">
            <TabsList className="bg-secondary/50 mb-6">
              <TabsTrigger value="schedule">Schedule</TabsTrigger>
              <TabsTrigger value="health">Plan Health</TabsTrigger>
              <TabsTrigger value="requirements">Requirements</TabsTrigger>
              <TabsTrigger value="electives">Electives</TabsTrigger>
              <TabsTrigger value="progress">Progress</TabsTrigger>
              <TabsTrigger value="advisor">Advisor Report</TabsTrigger>
              <TabsTrigger value="catalog">Catalog Import</TabsTrigger>
              <TabsTrigger value="heatmap">Workload Heatmap</TabsTrigger>
              <TabsTrigger value="graph">Prerequisite Graph</TabsTrigger>
            </TabsList>

            <TabsContent value="schedule">
              <div className="rounded-xl border border-border bg-card p-4 mb-4 flex items-center gap-3 text-sm text-muted-foreground">
                <ArrowUpDown className="w-4 h-4 text-primary" />
                Move a course to another semester with the selector on its row. Health checks refresh automatically after each move.
              </div>
              <div className="space-y-4">
                {plan.semesters.map((sem: any) => (
                  <SemesterCard
                    key={sem.id}
                    semester={sem}
                    courses={sem.courses}
                    semesters={plan.semesters}
                    onMoveCourse={handleMoveCourse}
                    movingCourse={moveCourseMutation.variables?.planCourseId}
                  />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="health">
              <PlanHealthPanel plan={plan} />
            </TabsContent>

            <TabsContent value="requirements">
              <RequirementTracker plan={plan} />
            </TabsContent>

            <TabsContent value="electives">
              <ElectiveRecommendations planId={planId} />
            </TabsContent>

            <TabsContent value="progress">
              <ProgressControls
                plan={plan}
                completedCourseIds={profile?.completedCourseIds ?? []}
                onToggle={handleProgressToggle}
                pendingCourseId={updateProgressMutation.variables?.courseId}
              />
            </TabsContent>

            <TabsContent value="advisor">
              <AdvisorReportPanel planId={planId} />
            </TabsContent>

            <TabsContent value="catalog">
              <CatalogImportPanel />
            </TabsContent>

            <TabsContent value="heatmap">
              <div className="space-y-4">
                <WorkloadHeatmap semesters={plan.semesters} />
                <DifficultyChart semesters={plan.semesters} />
              </div>
            </TabsContent>

            <TabsContent value="graph">
              <PrerequisiteGraphView plan={plan} />
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}

function PrerequisiteGraphView({ plan }: { plan: any }) {
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const { data: profile } = trpc.profile.get.useQuery();
  const { data: graphData, isLoading } = trpc.courses.getGraph.useQuery(
    { schoolId: profile?.schoolId ?? 1, programId: profile?.primaryMajorId ?? undefined },
    { enabled: !!profile?.schoolId }
  );

  if (isLoading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  if (!graphData) return null;

  // Group nodes by level
  const levels: Record<number, typeof graphData.nodes> = {};
  for (const node of graphData.nodes) {
    if (!levels[node.level]) levels[node.level] = [];
    levels[node.level].push(node);
  }

  const plannedCourseIds = new Set(
    plan.semesters.flatMap((s: any) => s.courses.map((c: any) => c.courseId))
  );
  const connectedCourseIds = new Set<number>();
  if (selectedCourseId) {
    for (const edge of graphData.edges) {
      if (edge.from === selectedCourseId) connectedCourseIds.add(edge.to);
      if (edge.to === selectedCourseId) connectedCourseIds.add(edge.from);
    }
  }
  const selectedNode = graphData.nodes.find(node => node.id === selectedCourseId);
  const prerequisiteNodes = selectedCourseId
    ? graphData.edges
        .filter(edge => edge.to === selectedCourseId)
        .map(edge => graphData.nodes.find(node => node.id === edge.from)?.label)
        .filter(Boolean)
    : [];
  const unlockNodes = selectedCourseId
    ? graphData.edges
        .filter(edge => edge.from === selectedCourseId)
        .map(edge => graphData.nodes.find(node => node.id === edge.to)?.label)
        .filter(Boolean)
    : [];

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" />
            Prerequisite Dependency Graph
          </h3>
          <p className="text-sm text-muted-foreground">
            Courses organized by prerequisite depth. Click a course to highlight its prerequisite chain.
          </p>
        </div>
        {selectedNode && (
          <div className="rounded-lg border border-border bg-secondary/30 p-3 min-w-56">
            <div className="font-mono text-sm text-primary">{selectedNode.label}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Prereqs: {prerequisiteNodes.length ? prerequisiteNodes.join(", ") : "none"}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Unlocks: {unlockNodes.length ? unlockNodes.join(", ") : "none"}
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <div className="flex gap-6 min-w-max pb-4">
          {Object.entries(levels)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([level, nodes]) => (
              <div key={level} className="flex flex-col gap-2 min-w-[140px]">
                <div className="text-xs text-muted-foreground text-center mb-2 font-medium">
                  Year {Math.floor(Number(level) / 2) + 1}
                </div>
                {nodes.map(node => {
                  const inPlan = plannedCourseIds.has(node.id);
                  const selected = selectedCourseId === node.id;
                  const connected = connectedCourseIds.has(node.id);
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelectedCourseId(selected ? null : node.id)}
                      className={`px-3 py-2 rounded-lg border text-xs transition-all text-left ${
                        selected
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : connected
                            ? 'border-primary/70 bg-primary/15 text-primary'
                            : inPlan
                              ? 'border-primary/50 bg-primary/10 text-primary'
                              : 'border-border bg-secondary/30 text-muted-foreground'
                      }`}
                    >
                      <div className="font-mono font-medium">{node.label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{node.credits}cr · D{node.difficulty}</div>
                    </button>
                  );
                })}
              </div>
            ))}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-primary/50 bg-primary/10" />
          In your plan
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border border-border bg-secondary/30" />
          Not in plan
        </span>
        <span className="flex items-center gap-1.5">
          <MoveRight className="w-3 h-3 text-primary" />
          Click a node for prerequisites and unlocked courses
        </span>
      </div>
    </div>
  );
}
