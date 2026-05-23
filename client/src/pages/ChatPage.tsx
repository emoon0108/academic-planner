import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { getLoginUrl, hasLoginConfig } from "@/const";
import {
  GraduationCap, Send, Loader2, Bot, User,
  Sparkles, Search, BrainCircuit
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Streamdown } from "streamdown";

type AgentMode = "auto" | "academic_planner" | "university_researcher";

const AGENT_OPTIONS: Array<{
  value: AgentMode;
  label: string;
  title: string;
  description: string;
  capability: string;
  icon: LucideIcon;
}> = [
  {
    value: "auto",
    label: "Auto",
    title: "Auto Router",
    description: "Routes each question to the best specialist",
    capability: "Chooses between planning strategy and source research",
    icon: Sparkles,
  },
  {
    value: "academic_planner",
    label: "Planner",
    title: "Academic Planning Strategist",
    description: "Degree strategy, sequencing, workload, tradeoffs",
    capability: "Builds plans, explains prerequisites, tests what-if moves",
    icon: BrainCircuit,
  },
  {
    value: "university_researcher",
    label: "Researcher",
    title: "University Scheduling Researcher",
    description: "Catalog nuances, policy traps, source checks",
    capability: "Checks registrar, catalog, course rotation, and policy details",
    icon: Search,
  },
];

const VISIBLE_AGENT_OPTIONS = AGENT_OPTIONS.filter(option => option.value !== "auto");

const PLANNER_QUESTIONS = [
  "Why is CS101 scheduled in my first semester?",
  "How can I graduate one semester earlier?",
  "What courses should I take before my internship?",
  "What happens if I drop Linear Algebra this semester?",
  "Which courses are most important for my career track?",
  "Can you explain the workload distribution in my plan?",
];

const RESEARCH_QUESTIONS = [
  "What university policies could affect this plan?",
  "Which course rotations should we verify before I rely on this schedule?",
  "What AP or transfer credit rules could change my graduation path?",
  "Where should I check if a prerequisite override is possible?",
  "What catalog year or residency rules might matter for my degree?",
  "What scheduling details should I confirm with my department advisor?",
];

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  agentLabel?: string;
}

export default function ChatPage() {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [agentMode, setAgentMode] = useState<AgentMode>("auto");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: plans } = trpc.plans.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: profile } = trpc.profile.get.useQuery(undefined, { enabled: isAuthenticated });
  const { data: chatHistory } = trpc.chat.getHistory.useQuery(
    { planId: selectedPlanId ?? undefined },
    { enabled: isAuthenticated }
  );

  const sendMessage = trpc.chat.sendMessage.useMutation({
    onSuccess: (data: { message: string; agentLabel?: string }) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date(),
        agentLabel: data.agentLabel,
      }]);
      setIsLoading(false);
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
      setIsLoading(false);
    },
  });

  useEffect(() => {
    const activePlan = plans?.find(p => p.isActive) ?? plans?.[0];
    if (activePlan && !selectedPlanId) setSelectedPlanId(activePlan.id);
  }, [plans]);

  useEffect(() => {
    if (chatHistory && chatHistory.length > 0 && messages.length === 0) {
      setMessages(chatHistory.map((m: { role: string; content: string; createdAt: Date | string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
        timestamp: new Date(m.createdAt),
      })));
    }
  }, [chatHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleSend = (text?: string) => {
    const messageText = text ?? input.trim();
    if (!messageText || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    sendMessage.mutate({
      message: messageText,
      planId: selectedPlanId ?? undefined,
      agentMode,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedAgent = AGENT_OPTIONS.find(option => option.value === agentMode) ?? AGENT_OPTIONS[0];
  const suggestedQuestions = agentMode === "university_researcher" ? RESEARCH_QUESTIONS : PLANNER_QUESTIONS;

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
                item.href === "/chat"
                  ? 'bg-sidebar-primary/15 text-sidebar-primary font-medium'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}>
                {item.label}
              </div>
            </Link>
          ))}
        </nav>

        {/* Plan selector */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground mb-2 px-1">Context Plan</div>
          <div className="space-y-1">
            <button
              onClick={() => setSelectedPlanId(null)}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${
                !selectedPlanId ? 'bg-sidebar-primary/15 text-sidebar-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent'
              }`}
            >
              All Plans
            </button>
            {plans?.map(plan => (
              <button
                key={plan.id}
                onClick={() => setSelectedPlanId(plan.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all truncate ${
                  selectedPlanId === plan.id ? 'bg-sidebar-primary/15 text-sidebar-primary' : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                {plan.name}
              </button>
            ))}
          </div>
        </div>

        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="text-xs text-muted-foreground mb-2 px-1">LLM Specialists</div>
          <div className="space-y-2">
            {VISIBLE_AGENT_OPTIONS.map(option => {
              const Icon = option.icon;
              const isActive = agentMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAgentMode(option.value)}
                  className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                    isActive
                      ? 'border-sidebar-primary/50 bg-sidebar-primary/15'
                      : 'border-sidebar-border bg-sidebar/40 hover:bg-sidebar-accent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-sidebar-primary' : 'text-muted-foreground'}`} />
                    <span className={`text-xs font-medium ${isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground'}`}>
                      {option.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-snug text-muted-foreground">
                    {option.capability}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-3 py-4 border-t border-sidebar-border">
          <div className="px-3 py-2 text-sm text-muted-foreground truncate">{user?.name}</div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-semibold">AcademiQ AI Assistant</div>
            <div className="text-xs text-muted-foreground">
              {selectedAgent.title} · {selectedPlanId ? `Context: ${plans?.find(p => p.id === selectedPlanId)?.name}` : 'Ask anything about your degree plan'}
            </div>
          </div>
          <div className="ml-auto flex rounded-lg border border-border bg-muted/40 p-1">
            {AGENT_OPTIONS.map(option => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAgentMode(option.value)}
                  title={option.description}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs transition-all ${
                    agentMode === option.value
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold mb-2">How can I help you?</h2>
              <p className="text-muted-foreground text-sm mb-8">
                {selectedAgent.title}: {selectedAgent.description}
              </p>
              <div className="mb-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {VISIBLE_AGENT_OPTIONS.map(option => {
                  const Icon = option.icon;
                  const isActive = agentMode === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setAgentMode(option.value)}
                      className={`rounded-xl border p-4 text-left transition-all ${
                        isActive
                          ? 'border-primary/50 bg-primary/10'
                          : 'border-border bg-card hover:border-primary/40 hover:bg-primary/5'
                      }`}
                    >
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Icon className="w-4 h-4 text-primary" />
                        {option.title}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {option.capability}
                      </p>
                    </button>
                  );
                })}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                {suggestedQuestions.map(q => (
                  <button
                    key={q}
                    onClick={() => handleSend(q)}
                    className="text-left px-4 py-3 rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-sm"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-tr-sm'
                  : 'bg-card border border-border rounded-tl-sm'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="text-sm prose prose-invert prose-sm max-w-none">
                    <Streamdown>{msg.content}</Streamdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}
                <div className={`text-xs mt-1.5 ${msg.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                  {msg.agentLabel ? `${msg.agentLabel} · ` : ''}{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1 items-center">
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border px-6 py-4 shrink-0">
          <div className="flex gap-3 items-end">
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your degree plan, prerequisites, career goals..."
              rows={1}
              className="flex-1 px-4 py-3 rounded-xl border border-border bg-input text-foreground text-sm placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 120) + 'px';
              }}
            />
            <Button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              size="sm"
              className="h-11 px-4 shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
