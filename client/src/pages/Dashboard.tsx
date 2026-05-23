import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getLoginUrl, hasLoginConfig } from "@/const";
import {
  GraduationCap, LayoutDashboard, GitBranch, BarChart3,
  MessageSquare, Target, Zap, LogOut, Settings, Plus,
  Loader2, ChevronRight, BookOpen, Calendar, TrendingUp,
  RefreshCw, Sparkles, ArrowRight, User, FlaskConical,
  Trash2, RotateCcw, AlertTriangle, Search
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { PlanComparison } from "@/components/PlanComparison";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/career", label: "Career Tracks", icon: Target },
  { href: "/scenarios", label: "Scenario Simulation", icon: FlaskConical },
  { href: "/chat", label: "AI Assistant", icon: MessageSquare },
  { href: "/research-agent", label: "Research Agent", icon: Search },
];

const SETTINGS_NAV = [
  { href: "/setup", label: "Edit Profile & AP Credits", icon: Settings },
];

function Sidebar({ currentPath, onReset, onDelete, resetPending, deletePending }: {
  currentPath: string;
  onReset: () => void;
  onDelete: () => void;
  resetPending: boolean;
  deletePending: boolean;
}) {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();

  return (
    <div className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-border bg-sidebar">
      {/* Logo */}
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

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(item => {
          const active = currentPath === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                active
                  ? 'bg-sidebar-primary/15 text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}>
                <item.icon className="w-4 h-4 shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
        {/* Settings section */}
        <div className="pt-2 mt-2 border-t border-sidebar-border/50">
          <div className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide px-3 mb-1">Settings</div>
          {SETTINGS_NAV.map(item => {
            const active = currentPath === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                  active
                    ? 'bg-sidebar-primary/15 text-sidebar-primary font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}>
                  <item.icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-sidebar-border space-y-1">
        <div className="px-3 py-2 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-sidebar-foreground truncate">{user?.name ?? 'Student'}</div>
            <div className="text-xs text-muted-foreground truncate">{user?.email ?? ''}</div>
          </div>
        </div>
        <button
          onClick={() => { logout(); navigate("/"); }}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
        {/* Account management — shown only when the full dashboard is rendered */}
        <div className="pt-1 border-t border-sidebar-border/50 mt-1 space-y-0.5">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground/70 hover:text-amber-400 hover:bg-amber-400/10 transition-all">
                <RotateCcw className="w-3.5 h-3.5" />
                Reset account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  Reset your account?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all your degree plans, scenarios, chat history, and profile settings.
                  Your login will be preserved so you can start fresh. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                  onClick={onReset}
                  disabled={resetPending}
                >
                  {resetPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, reset everything"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
                Delete account
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  Delete your account?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently and irreversibly delete your account, all degree plans, scenarios, chat history,
                  and profile data. You will be logged out immediately. There is no way to recover this data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  onClick={onDelete}
                  disabled={deletePending}
                >
                  {deletePending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Yes, delete my account"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated, loading: authLoading, logout } = useAuth();
  const [, navigate] = useLocation();
  const [generatingPlans, setGeneratingPlans] = useState(false);
  const utils = trpc.useUtils();

  const resetAccount = trpc.auth.resetAccount.useMutation({
    onSuccess: () => {
      toast.success("Account reset — all plans and data have been cleared.");
      utils.profile.get.invalidate();
      utils.plans.list.invalidate();
      navigate("/setup");
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteAccount = trpc.auth.deleteAccount.useMutation({
    onSuccess: () => {
      toast.success("Account deleted. Goodbye!");
      logout();
      navigate("/");
    },
    onError: (err) => toast.error(err.message),
  });

  const { data: profile, isLoading: profileLoading } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: plans, isLoading: plansLoading, refetch: refetchPlans } = trpc.plans.list.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const { data: careerTracks } = trpc.careerTracks.list.useQuery();

  const generatePlans = trpc.plans.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`Generated ${data.plans.length} degree plan variants!`);
      refetchPlans();
      setGeneratingPlans(false);
    },
    onError: (err) => {
      toast.error(err.message);
      setGeneratingPlans(false);
    },
  });

  const setActivePlan = trpc.plans.setActive.useMutation({
    onSuccess: () => {
      toast.success("Active plan updated");
      refetchPlans();
    },
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      if (!hasLoginConfig()) return;
      window.location.href = getLoginUrl();
    }
  }, [authLoading, isAuthenticated]);

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile?.isSetupComplete) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <GraduationCap className="w-16 h-16 text-primary mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-3">Complete Your Profile</h1>
          <p className="text-muted-foreground mb-6">Set up your student profile to generate your personalized degree plans.</p>
          <Button onClick={() => navigate("/setup")} size="lg">
            Start Setup <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  const activePlan = plans?.find(p => p.isActive) ?? plans?.[0];
  const careerTrack = careerTracks?.find(t => t.id === profile.careerTrackId);

  const variantLabels: Record<string, { label: string; emoji: string; color: string }> = {
    fastest_path: { label: "Fastest Path", emoji: "⚡", color: "oklch(0.65 0.22 270)" },
    lowest_stress_path: { label: "Lowest Stress Path", emoji: "🌿", color: "oklch(0.72 0.18 150)" },
    most_flexible_path: { label: "Most Flexible Path", emoji: "🔀", color: "oklch(0.75 0.18 50)" },
    custom: { label: "Custom Plan", emoji: "✏️", color: "oklch(0.70 0.18 200)" },
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar
        currentPath="/dashboard"
        onReset={() => resetAccount.mutate()}
        onDelete={() => deleteAccount.mutate()}
        resetPending={resetAccount.isPending}
        deletePending={deleteAccount.isPending}
      />

      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8 max-w-5xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
              <p className="text-muted-foreground text-sm">
                {profile.primaryMajorId ? `Your academic plan overview` : 'Welcome to AcademiQ'}
              </p>
            </div>
            <Button
              onClick={() => { setGeneratingPlans(true); generatePlans.mutate({ save: true }); }}
              disabled={generatePlans.isPending || generatingPlans}
            >
              {generatePlans.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Generate Plans</>
              )}
            </Button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "Active Plan",
                value: activePlan ? variantLabels[activePlan.variantType]?.emoji + ' ' + variantLabels[activePlan.variantType]?.label : "None",
                icon: BookOpen,
                color: "oklch(0.65 0.22 270)",
              },
              {
                label: "Graduation",
                value: activePlan ? `${activePlan.estimatedGraduationSemester?.charAt(0).toUpperCase()}${activePlan.estimatedGraduationSemester?.slice(1)} ${activePlan.estimatedGraduationYear}` : "—",
                icon: Calendar,
                color: "oklch(0.70 0.18 200)",
              },
              {
                label: "Total Credits",
                value: activePlan ? `${activePlan.totalCredits}` : "—",
                icon: TrendingUp,
                color: "oklch(0.72 0.18 150)",
              },
              {
                label: "Career Track",
                value: careerTrack?.name ?? "Not set",
                icon: Target,
                color: "oklch(0.75 0.18 50)",
              },
            ].map(stat => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${stat.color}20` }}>
                    <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
                  </div>
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-sm font-semibold truncate">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Plans */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Degree Plans</h2>
              {plans && plans.length > 0 && (
                <span className="text-sm text-muted-foreground">{plans.length} plan{plans.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {plansLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : plans && plans.length > 0 ? (
              <div className="space-y-3">
                {plans.map(plan => {
                  const variant = variantLabels[plan.variantType] ?? variantLabels.custom;
                  const scores = plan.scores as { workload: number; difficulty: number; flexibility: number; careerReadiness: number; overall: number };
                  return (
                    <div
                      key={plan.id}
                      className={`rounded-xl border bg-card p-5 transition-all hover:border-primary/40 ${plan.isActive ? 'border-primary/50 bg-primary/5' : 'border-border'}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{variant.emoji}</span>
                            <h3 className="font-semibold">{plan.name}</h3>
                            {plan.isActive && <Badge variant="secondary" className="text-xs bg-primary/15 text-primary border-primary/20">Active</Badge>}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{plan.totalSemesters} semesters</span>
                            <span>{plan.totalCredits} credits</span>
                            <span>Grad: {plan.estimatedGraduationSemester} {plan.estimatedGraduationYear}</span>
                          </div>
                          {/* Score bars */}
                          <div className="mt-3 grid grid-cols-4 gap-3">
                            {[
                              { label: "Workload", value: scores.workload, color: "oklch(0.70 0.18 200)" },
                              { label: "Difficulty", value: scores.difficulty, color: "oklch(0.72 0.18 150)" },
                              { label: "Flexibility", value: scores.flexibility, color: "oklch(0.75 0.18 50)" },
                              { label: "Career", value: scores.careerReadiness, color: "oklch(0.65 0.22 270)" },
                            ].map(score => (
                              <div key={score.label}>
                                <div className="text-xs text-muted-foreground mb-1">{score.label}</div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all"
                                    style={{ width: `${(score.value / 10) * 100}%`, background: score.color }}
                                  />
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">{score.value.toFixed(1)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => navigate(`/plan/${plan.id}`)}
                          >
                            View Plan <ChevronRight className="w-3.5 h-3.5 ml-1" />
                          </Button>
                          {!plan.isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="bg-secondary/50"
                              onClick={() => setActivePlan.mutate({ planId: plan.id })}
                            >
                              Set Active
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
                <Sparkles className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No plans yet</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Click "Generate Plans" to create your personalized degree plan variants.
                </p>
                <Button
                  onClick={() => { setGeneratingPlans(true); generatePlans.mutate({ save: true }); }}
                  disabled={generatePlans.isPending}
                >
                  {generatePlans.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Generate My Plans
                </Button>
              </div>
            )}
          </div>

          {/* Plan Comparison */}
          {plans && plans.length > 1 && (
            <div className="mb-8">
              <PlanComparison plans={plans} />
            </div>
          )}

          {/* Quick actions */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Scenario Simulation", desc: "What if I drop a class?", icon: FlaskConical, href: "/scenarios", color: "oklch(0.65 0.22 270)" },
                { label: "Career Optimization", desc: "Align courses with your goals", icon: Target, href: "/career", color: "oklch(0.70 0.18 200)" },
                { label: "Research Agent", desc: "Find official degree requirements", icon: Search, href: "/research-agent", color: "oklch(0.72 0.18 150)" },
              ].map(action => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.href)}
                  className="rounded-xl border border-border bg-card p-5 text-left hover:border-primary/40 transition-all group"
                >
                  <div className="w-9 h-9 rounded-lg mb-3 flex items-center justify-center" style={{ background: `${action.color}20` }}>
                    <action.icon className="w-5 h-5" style={{ color: action.color }} />
                  </div>
                  <div className="font-medium text-sm mb-1">{action.label}</div>
                  <div className="text-xs text-muted-foreground">{action.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
