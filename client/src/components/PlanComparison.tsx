import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, BarChart3, Calendar, BookOpen, Target, Zap, Leaf, Shuffle } from "lucide-react";
import { useLocation } from "wouter";

interface PlanComparisonProps {
  plans: any[];
}

const VARIANT_META: Record<string, { label: string; emoji: string; color: string; icon: React.ElementType }> = {
  fastest_path: { label: "Fastest Path", emoji: "⚡", color: "oklch(0.65 0.22 270)", icon: Zap },
  lowest_stress_path: { label: "Lowest Stress Path", emoji: "🌿", color: "oklch(0.72 0.18 150)", icon: Leaf },
  most_flexible_path: { label: "Most Flexible Path", emoji: "🔀", color: "oklch(0.75 0.18 50)", icon: Shuffle },
  custom: { label: "Custom Plan", emoji: "✏️", color: "oklch(0.70 0.18 200)", icon: Target },
};

const SCORE_LABELS = [
  { key: "workload", label: "Workload Balance", desc: "How evenly distributed the workload is" },
  { key: "difficulty", label: "Difficulty Balance", desc: "How well difficulty is spread across semesters" },
  { key: "flexibility", label: "Scheduling Flexibility", desc: "How many elective and scheduling options remain" },
  { key: "careerReadiness", label: "Career Readiness", desc: "How well the plan aligns with your career track" },
  { key: "overall", label: "Overall Score", desc: "Weighted composite score" },
];

export function PlanComparison({ plans }: PlanComparisonProps) {
  const [, navigate] = useLocation();
  const setActivePlan = trpc.plans.setActive.useMutation();

  if (plans.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Plan Comparison
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">Side-by-side comparison of all generated plan variants</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground w-40">Metric</th>
              {plans.map(plan => {
                const meta = VARIANT_META[plan.variantType] ?? VARIANT_META.custom;
                return (
                  <th key={plan.id} className="text-center px-4 py-3 min-w-[160px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xl">{meta.emoji}</span>
                      <span className="text-sm font-semibold">{meta.label}</span>
                      {plan.isActive && (
                        <Badge variant="secondary" className="text-xs bg-primary/15 text-primary border-primary/20">Active</Badge>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* Basic metrics */}
            {[
              { label: "Total Semesters", key: "totalSemesters", format: (v: any) => `${v} semesters` },
              { label: "Total Credits", key: "totalCredits", format: (v: any) => `${v} credits` },
              { label: "Graduation", key: "grad", format: (_: any, plan: any) => `${plan.estimatedGraduationSemester} ${plan.estimatedGraduationYear}` },
            ].map(row => (
              <tr key={row.label} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                <td className="px-6 py-3 text-sm text-muted-foreground">{row.label}</td>
                {plans.map(plan => (
                  <td key={plan.id} className="px-4 py-3 text-center text-sm font-medium">
                    {row.format(plan[row.key], plan)}
                  </td>
                ))}
              </tr>
            ))}

            {/* Score rows */}
            {SCORE_LABELS.map(score => (
              <tr key={score.key} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                <td className="px-6 py-3">
                  <div className="text-sm text-muted-foreground">{score.label}</div>
                </td>
                {plans.map(plan => {
                  const scores = plan.scores as Record<string, number>;
                  const value = scores?.[score.key] ?? 0;
                  const pct = (value / 10) * 100;
                  const meta = VARIANT_META[plan.variantType] ?? VARIANT_META.custom;
                  return (
                    <td key={plan.id} className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold">{value.toFixed(1)}</span>
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.color }} />
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Actions */}
            <tr>
              <td className="px-6 py-4 text-sm text-muted-foreground">Actions</td>
              {plans.map(plan => (
                <td key={plan.id} className="px-4 py-4 text-center">
                  <div className="flex flex-col gap-2 items-center">
                    <Button size="sm" onClick={() => navigate(`/plan/${plan.id}`)}>
                      View Plan
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
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
