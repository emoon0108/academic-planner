import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { getLoginUrl, hasLoginConfig } from "@/const";
import {
  GraduationCap, School, BookOpen, Star, Target, ChevronRight,
  ChevronLeft, Check, Loader2, Briefcase, Calendar, Sliders,
  Plus, X, Award, Search
} from "lucide-react";

const STEPS = [
  { id: 1, title: "Your School", icon: School, description: "Select your university" },
  { id: 2, title: "Your Major", icon: BookOpen, description: "Choose your program(s)" },
  { id: 3, title: "Prior Credits", icon: Star, description: "AP and transfer credits" },
  { id: 4, title: "Career Goals", icon: Target, description: "What do you want to do?" },
  { id: 5, title: "Preferences", icon: Sliders, description: "Customize your schedule" },
];

export default function SetupWizard() {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(1);

  // Form state
  const [schoolId, setSchoolId] = useState<number | null>(null);
  const [primaryMajorId, setPrimaryMajorId] = useState<number | null>(null);
  const [secondaryMajorId, setSecondaryMajorId] = useState<number | null>(null);
  const [minorIds, setMinorIds] = useState<number[]>([]);
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [startSemester, setStartSemester] = useState<'fall' | 'spring'>('fall');
  const [careerTrackId, setCareerTrackId] = useState<number | null>(null);
  const [workloadBalance, setWorkloadBalance] = useState<'light' | 'moderate' | 'heavy'>('moderate');
  const [maxCredits, setMaxCredits] = useState(18);
  const [avoidSummer, setAvoidSummer] = useState(true);
  const [internshipSemester, setInternshipSemester] = useState<string>('');
  const [earlyGraduation, setEarlyGraduation] = useState(false);
  const [customSchoolName, setCustomSchoolName] = useState('');
  const [customMajorName, setCustomMajorName] = useState('Computer Science');
  const [customSourceUrl, setCustomSourceUrl] = useState('');

  // AP & Transfer credits state
  // apExams: list of { exam, score } the student has taken
  // transferCourses: free-text list of transfer course descriptions + credits
  const [apExams, setApExams] = useState<{ exam: string; score: number }[]>([]);
  const [transferCourseText, setTransferCourseText] = useState('');
  const [transferCreditTotal, setTransferCreditTotal] = useState(0);

  const AP_EXAMS = [
    { name: 'Calculus AB', subject: 'Mathematics' },
    { name: 'Calculus BC', subject: 'Mathematics' },
    { name: 'Statistics', subject: 'Mathematics' },
    { name: 'Computer Science A', subject: 'Computer Science' },
    { name: 'Computer Science Principles', subject: 'Computer Science' },
    { name: 'Physics 1', subject: 'Physics' },
    { name: 'Physics 2', subject: 'Physics' },
    { name: 'Physics C: Mechanics', subject: 'Physics' },
    { name: 'Physics C: E&M', subject: 'Physics' },
    { name: 'Chemistry', subject: 'Science' },
    { name: 'Biology', subject: 'Science' },
    { name: 'Environmental Science', subject: 'Science' },
    { name: 'English Language', subject: 'English' },
    { name: 'English Literature', subject: 'English' },
    { name: 'U.S. History', subject: 'History' },
    { name: 'World History', subject: 'History' },
    { name: 'European History', subject: 'History' },
    { name: 'U.S. Government', subject: 'Social Studies' },
    { name: 'Comparative Government', subject: 'Social Studies' },
    { name: 'Macroeconomics', subject: 'Economics' },
    { name: 'Microeconomics', subject: 'Economics' },
    { name: 'Psychology', subject: 'Social Studies' },
    { name: 'Human Geography', subject: 'Social Studies' },
    { name: 'Spanish Language', subject: 'Language' },
    { name: 'French Language', subject: 'Language' },
    { name: 'German Language', subject: 'Language' },
    { name: 'Chinese Language', subject: 'Language' },
    { name: 'Japanese Language', subject: 'Language' },
    { name: 'Latin', subject: 'Language' },
    { name: 'Art History', subject: 'Arts' },
    { name: 'Music Theory', subject: 'Arts' },
    { name: 'Studio Art', subject: 'Arts' },
  ];

  const AP_SUBJECTS = Array.from(new Set(AP_EXAMS.map(e => e.subject)));

  const addApExam = (examName: string) => {
    if (!apExams.find(e => e.exam === examName)) {
      setApExams(prev => [...prev, { exam: examName, score: 4 }]);
    }
  };

  const removeApExam = (examName: string) => {
    setApExams(prev => prev.filter(e => e.exam !== examName));
  };

  const updateApScore = (examName: string, score: number) => {
    setApExams(prev => prev.map(e => e.exam === examName ? { ...e, score } : e));
  };

  // Queries
  const { data: schools } = trpc.schools.list.useQuery();
  const { data: programs } = trpc.programs.list.useQuery(
    { schoolId: schoolId! },
    { enabled: !!schoolId }
  );
  const utils = trpc.useUtils();
  const runResearchAgent = trpc.researchAgent.runOnce.useMutation({
    onSuccess: async result => {
      const newest = result.updates[0];
      toast.success(
        newest?.structuredRequirements?.length
          ? `Found ${newest.structuredRequirements.length} requirement groups for review.`
          : "Catalog research finished. Review the findings before importing."
      );
      await utils.researchAgent.status.invalidate();
      navigate('/research-agent');
    },
    onError: err => toast.error(err.message),
  });
  const { data: careerTracks } = trpc.careerTracks.list.useQuery();
  const { data: existingProfile } = trpc.profile.get.useQuery();

  // Pre-fill form from existing profile when editing
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (existingProfile && !prefilled) {
      setPrefilled(true);
      if (existingProfile.schoolId) setSchoolId(existingProfile.schoolId);
      if (existingProfile.primaryMajorId) setPrimaryMajorId(existingProfile.primaryMajorId);
      if (existingProfile.secondaryMajorId) setSecondaryMajorId(existingProfile.secondaryMajorId);
      if (existingProfile.minorIds?.length) setMinorIds(existingProfile.minorIds);
      if (existingProfile.startYear) setStartYear(existingProfile.startYear);
      if (existingProfile.startSemester) setStartSemester(existingProfile.startSemester as 'fall' | 'spring');
      if (existingProfile.careerTrackId) setCareerTrackId(existingProfile.careerTrackId);
      const prefs = existingProfile.preferences as Record<string, unknown> | null;
      if (prefs) {
        if (prefs.workloadBalance) setWorkloadBalance(prefs.workloadBalance as 'light' | 'moderate' | 'heavy');
        if (prefs.maxCreditsPerSemester) setMaxCredits(prefs.maxCreditsPerSemester as number);
        if (typeof prefs.avoidSummerClasses === 'boolean') setAvoidSummer(prefs.avoidSummerClasses);
        if (prefs.internshipSemester) setInternshipSemester(prefs.internshipSemester as string);
        if (typeof prefs.earlyGraduation === 'boolean') setEarlyGraduation(prefs.earlyGraduation);
      }
      // Pre-fill AP exams from saved profile
      const savedAp = existingProfile.apCredits as { courseId: number; score: number; examName?: string }[] | null;
      if (savedAp?.length) {
        const mapped = savedAp
          .filter(a => a.examName)
          .map(a => ({ exam: a.examName!, score: a.score }));
        if (mapped.length) setApExams(mapped);
      }
    }
  }, [existingProfile, prefilled]);

  const upsertProfile = trpc.profile.upsert.useMutation({
    onSuccess: () => {
      navigate("/dashboard");
    },
    onError: (err) => {
      toast.error("Failed to save profile: " + err.message);
    },
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

  const majors = programs?.filter(p => p.type === 'major') ?? [];
  const minors = programs?.filter(p => p.type === 'minor') ?? [];
  const selectedSchool = schools?.find(s => s.id === schoolId);

  const researchProgram = (majorId: number) => {
    setPrimaryMajorId(majorId);
    const major = majors.find(m => m.id === majorId);
    if (!selectedSchool || !major || runResearchAgent.isPending) return;
    runResearchAgent.mutate({
      targets: [{ schoolName: selectedSchool.name, majorName: major.name }],
    });
  };

  const researchCustomSchool = () => {
    const schoolName = customSchoolName.trim();
    const majorName = customMajorName.trim() || 'Computer Science';
    if (!schoolName) {
      toast.error('Enter a school name first.');
      return;
    }
    const sourceUrl = customSourceUrl.trim();
    runResearchAgent.mutate({
      targets: [{
        schoolName,
        majorName,
        sourceUrls: sourceUrl ? [sourceUrl] : undefined,
      }],
    });
  };

  const handleFinish = async () => {
    if (!schoolId || !primaryMajorId) {
      toast.error("Please select a school and major.");
      return;
    }

    // Convert AP exams to the format the backend expects
    // We store them as { courseId: 0, score, examName } — courseId 0 means
    // "no specific course mapping yet"; the optimizer uses examName for matching
    const apCredits = apExams.map(e => ({ courseId: 0, score: e.score, examName: e.exam, credits: 3 }));
    const transferCredits = transferCreditTotal > 0
      ? [{ courseId: 0, credits: transferCreditTotal, description: transferCourseText || "Transfer credits" }]
      : [];

    await upsertProfile.mutateAsync({
      schoolId,
      primaryMajorId,
      secondaryMajorId: secondaryMajorId ?? undefined,
      minorIds,
      startYear,
      startSemester,
      careerTrackId: careerTrackId ?? undefined,
      apCredits,
      transferCredits,
      preferences: {
        workloadBalance,
        maxCreditsPerSemester: maxCredits,
        avoidSummerClasses: avoidSummer,
        internshipSemester: internshipSemester || null,
        earlyGraduation,
      },
      isSetupComplete: true,
    });
  };

  const canProceed = () => {
    if (step === 1) return !!schoolId;
    if (step === 2) return !!primaryMajorId;
    return true;
  };

  const progress = ((step - 1) / (STEPS.length - 1)) * 100;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-primary" />
        </div>
        <span className="font-semibold">AcademiQ Setup</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-2xl">
          {/* Progress */}
          <div className="mb-8">
            <div className="flex justify-between mb-3">
              {STEPS.map(s => (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    s.id < step ? 'bg-primary text-primary-foreground' :
                    s.id === step ? 'bg-primary/20 text-primary border border-primary' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {s.id < step ? <Check className="w-4 h-4" /> : s.id}
                  </div>
                  <span className="text-xs text-muted-foreground hidden sm:block">{s.title}</span>
                </div>
              ))}
            </div>
            <Progress value={progress} className="h-1" />
          </div>

          {/* Step content */}
          <div className="rounded-2xl border border-border bg-card p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-1">{STEPS[step - 1].title}</h2>
              <p className="text-muted-foreground">{STEPS[step - 1].description}</p>
            </div>

            {/* Step 1: School */}
            {step === 1 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">Select your university to load its course catalog and degree requirements.</p>
                {schools?.map(school => (
                  <button
                    key={school.id}
                    onClick={() => { setSchoolId(school.id); setPrimaryMajorId(null); setSecondaryMajorId(null); setMinorIds([]); }}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      schoolId === school.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border bg-secondary/30 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{school.name}</div>
                        <div className="text-sm text-muted-foreground">{school.location} · {school.semesterSystem} system</div>
                      </div>
                      {schoolId === school.id && <Check className="w-5 h-5 text-primary" />}
                    </div>
                  </button>
                ))}

                <div className="mt-5 rounded-xl border border-border bg-secondary/20 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <Search className="w-4 h-4 text-primary mt-0.5" />
                    <div>
                      <div className="text-sm font-medium">Add a school with AI research</div>
                      <p className="text-xs text-muted-foreground">
                      Add an official catalog URL for the best results. Review and approve the result on the Research Agent page.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      value={customSchoolName}
                      onChange={e => setCustomSchoolName(e.target.value)}
                      placeholder="School name"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                    />
                    <input
                      value={customMajorName}
                      onChange={e => setCustomMajorName(e.target.value)}
                      placeholder="Major"
                      className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                    />
                  </div>
                  <input
                    value={customSourceUrl}
                    onChange={e => setCustomSourceUrl(e.target.value)}
                    placeholder="Official requirements URL, optional but recommended"
                    className="mt-3 w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                  />
                  <div className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={researchCustomSchool}
                      disabled={runResearchAgent.isPending}
                      className="sm:w-auto"
                    >
                      {runResearchAgent.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
                      Research School
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => navigate('/research-agent')}
                      className="sm:w-auto"
                    >
                      Open Research Agent
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Major */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="text-sm font-medium mb-3 block">Primary Major <span className="text-destructive">*</span></label>
                  <div className="space-y-2">
                    {majors.map(m => (
                      <button
                        key={m.id}
                        onClick={() => researchProgram(m.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          primaryMajorId === m.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary/30 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{m.name}</div>
                            <div className="text-sm text-muted-foreground">{m.totalCreditsRequired} credits required</div>
                          </div>
                          <div className="flex items-center gap-2">
                            {runResearchAgent.isPending && primaryMajorId === m.id && (
                              <Loader2 className="w-4 h-4 animate-spin text-primary" />
                            )}
                            {primaryMajorId === m.id && <Check className="w-5 h-5 text-primary" />}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-border bg-secondary/20 p-3 text-xs text-muted-foreground flex gap-2">
                    <Search className="w-4 h-4 shrink-0 text-primary" />
                    <span>
                      Selecting a primary major starts an official catalog research pass in the background. Import reviewed findings from the Research Agent page before relying on them for advising.
                    </span>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-3 block">Double Major <span className="text-muted-foreground">(optional)</span></label>
                  <div className="space-y-2">
                    {majors.filter(m => m.id !== primaryMajorId).map(m => (
                      <button
                        key={m.id}
                        onClick={() => setSecondaryMajorId(secondaryMajorId === m.id ? null : m.id)}
                        className={`w-full text-left p-4 rounded-xl border transition-all ${
                          secondaryMajorId === m.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary/30 hover:border-primary/40'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{m.name}</span>
                          {secondaryMajorId === m.id && <Check className="w-5 h-5 text-primary" />}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {minors.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-3 block">Minors <span className="text-muted-foreground">(optional)</span></label>
                    <div className="flex flex-wrap gap-2">
                      {minors.map(m => (
                        <button
                          key={m.id}
                          onClick={() => setMinorIds(prev => prev.includes(m.id) ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                          className={`px-4 py-2 rounded-lg border text-sm transition-all ${
                            minorIds.includes(m.id) ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary/30 hover:border-primary/40'
                          }`}
                        >
                          {m.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Prior Credits */}
            {step === 3 && (
              <div className="space-y-7">
                {/* Start date */}
                <div>
                  <label className="text-sm font-medium mb-2 block">When do you start?</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Year</label>
                      <select
                        value={startYear}
                        onChange={e => setStartYear(Number(e.target.value))}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                      >
                        {[2024, 2025, 2026, 2027, 2028].map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Semester</label>
                      <select
                        value={startSemester}
                        onChange={e => setStartSemester(e.target.value as 'fall' | 'spring')}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                      >
                        <option value="fall">Fall</option>
                        <option value="spring">Spring</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* AP Exams */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Award className="w-4 h-4 text-primary" />
                    <label className="text-sm font-medium">AP Exam Credits</label>
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Select any AP exams you have taken or plan to take. The optimizer will use your scores to skip equivalent introductory courses in your plan.
                  </p>

                  {/* Selected exams */}
                  {apExams.length > 0 && (
                    <div className="space-y-2 mb-4">
                      {apExams.map(({ exam, score }) => (
                        <div key={exam} className="flex items-center gap-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
                          <div className="flex-1 text-sm font-medium">{exam}</div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-muted-foreground mr-1">Score:</span>
                            {[1, 2, 3, 4, 5].map(s => (
                              <button
                                key={s}
                                onClick={() => updateApScore(exam, s)}
                                className={`w-7 h-7 rounded text-xs font-medium transition-all ${
                                  score === s
                                    ? s >= 3 ? 'bg-primary text-primary-foreground' : 'bg-destructive/80 text-white'
                                    : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                                }`}
                              >
                                {s}
                              </button>
                            ))}
                          </div>
                          <button onClick={() => removeApExam(exam)} className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* AP exam picker grouped by subject */}
                  <div className="space-y-3">
                    {AP_SUBJECTS.map(subject => {
                      const examsInSubject = AP_EXAMS.filter(e => e.subject === subject);
                      const unselected = examsInSubject.filter(e => !apExams.find(a => a.exam === e.name));
                      if (unselected.length === 0) return null;
                      return (
                        <div key={subject}>
                          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">{subject}</div>
                          <div className="flex flex-wrap gap-2">
                            {unselected.map(e => (
                              <button
                                key={e.name}
                                onClick={() => addApExam(e.name)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-secondary/30 hover:border-primary/50 hover:bg-primary/5 text-sm transition-all"
                              >
                                <Plus className="w-3 h-3" />
                                {e.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Transfer Credits */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <label className="text-sm font-medium">Transfer Credits</label>
                    <span className="text-xs text-muted-foreground">(optional)</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    If you are transferring credits from another institution, enter the total number of credits below. The optimizer will reduce your remaining requirements accordingly.
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0}
                      max={90}
                      value={transferCreditTotal || ''}
                      onChange={e => setTransferCreditTotal(Number(e.target.value))}
                      placeholder="0"
                      className="w-24 px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm"
                    />
                    <span className="text-sm text-muted-foreground">total transfer credits</span>
                  </div>
                  {transferCreditTotal > 0 && (
                    <div className="mt-3">
                      <label className="text-xs text-muted-foreground mb-1 block">Course descriptions (optional)</label>
                      <textarea
                        value={transferCourseText}
                        onChange={e => setTransferCourseText(e.target.value)}
                        placeholder="e.g. MATH 101 Calculus I (4 credits), CS 110 Intro to Programming (3 credits)..."
                        rows={3}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground resize-none"
                      />
                    </div>
                  )}
                </div>

                {/* Summary */}
                {(apExams.length > 0 || transferCreditTotal > 0) && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    <div className="text-sm font-medium mb-1">Prior Credits Summary</div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      {apExams.length > 0 && (
                        <div>✓ {apExams.length} AP exam{apExams.length > 1 ? 's' : ''} entered — {apExams.filter(e => e.score >= 3).length} qualifying (score ≥ 3)</div>
                      )}
                      {transferCreditTotal > 0 && (
                        <div>✓ {transferCreditTotal} transfer credits will reduce your required coursework</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Career Goals */}
            {step === 4 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Select a career track to prioritize relevant courses in your plan.
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {careerTracks?.map(track => (
                    <button
                      key={track.id}
                      onClick={() => setCareerTrackId(careerTrackId === track.id ? null : track.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        careerTrackId === track.id ? 'border-primary bg-primary/10' : 'border-border bg-secondary/30 hover:border-primary/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{track.name}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{track.description}</div>
                        </div>
                        {careerTrackId === track.id && <Check className="w-5 h-5 text-primary shrink-0 ml-2" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Preferences */}
            {step === 5 && (
              <div className="space-y-6">
                <div>
                  <label className="text-sm font-medium mb-3 block">Workload Balance</label>
                  <div className="grid grid-cols-3 gap-3">
                    {(['light', 'moderate', 'heavy'] as const).map(w => (
                      <button
                        key={w}
                        onClick={() => setWorkloadBalance(w)}
                        className={`p-3 rounded-xl border text-sm capitalize transition-all ${
                          workloadBalance === w ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border bg-secondary/30 hover:border-primary/40'
                        }`}
                      >
                        {w === 'light' ? '🌿 Light' : w === 'moderate' ? '⚖️ Moderate' : '🔥 Heavy'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Max Credits per Semester: <span className="text-primary">{maxCredits}</span></label>
                  <input
                    type="range"
                    min={12}
                    max={21}
                    value={maxCredits}
                    onChange={e => setMaxCredits(Number(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>12 (light)</span>
                    <span>21 (max)</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={avoidSummer}
                      onChange={e => setAvoidSummer(e.target.checked)}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span className="text-sm">Avoid summer classes</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={earlyGraduation}
                      onChange={e => setEarlyGraduation(e.target.checked)}
                      className="w-4 h-4 accent-primary rounded"
                    />
                    <span className="text-sm">Optimize for early graduation</span>
                  </label>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Internship Semester <span className="text-muted-foreground">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="e.g. fall-2027"
                    value={internshipSemester}
                    onChange={e => setInternshipSemester(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">The optimizer will keep this semester free for your internship.</p>
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <Button
              variant="outline"
              onClick={() => setStep(s => s - 1)}
              disabled={step === 1}
              className="bg-secondary/50"
            >
              <ChevronLeft className="w-4 h-4 mr-1" /> Back
            </Button>

            {step < STEPS.length ? (
              <Button
                onClick={() => setStep(s => s + 1)}
                disabled={!canProceed()}
              >
                Continue <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleFinish}
                disabled={upsertProfile.isPending || !schoolId || !primaryMajorId}
              >
                {upsertProfile.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                ) : (
                  <>Generate My Plans <Check className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
