import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./_core/hooks/useAuth";
import type { ReactNode } from "react";
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

function AdminOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.role !== "admin") {
    return (
      <section className="mx-auto flex min-h-[60vh] max-w-xl items-center justify-center px-6 py-16 text-center" dir="rtl">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-2xl">!</div>
          <h1 className="text-xl font-black text-amber-950">لا يمكن الوصول إلى هذا القسم</h1>
          <p className="mt-2 text-sm leading-7 text-amber-900/75">هذا القسم مخصص للإدارة فقط. يمكنك متابعة العملاء والزيارات والتذكيرات من القوائم المتاحة لك.</p>
        </div>
      </section>
    );
  }
  return <>{children}</>;
}

function AdminInventory() { return <AdminOnly><Inventory /></AdminOnly>; }
function AdminCash() { return <AdminOnly><Cash /></AdminOnly>; }

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/customers/:id" component={CustomerProfile} />
        <Route path="/customers" component={Customers} />
        <Route path="/visits" component={Visits} />
        <Route path="/reminders" component={Reminders} />
        <Route path="/inventory" component={AdminInventory} />
        <Route path="/cash" component={AdminCash} />
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
