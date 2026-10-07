import { useState } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, ExternalLink, FileText, FileUp, Globe2, GraduationCap, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

const MAX_FILE_BYTES = 8 * 1024 * 1024;

async function fileToBase64(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const chunks: string[] = [];
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    chunks.push(String.fromCharCode(...Array.from(bytes.subarray(offset, offset + chunkSize))));
  }
  return btoa(chunks.join(""));
}

function formatCheckedAt(value: string | null) {
  if (!value) return "Not retrieved";
  return `Checked ${new Date(value).toLocaleDateString()}`;
}

export default function ResearchAgentPage() {
  const [findSchool, setFindSchool] = useState("University of Michigan");
  const [findMajor, setFindMajor] = useState("Computer Science");
  const [websiteUrls, setWebsiteUrls] = useState("https://cse.engin.umich.edu/academics/undergraduate/programs/computer-science-eng/");
  const [importSchool, setImportSchool] = useState("University of Michigan");
  const [importMajor, setImportMajor] = useState("Computer Science");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
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
  const importSources = trpc.researchAgent.importSources.useMutation({
    onSuccess: async result => {
      const duplicateNote = result.duplicateCount > 0
        ? ` ${result.duplicateCount} duplicate${result.duplicateCount === 1 ? " was" : "s were"} skipped.`
        : "";
      toast.success(`Parsed ${result.update.sources.length} source${result.update.sources.length === 1 ? "" : "s"} into a reviewable update.${duplicateNote}`);
      setSelectedFiles([]);
      setFileInputKey(key => key + 1);
      await utils.researchAgent.status.invalidate();
    },
    onError: err => toast.error(err.message),
  });
  const scrapeUrls = trpc.researchAgent.scrapeUrls.useMutation({
    onSuccess: async result => {
      const failureNote = result.failures.length > 0 ? ` ${result.failures.length} URL${result.failures.length === 1 ? "" : "s"} failed.` : "";
      toast.success(`Added ${result.update.sources.length} website${result.update.sources.length === 1 ? "" : "s"} to the source library.${failureNote}`);
      await utils.researchAgent.status.invalidate();
    },
    onError: async err => {
      toast.error(err.message);
      await utils.researchAgent.status.invalidate();
    },
  });
  const refreshSource = trpc.researchAgent.refreshSource.useMutation({
    onSuccess: async () => {
      toast.success("Source refreshed and a new evidence review was created.");
      await utils.researchAgent.status.invalidate();
    },
    onError: async err => {
      toast.error(err.message);
      await utils.researchAgent.status.invalidate();
    },
  });
  const removeSource = trpc.researchAgent.removeSource.useMutation({
    onSuccess: async () => {
      toast.success("Source removed from the library.");
      await utils.researchAgent.status.invalidate();
    },
    onError: err => toast.error(err.message),
  });

  const runDiscovery = () => {
    if (!findSchool.trim() || !findMajor.trim()) return;
    runAgent.mutate({ targets: [{ schoolName: findSchool.trim(), majorName: findMajor.trim() }] });
  };

  const runWebsiteImport = () => {
    if (!findSchool.trim() || !findMajor.trim()) return;
    const urls = Array.from(new Set(websiteUrls.split("\n").map(value => value.trim()).filter(Boolean))).slice(0, 4);
    if (urls.length === 0) {
      toast.error("Add at least one website URL.");
      return;
    }
    if (urls.some(url => {
      try {
        const parsed = new URL(url);
        return parsed.protocol !== "http:" && parsed.protocol !== "https:";
      } catch {
        return true;
      }
    })) {
      toast.error("Every source must be a valid HTTP or HTTPS URL.");
      return;
    }
    scrapeUrls.mutate({ schoolName: findSchool.trim(), majorName: findMajor.trim(), urls });
  };

  const runImport = async () => {
    if (!importSchool.trim() || !importMajor.trim() || selectedFiles.length === 0) return;
    const oversized = selectedFiles.find(file => file.size > MAX_FILE_BYTES);
    if (oversized) {
      toast.error(`${oversized.name} is larger than 8 MB.`);
      return;
    }

    try {
      const files = await Promise.all(selectedFiles.map(async file => ({
        name: file.name,
        mimeType: file.type,
        dataBase64: await fileToBase64(file),
      })));
      importSources.mutate({
        schoolName: importSchool.trim(),
        majorName: importMajor.trim(),
        files,
      });
    } catch {
      toast.error("The selected files could not be read.");
    }
  };

  const updates = data?.state.updates ?? [];
  const librarySources = data?.library.sources ?? [];

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
              <div className="text-xs text-muted-foreground">Source workspace</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[
            { href: "/dashboard", label: "Dashboard" },
            { href: "/research-agent", label: "Sources" },
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
                Sources
              </h1>
              <p className="text-sm text-muted-foreground">
                Find official websites or import your own files, then review every extracted fact before it reaches a degree plan.
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
                <Tabs defaultValue="find">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="find"><Globe2 className="w-4 h-4" /> Find websites</TabsTrigger>
                    <TabsTrigger value="import"><FileUp className="w-4 h-4" /> Import files</TabsTrigger>
                  </TabsList>

                  <TabsContent value="find" className="pt-3">
                    <h2 className="font-semibold mb-2">Find official websites</h2>
                    <p className="text-xs text-muted-foreground mb-3">Search by program, or add up to four catalog URLs for direct extraction.</p>
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted-foreground">University</span>
                        <input
                          value={findSchool}
                          onChange={event => setFindSchool(event.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-secondary/30 px-3 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted-foreground">Program</span>
                        <input
                          value={findMajor}
                          onChange={event => setFindMajor(event.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-secondary/30 px-3 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted-foreground">Official URLs · one per line</span>
                        <textarea
                          value={websiteUrls}
                          onChange={event => setWebsiteUrls(event.target.value)}
                          className="min-h-24 w-full rounded-lg border border-border bg-secondary/30 p-3 text-xs outline-none focus:border-primary"
                        />
                      </label>
                    </div>
                    <Button className="mt-3 w-full" onClick={runWebsiteImport} disabled={scrapeUrls.isPending || !findSchool.trim() || !findMajor.trim()}>
                      {scrapeUrls.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Globe2 className="w-4 h-4 mr-2" />}
                      Add and extract websites
                    </Button>
                    <Button className="mt-2 w-full" variant="outline" onClick={runDiscovery} disabled={runAgent.isPending || !findSchool.trim() || !findMajor.trim()}>
                      {runAgent.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                      Search the web instead
                    </Button>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                      AcademiQ fetches one public page per URL, follows validated redirects, and blocks private-network addresses.
                    </p>
                  </TabsContent>

                  <TabsContent value="import" className="pt-3">
                    <h2 className="font-semibold mb-2">Import source files</h2>
                    <p className="text-xs text-muted-foreground mb-3">PDF, CSV, HTML, Markdown, or text. Up to four files, 8 MB each.</p>
                    <div className="space-y-3">
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted-foreground">University</span>
                        <input
                          value={importSchool}
                          onChange={event => setImportSchool(event.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-secondary/30 px-3 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-1 block text-xs text-muted-foreground">Program</span>
                        <input
                          value={importMajor}
                          onChange={event => setImportMajor(event.target.value)}
                          className="h-10 w-full rounded-lg border border-border bg-secondary/30 px-3 text-sm outline-none focus:border-primary"
                        />
                      </label>
                      <label className="block rounded-lg border border-dashed border-border bg-secondary/20 p-4 text-center cursor-pointer hover:border-primary/50">
                        <FileUp className="mx-auto mb-2 h-5 w-5 text-primary" />
                        <span className="text-sm">Choose source files</span>
                        <input
                          key={fileInputKey}
                          type="file"
                          multiple
                          accept=".pdf,.csv,.html,.htm,.md,.markdown,.txt,application/pdf,text/csv,text/html,text/markdown,text/plain"
                          className="sr-only"
                          onChange={event => setSelectedFiles(Array.from(event.target.files ?? []).slice(0, 4))}
                        />
                      </label>
                      {selectedFiles.length > 0 && (
                        <div className="space-y-1">
                          {selectedFiles.map(file => (
                            <div key={`${file.name}-${file.size}`} className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="truncate">{file.name}</span>
                              <span>{(file.size / 1024).toFixed(0)} KB</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Button
                      className="mt-3 w-full"
                      variant="outline"
                      onClick={runImport}
                      disabled={importSources.isPending || selectedFiles.length === 0 || !importSchool.trim() || !importMajor.trim()}
                    >
                      {importSources.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
                      Parse into evidence
                    </Button>
                    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                      Do not upload transcripts or student records. File text may be sent to the configured extraction model; imported evidence remains untrusted until you approve it.
                    </p>
                  </TabsContent>
                </Tabs>
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
              <div className="rounded-xl border border-border bg-card p-5">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="font-semibold">Source library</h2>
                    <p className="text-xs text-muted-foreground">Saved evidence with retrieval health and seven-day freshness tracking.</p>
                  </div>
                  <Badge variant="secondary">{librarySources.length} {librarySources.length === 1 ? "source" : "sources"}</Badge>
                </div>
                {librarySources.length > 0 ? (
                  <div className="space-y-2">
                    {librarySources.map(source => {
                      const isWebSource = source.url.startsWith("http://") || source.url.startsWith("https://");
                      return (
                        <div key={source.id} className="flex items-center gap-3 rounded-lg border border-border bg-secondary/20 p-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            {isWebSource ? <Globe2 className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {isWebSource ? (
                                <a href={source.url} target="_blank" rel="noreferrer" className="truncate text-sm font-medium hover:text-primary hover:underline">{source.title}</a>
                              ) : (
                                <span className="truncate text-sm font-medium">{source.title}</span>
                              )}
                              <Badge variant="outline" className={
                                source.crawlStatus === "failed"
                                  ? "border-red-500/30 text-red-300"
                                  : source.freshness === "stale"
                                    ? "border-amber-500/30 text-amber-300"
                                    : "border-green-500/30 text-green-300"
                              }>
                                {source.crawlStatus === "failed" ? "failed" : source.freshness}
                              </Badge>
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {source.schoolName} · {source.majorName} · {formatCheckedAt(source.lastFetchedAt)}
                            </p>
                            {source.lastError && <p className="mt-1 truncate text-xs text-red-300">{source.lastError}</p>}
                          </div>
                          {isWebSource && (
                            <Button
                              size="icon"
                              variant="ghost"
                              title="Refresh source"
                              disabled={refreshSource.isPending}
                              onClick={() => refreshSource.mutate({ sourceId: source.id })}
                            >
                              <RefreshCw className={`h-4 w-4 ${refreshSource.isPending && refreshSource.variables?.sourceId === source.id ? "animate-spin" : ""}`} />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Remove source"
                            disabled={removeSource.isPending}
                            onClick={() => {
                              if (window.confirm(`Remove ${source.title} from the source library? Existing evidence reviews will be retained.`)) {
                                removeSource.mutate({ sourceId: source.id });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Add a website or file to start a reusable source library.
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between px-1">
                <h2 className="font-semibold">Evidence reviews</h2>
                <span className="text-xs text-muted-foreground">Approval required before catalog import</span>
              </div>
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
                          {update.sources.map(source => {
                            const isWebSource = source.url.startsWith("http://") || source.url.startsWith("https://");
                            const title = (
                              <>
                                {isWebSource ? <ExternalLink className="w-3.5 h-3.5 shrink-0" /> : <FileText className="w-3.5 h-3.5 shrink-0" />}
                                <span className="truncate">{source.title}</span>
                                <Badge variant="outline" className="ml-auto text-[10px]">{source.kind ?? "web"}</Badge>
                              </>
                            );
                            return isWebSource ? (
                              <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                                {title}
                              </a>
                            ) : (
                              <div key={source.url} className="flex items-center gap-2 text-sm text-foreground">
                                {title}
                              </div>
                            );
                          })}
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
                  <p className="text-sm text-muted-foreground">Search the web, add an official URL, or import files to collect catalog evidence.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
