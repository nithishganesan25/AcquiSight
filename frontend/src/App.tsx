import { type ReactNode, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "@/components/error-boundary";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Route, Switch, useLocation, Router as WouterRouter } from "wouter";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import LoginPage from "@/pages/LoginPage";
import {
  CommandCenterPage,
  LandIntelligencePage,
  CreateCasePage,
  AiAnalysisPage,
  RiskAssessmentPage,
  ActionIntelligencePage,
  RiskAlertsPage,
  CaseProfilePage,
  AnalyticsPage,
  ReportsPage,
  SettingsPage,
} from "@/pages";
import { GisMapPage } from "@/pages/GisMapPage";
import { RiskPredictorPage } from "@/pages/RiskPredictorPage";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000,
      refetchOnWindowFocus: true,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !user && location !== "/login") {
      setLocation("/login");
    }
  }, [loading, user, location, setLocation]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#070c18] text-xs font-semibold text-slate-400">
        Verifying officer authorization...
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <Component />;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/" component={() => <ProtectedRoute component={CommandCenterPage} />} />
        <Route path="/command-center" component={() => <ProtectedRoute component={CommandCenterPage} />} />
        <Route path="/land-intelligence" component={() => <ProtectedRoute component={LandIntelligencePage} />} />
        <Route path="/gis-map" component={() => <ProtectedRoute component={GisMapPage} />} />
        <Route path="/risk-predictor" component={() => <ProtectedRoute component={RiskPredictorPage} />} />
        <Route path="/create-case" component={() => <ProtectedRoute component={CreateCasePage} />} />
        <Route path="/ai-analysis" component={() => <ProtectedRoute component={AiAnalysisPage} />} />
        <Route path="/risk-assessment" component={() => <ProtectedRoute component={RiskAssessmentPage} />} />
        <Route path="/action-intelligence" component={() => <ProtectedRoute component={ActionIntelligencePage} />} />
        <Route path="/risk-alerts" component={() => <ProtectedRoute component={RiskAlertsPage} />} />
        <Route path="/cases/:id" component={() => <ProtectedRoute component={CaseProfilePage} />} />
        <Route path="/analytics" component={() => <ProtectedRoute component={AnalyticsPage} />} />
        <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} />} />
        <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} />} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={true}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <div className="min-h-[100dvh] bg-background text-foreground transition-colors duration-200">
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
              <Toaster />
            </div>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
