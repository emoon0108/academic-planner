import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, Loader2, Search, Database, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function ResearchAgentPage() {
  const [customTargets, setCustomTargets] = useState("Harvard University | Computer Science | https://csadvising.seas.harvard.edu/concentration/requirements/");
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.researchAgent.status.useQuery();
  const runAgent = trpc.researchAgent.runOnce.useMutation({
    onSuccess: async result => {
      toast.success(`Research cycle finished with ${result.updates.length} stored updates.`);
      await utils.researchAgent.status.invalidate();
    },
    onError: err => toast.error(err.message),
  });
  const approveImport = trpc.researchAgent.approveImport.useMutation({
    onSuccess: async result => {
      toast.success(`Imported ${result.courseCount} courses. The university is now available in setup.`);
      await utils.researchAgent.status.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const runCustom = () => {
    const targets = customTargets
      .split("\n")
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const [schoolName, majorName, ...sourceUrls] = line.split("|").map(part => part.trim());
        return {
          schoolName,
          majorName: majorName || "Computer Science",
          sourceUrls: sourceUrls.filter(Boolean),
        };
      })
      .filter(target => target.schoolName && target.majorName);
    runAgent.mutate({ targets });
  };

  const updates = data?.state.updates ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <div className="w-64 shrink-0 h-screen sticky top-0 flex flex-col border-r border-border bg-sidebar">
        <div className="px-5 py-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm text-sidebar-foreground">AcademiQ</div>
              <div className="text-xs text-muted-foreground">Research Agent</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/research-agent", label: "Research Agent" },
            { href: "/scenarios", label: "Scenario Simulation" },
            { href: "/chat", label: "AI Assistant" },
          ].map(item => (
            <Link key={item.href} href={item.href}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                item.href === "/research-agent"
                  ? "bg-sidebar-primary/15 text-sidebar-primary font-medium"
                  : "text-sidebar-foreground hover:bg-sidebar-accent"
              }`}>
                {item.label}
              </div>
            </Link>
          ))}
        </nav>
      </div>

      <main className="flex-1 overflow-auto">
        <div className="px-8 py-8 max-w-6xl">
          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-2xl font-bold mb-1 flex items-center gap-2">
                <Search className="w-6 h-6 text-primary" />
                Catalog Research Agent
              </h1>
              <p className="text-sm text-muted-foreground">
                Continuously discovers official university catalog sources and turns them into reviewable degree updates.
              </p>
            </div>
            <Button onClick={() => runAgent.mutate({})} disabled={runAgent.isPending}>
              {runAgent.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Run Watchlist
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-3">Custom Targets</h2>
                <p className="text-xs text-muted-foreground mb-3">One per line: School | Major | official requirements URL.</p>
                <textarea
                  value={customTargets}
                  onChange={event => setCustomTargets(event.target.value)}
                  className="min-h-36 w-full rounded-lg border border-border bg-secondary/30 p-3 text-sm outline-none focus:border-primary"
                />
                <Button className="mt-3 w-full" variant="outline" onClick={runCustom} disabled={runAgent.isPending}>
                  <Database className="w-4 h-4 mr-2" />
                  Research Custom Targets
                </Button>
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-3">Default Watchlist</h2>
                <div className="space-y-2">
                  {data?.watchlist.map(target => (
                    <div key={`${target.schoolName}-${target.majorName}`} className="rounded-lg border border-border bg-secondary/20 p-3">
                      <div className="text-sm font-medium">{target.schoolName}</div>
                      <div className="text-xs text-muted-foreground">{target.majorName}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {isLoading ? (
                <div className="rounded-xl border border-border bg-card p-8 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : updates.length ? (
                updates.map(update => (
                  <div key={update.id} className="rounded-xl border border-border bg-card p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <h2 className="font-semibold">{update.schoolName}</h2>
                        <p className="text-sm text-muted-foreground">{update.majorName} · {new Date(update.createdAt).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {update.importedAt && (
                          <Badge variant="secondary" className="bg-primary/15 text-primary">Imported</Badge>
                        )}
                        <Badge variant="secondary" className={
                          update.confidence === "high"
                            ? "bg-green-500/15 text-green-300"
                            : update.confidence === "medium"
                              ? "bg-amber-500/15 text-amber-300"
                              : "bg-muted text-muted-foreground"
                        }>
                          {update.confidence} confidence
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <div className="text-xl font-bold">{update.sources.length}</div>
                        <div className="text-xs text-muted-foreground">official sources</div>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <div className="text-xl font-bold">{update.structuredRequirements?.length ?? 0}</div>
                        <div className="text-xs text-muted-foreground">requirement groups</div>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <div className="text-xl font-bold">{update.extractedCourses.length}</div>
                        <div className="text-xs text-muted-foreground">course hints</div>
                      </div>
                      <div className="rounded-lg bg-secondary/20 p-3">
                        <div className="text-xl font-bold">{update.requirementHints.length}</div>
                        <div className="text-xs text-muted-foreground">requirement hints</div>
                      </div>
                    </div>

                    {update.sources.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-medium mb-2">Sources</h3>
                        <div className="space-y-2">
                          {update.sources.map(source => (
                            <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                              <ExternalLink className="w-3.5 h-3.5" />
                              {source.title}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {update.notes.length > 0 && (
                      <div className="mb-4 rounded-lg border border-border bg-secondary/20 p-3">
                        <h3 className="text-sm font-medium mb-2">What happened</h3>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {update.notes.slice(0, 4).map((note, index) => (
                            <li key={index}>{note}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(update.structuredRequirements?.length ?? 0) > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-medium mb-2">Structured Requirements</h3>
                        <div className="space-y-2">
                          {update.structuredRequirements?.slice(0, 4).map(category => (
                            <div key={`${category.name}-${category.sourceUrl}`} className="rounded-lg border border-border bg-secondary/20 p-3">
                              <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-sm font-medium">{category.name}</span>
                                <Badge variant="outline" className="text-xs">{category.type.replace(/_/g, " ")}</Badge>
                                {category.creditsRequired && (
                                  <span className="text-xs text-muted-foreground">{category.creditsRequired} credits</span>
                                )}
                              </div>
                              {category.rules.length > 0 && (
                                <p className="text-xs text-muted-foreground mb-2">{category.rules[0]}</p>
                              )}
                              <div className="flex flex-wrap gap-1.5">
                                {category.courses.slice(0, 10).map(course => (
                                  <span key={course.code} className="rounded border border-border px-2 py-1 font-mono text-xs text-primary">
                                    {course.code}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {update.extractedCourses.length > 0 && (
                      <div className="mb-4">
                        <h3 className="text-sm font-medium mb-2">Extracted Course Hints</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {update.extractedCourses.slice(0, 8).map(course => (
                            <div key={`${course.code}-${course.sourceUrl}`} className="rounded-lg border border-border bg-secondary/20 p-2 text-sm">
                              <span className="font-mono text-primary mr-2">{course.code}</span>
                              {course.name}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {update.requirementHints.length > 0 && (
                      <div>
                        <h3 className="text-sm font-medium mb-2">Requirement Hints</h3>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {update.requirementHints.slice(0, 5).map((hint, index) => (
                            <li key={index}>{hint}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
                      <p className="text-xs text-muted-foreground">
                        Approving creates/reuses the school, major, courses, and a researched core requirement category.
                      </p>
                      <Button
                        size="sm"
                        disabled={Boolean(update.importedAt) || update.extractedCourses.length === 0 || approveImport.isPending}
                        onClick={() => approveImport.mutate({ updateId: update.id })}
                      >
                        {approveImport.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                        Approve Import
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
                  <Search className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                  <h2 className="font-semibold mb-2">No research updates yet</h2>
                  <p className="text-sm text-muted-foreground">Run the watchlist or add custom targets to collect official catalog evidence.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
