import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getLoginUrl, hasLoginConfig } from "@/const";
import {
  GraduationCap, Target, Loader2, CheckCircle2, Sparkles,
  Briefcase, BookOpen, TrendingUp, ArrowRight, Star, Check
} from "lucide-react";

export default function CareerPage() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [, navigate] = useLocation();
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);

  const { data: careerTracks, isLoading: tracksLoading } = trpc.careerTracks.list.useQuery();
  const { data: profile, refetch: refetchProfile } = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: plans } = trpc.plans.list.useQuery(undefined, { enabled: isAuthenticated });

  const updateProfile = trpc.profile.upsert.useMutation({
    onSuccess: () => {
      toast.success("Career track updated!");
      refetchProfile();
    },
    onError: (err) => toast.error(err.message),
  });

  useEffect(() => {
    if (profile?.careerTrackId) setSelectedTrackId(profile.careerTrackId);
  }, [profile]);

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

  const activePlan = plans?.find(p => p.isActive) ?? plans?.[0];
  const currentTrack = careerTracks?.find(t => t.id === profile?.careerTrackId);

  const handleSaveTrack = () => {
    if (!profile) return;
    updateProfile.mutate({
      careerTrackId: selectedTrackId ?? undefined,
      isSetupComplete: profile.isSetupComplete ?? true,
    });
  };

  const trackColors = [
    'oklch(0.65 0.22 270)',
    'oklch(0.70 0.18 200)',
    'oklch(0.72 0.18 150)',
    'oklch(0.75 0.18 50)',
    'oklch(0.65 0.22 25)',
    'oklch(0.68 0.20 310)',
    'oklch(0.70 0.18 180)',
    'oklch(0.72 0.16 240)',
    'oklch(0.68 0.20 290)',
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
                item.href === "/career"
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
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Career-Aware Optimization
            </h1>
            <p className="text-muted-foreground text-sm">
              Select a career track to prioritize relevant courses in your degree plan. The optimizer will surface courses that build the skills most valued for your chosen path.
            </p>
          </div>

          {/* Current track */}
          {currentTrack && (
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Target className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-0.5">Current Career Track</div>
                  <div className="font-semibold">{currentTrack.name}</div>
                  <div className="text-sm text-muted-foreground">{currentTrack.description}</div>
                </div>
                <Badge variant="secondary" className="ml-auto bg-primary/15 text-primary border-primary/20">Active</Badge>
              </div>
            </div>
          )}

          {/* Track selection */}
          {tracksLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">Available Career Tracks</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {careerTracks?.map((track, i) => {
                  const color = trackColors[i % trackColors.length];
                  const isSelected = selectedTrackId === track.id;
                  const isCurrent = profile?.careerTrackId === track.id;
                  const priorityCourses = (() => {
                    try { return JSON.parse(track.priorityCourseIdsJson ?? '[]') as number[]; } catch { return []; }
                  })();

                  return (
                    <button
                      key={track.id}
                      onClick={() => setSelectedTrackId(isSelected ? null : track.id)}
                      className={`w-full text-left rounded-xl border p-5 transition-all hover:border-primary/40 ${
                        isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}20` }}>
                            <Briefcase className="w-4 h-4" style={{ color }} />
                          </div>
                          <div>
                            <div className="font-semibold text-sm">{track.name}</div>
                            {isCurrent && (
                              <Badge variant="secondary" className="text-xs mt-0.5 bg-primary/15 text-primary border-primary/20">Current</Badge>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-primary shrink-0" />}
                      </div>

                      <p className="text-sm text-muted-foreground mb-3">{track.description}</p>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>{priorityCourses.length} priority courses</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedTrackId !== profile?.careerTrackId && (
                <div className="flex justify-end">
                  <Button
                    onClick={handleSaveTrack}
                    disabled={updateProfile.isPending}
                  >
                    {updateProfile.isPending ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Apply Career Track</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* How it works */}
          <div className="mt-8 rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              How Career-Aware Optimization Works
            </h3>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">1</div>
                <p>Each career track defines a set of priority courses — courses most relevant to that career path (e.g., Machine Learning for AI/ML, Corporate Finance for Investment Banking).</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">2</div>
                <p>The constraint optimizer scores each generated plan based on how early and how many priority courses appear in the schedule, boosting the career readiness score.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">3</div>
                <p>Plans are re-ranked to surface the variant that best prepares you for internships, grad school applications, or industry entry by the target semester.</p>
              </div>
              <div className="flex gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0 text-xs font-medium text-primary">4</div>
                <p>After changing your career track, regenerate your plans from the Dashboard to see the updated career readiness scores and course prioritization.</p>
              </div>
            </div>
            <div className="mt-4">
              <Button variant="outline" className="bg-secondary/50" onClick={() => navigate("/dashboard")}>
                <ArrowRight className="w-4 h-4 mr-2" /> Go to Dashboard to Regenerate Plans
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
