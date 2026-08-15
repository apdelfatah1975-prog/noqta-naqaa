import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import CustomerProfile from "./pages/CustomerProfile";
import Customers from "./pages/Customers";
import Cash from "./pages/Cash";
import Home from "./pages/Home";
import Inventory from "./pages/Inventory";
import NotFound from "./pages/NotFound";
import Reminders from "./pages/Reminders";
import Visits from "./pages/Visits";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/customers/:id" component={CustomerProfile} />
        <Route path="/customers" component={Customers} />
        <Route path="/visits" component={Visits} />
        <Route path="/reminders" component={Reminders} />
        <Route path="/inventory" component={Inventory} />
        <Route path="/cash" component={Cash} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
