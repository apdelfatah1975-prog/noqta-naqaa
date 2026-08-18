import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "./_core/hooks/useAuth";
import type { ReactNode } from "react";
import { Route, Switch, useLocation } from "wouter";
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
import Reports from "./pages/Reports";
import TechnicianPayroll from "./pages/TechnicianPayroll";
import Settings from "./pages/Settings";
import Visits from "./pages/Visits";
import TechnicianPreview from "./pages/TechnicianPreview";
import TechnicianLocations from "./pages/TechnicianLocations";
import WorkOrders from "./pages/WorkOrders";

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

function TechnicianOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth({ redirectOnUnauthenticated: true });
  if (loading || !user) {
    return (
      <section className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16 text-center" dir="rtl">
        <div className="rounded-3xl border border-teal-100 bg-white p-8 shadow-sm">
          <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-teal-100" />
          <p className="font-bold text-slate-800">جارٍ التحقق من حساب الفني…</p>
          <p className="mt-2 text-sm text-slate-500">هذه الصفحة لا تعمل إلا بعد تسجيل الدخول بحساب فني مصرح.</p>
        </div>
      </section>
    );
  }
  if (user.role !== "user") {
    return (
      <section className="mx-auto flex min-h-screen max-w-xl items-center justify-center px-6 py-16 text-center" dir="rtl">
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 shadow-sm">
          <h1 className="text-xl font-black text-amber-950">الحساب غير مصرح له بواجهة الفني</h1>
          <p className="mt-2 text-sm leading-7 text-amber-900/75">استخدم حساب الفني المخصص لك أو ارجع إلى لوحة الإدارة.</p>
        </div>
      </section>
    );
  }
  return <>{children}</>;
}

function ProtectedTechnician() { return <TechnicianOnly><TechnicianPreview /></TechnicianOnly>; }
function AdminInventory() { return <AdminOnly><Inventory /></AdminOnly>; }
function AdminCash() { return <AdminOnly><Cash /></AdminOnly>; }
function AdminReports() { return <AdminOnly><Reports /></AdminOnly>; }
function AdminTechnicianPayroll() { return <AdminOnly><TechnicianPayroll /></AdminOnly>; }
function AdminTechnicianLocations() { return <AdminOnly><TechnicianLocations /></AdminOnly>; }

function Router() {
  const [location] = useLocation();
  const pathname = typeof window !== "undefined" ? window.location.pathname : location;
  if (pathname.replace(/\/$/, "") === "/technician-preview") return <ProtectedTechnician />;
  if (pathname.replace(/\/$/, "") === "/work-orders") return <DashboardLayout><AdminOnly><WorkOrders /></AdminOnly></DashboardLayout>;
  if (pathname.replace(/\/$/, "") === "/technician-locations") return <DashboardLayout><AdminTechnicianLocations /></DashboardLayout>;
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
        <Route path="/reports" component={AdminReports} />
        <Route path="/technician-payroll" component={AdminTechnicianPayroll} />
        <Route path="/technician-locations" component={AdminTechnicianLocations} />
        <Route path="/settings" component={Settings} />
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
