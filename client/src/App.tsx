import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const SetupWizard = lazy(() => import("./pages/SetupWizard"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const PlanView = lazy(() => import("./pages/PlanView"));
const ScenarioPage = lazy(() => import("./pages/ScenarioPage"));
const CareerPage = lazy(() => import("./pages/CareerPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const ResearchAgentPage = lazy(() => import("./pages/ResearchAgentPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function PageFallback() {
  return (
    <main className="grid min-h-screen place-items-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Loading AcademiQ…</p>
    </main>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/setup" component={SetupWizard} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/plan/:id" component={PlanView} />
        <Route path="/scenarios" component={ScenarioPage} />
        <Route path="/career" component={CareerPage} />
        <Route path="/chat" component={ChatPage} />
        <Route path="/research-agent" component={ResearchAgentPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster richColors position="top-right" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
