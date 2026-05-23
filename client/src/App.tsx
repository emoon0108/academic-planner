import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import SetupWizard from "./pages/SetupWizard";
import Dashboard from "./pages/Dashboard";
import PlanView from "./pages/PlanView";
import ScenarioPage from "./pages/ScenarioPage";
import CareerPage from "./pages/CareerPage";
import ChatPage from "./pages/ChatPage";
import ResearchAgentPage from "./pages/ResearchAgentPage";

function Router() {
  return (
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
