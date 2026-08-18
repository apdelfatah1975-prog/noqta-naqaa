import { useAuth } from "@/_core/hooks/useAuth";
import React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { useIsMobile } from "@/hooks/useMobile";
import {
  BellRing,
  ClipboardList,
  CalendarPlus,
  CircleDollarSign,
  FileBarChart,
  WalletCards,
  Droplets,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  Settings,
  UsersRound,
  MapPinned,
  UserRoundPlus,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { AutomaticReminderNotifications } from "./AutomaticReminderNotifications";
import { InstallAppButton } from "./InstallAppButton";
import { OfflineSyncManager } from "./OfflineSyncManager";

const menuItems = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/" },
  { icon: UsersRound, label: "العملاء", path: "/customers" },
  { icon: CalendarPlus, label: "سجل الزيارات", path: "/visits" },
  { icon: ClipboardList, label: "أوامر الفنيين", path: "/work-orders" },
  { icon: BellRing, label: "التذكيرات", path: "/reminders" },
  { icon: PackageSearch, label: "المخزن", path: "/inventory" },
  { icon: CircleDollarSign, label: "الخزينة والمصروفات", path: "/cash" },
  { icon: FileBarChart, label: "التقارير", path: "/reports" },
  { icon: WalletCards, label: "كشف رواتب الفنيين", path: "/technician-payroll" },
  { icon: MapPinned, label: "خريطة الفنيين", path: "/technician-locations" },
  { icon: UserRoundPlus, label: "الحسابات المسموح بها", path: "/allowed-technicians" },
  { icon: Settings, label: "الإعدادات", path: "/settings" },
];

const mobileNavItems = menuItems.filter(item => ["/", "/customers", "/visits", "/reminders"].includes(item.path));

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dff6f2,transparent_48%),#f6fbfa] p-5 flex items-center justify-center" dir="rtl">
        <div className="w-full max-w-md rounded-[2rem] bg-card p-8 sm:p-10 text-center shadow-[0_24px_80px_rgba(15,118,110,.14)] border border-emerald-100">
          <div className="mx-auto mb-7 grid h-16 w-16 place-items-center rounded-3xl bg-teal-700 text-white shadow-lg shadow-teal-700/25">
            <Droplets className="h-8 w-8" />
          </div>
          <p className="text-sm font-bold text-teal-700">نقطة نقاء</p>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight">أهلًا بك في نظام الفلاتر</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">سجّل الدخول للوصول إلى بيانات العملاء والزيارات والمخزن بصورة آمنة.</p>
          <Button onClick={() => startLogin()} size="lg" className="mt-8 h-12 w-full rounded-xl bg-teal-700 text-base hover:bg-teal-800">
            تسجيل الدخول
          </Button>
          <div className="mt-3 flex justify-center">
            <InstallAppButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true} dir="rtl" className="min-w-0 max-w-full overflow-x-hidden">
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </SidebarProvider>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const utils = trpc.useUtils();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const visibleMenuItems = user?.role === "admin"
    ? menuItems
    : menuItems.filter(item => !["/inventory", "/cash", "/reports", "/technician-payroll", "/technician-locations", "/allowed-technicians"].includes(item.path));
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find(item => item.path === location)
    ?? (location.startsWith("/customers/") ? menuItems[1] : undefined)
    ?? menuItems[0];
  const initials = user?.name?.trim().slice(0, 1) || "م";
  const pageAccent = location === "/customers"
    ? { bar: "from-sky-500 via-cyan-500 to-teal-500", label: "text-sky-800", surface: "bg-sky-50/95", glow: "shadow-[0_8px_28px_rgba(14,165,233,.18)]" }
    : location === "/inventory"
      ? { bar: "from-amber-400 via-orange-500 to-rose-500", label: "text-orange-800", surface: "bg-amber-50/95", glow: "shadow-[0_8px_28px_rgba(245,158,11,.20)]" }
      : location === "/cash"
        ? { bar: "from-emerald-400 via-teal-500 to-cyan-500", label: "text-emerald-800", surface: "bg-emerald-50/95", glow: "shadow-[0_8px_28px_rgba(16,185,129,.20)]" }
        : location === "/reports"
          ? { bar: "from-violet-500 via-fuchsia-500 to-pink-500", label: "text-violet-800", surface: "bg-violet-50/95", glow: "shadow-[0_8px_28px_rgba(139,92,246,.20)]" }
          : location === "/technician-payroll"
            ? { bar: "from-indigo-500 via-blue-500 to-cyan-500", label: "text-indigo-800", surface: "bg-indigo-50/95", glow: "shadow-[0_8px_28px_rgba(99,102,241,.20)]" }
            : { bar: "from-teal-500 via-cyan-500 to-sky-500", label: "text-teal-800", surface: "bg-teal-50/95", glow: "shadow-[0_8px_28px_rgba(20,184,166,.16)]" };

  const refreshData = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.all([
        utils.filters.dashboard.invalidate(),
        utils.filters.customers.list.invalidate(),
        utils.filters.customers.get.invalidate(),
        utils.filters.reminders.due.invalidate(),
        utils.filters.reminders.alerts.invalidate(),
        utils.filters.inventory.summary.invalidate(),
        utils.filters.cash.summary.invalidate(),
        utils.filters.notifications.nextAlert.invalidate(),
      ]);
      toast.success("تم تحديث البيانات المحفوظة");
    } catch {
      toast.error("تعذر تحديث البيانات. ستظل البيانات المحفوظة كما هي.");
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <AutomaticReminderNotifications />
      <OfflineSyncManager />
      <Sidebar side="right" collapsible="icon" className="border-l border-teal-950/8 bg-[#063c3a] text-white">
        <SidebarHeader className="h-24 border-b border-white/10 px-3 py-4">
          <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white text-teal-800 shadow-lg shadow-black/10">
              <Droplets className="h-6 w-6" strokeWidth={2.3} />
            </div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="font-extrabold leading-5">نقطة نقاء</p>
              <p className="mt-0.5 text-[11px] text-teal-100/70">إدارة فلاتر المياه</p>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 py-5">
          <p className="mb-2 px-2 text-[11px] font-bold tracking-wide text-teal-100/55 group-data-[collapsible=icon]:hidden">الإدارة</p>
          <SidebarMenu className="gap-1">
            {visibleMenuItems.map(item => {
              const isActive = activeMenuItem.path === item.path;
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    isActive={isActive}
                    onClick={() => setLocation(item.path)}
                    tooltip={item.label}
                    className="h-11 rounded-xl px-3 text-teal-50 hover:bg-white/10 hover:text-white data-[active=true]:bg-white data-[active=true]:text-teal-900 data-[active=true]:shadow-sm"
                  >
                    <item.icon className="h-5 w-5" />
                    <span className="font-semibold">{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarContent>

        <SidebarFooter className="border-t border-white/10 p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-3 rounded-xl p-2 text-right transition-colors hover:bg-white/10 group-data-[collapsible=icon]:justify-center">
                <Avatar className="h-9 w-9 shrink-0 border border-white/20">
                  <AvatarFallback className="bg-teal-500 text-xs font-bold text-white">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                  <p className="truncate text-sm font-bold">{user?.name || "مدير النظام"}</p>
                  <p className="mt-0.5 truncate text-[11px] text-teal-100/65">{user?.role === "admin" ? "حساب الإدارة" : "حساب فني"}</p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-48">
              <DropdownMenuItem onClick={logout} className="cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="ml-2 h-4 w-4" />
                تسجيل الخروج
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-w-0 max-w-full bg-[#f6fbfa]">
        <header className={`relative sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-teal-950/5 px-3 backdrop-blur-lg sm:px-4 lg:px-8 ${pageAccent.surface} ${pageAccent.glow}`}>
          <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-l ${pageAccent.bar}`} aria-hidden="true" />
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {isMobile ? <SidebarTrigger className="h-10 w-10 rounded-xl border border-teal-950/10 bg-white text-teal-800"><Menu className="h-5 w-5" /></SidebarTrigger> : null}
            <div>
              <p className={`truncate text-sm font-bold leading-6 ${pageAccent.label}`}>نظام الإدارة</p>
              <h2 className="truncate text-base font-extrabold leading-7 text-foreground">{activeMenuItem.label}</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={refreshData}
              disabled={isRefreshing}
              aria-label="تحديث البيانات المحفوظة"
              title="تحديث البيانات المحفوظة"
              className="grid h-11 w-11 place-items-center rounded-xl border border-teal-950/8 bg-white text-teal-800 transition hover:bg-teal-50 disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <InstallAppButton compact={isMobile} />
            {!isMobile ? (
              <button onClick={toggleSidebar} className="grid h-10 w-10 place-items-center rounded-xl border border-teal-950/8 bg-white text-teal-800 transition hover:bg-teal-50" aria-label="طي القائمة الجانبية">
                <Menu className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </header>
        <main className="min-h-[calc(100vh-4rem)] min-w-0 overflow-x-hidden px-3 pb-24 pt-4 sm:px-6 sm:pb-24 sm:pt-6 lg:px-8 lg:pb-8 lg:pt-8">{children}</main>
      </SidebarInset>
      {isMobile ? <nav aria-label="التنقل السريع" className="fixed inset-x-0 bottom-0 z-40 min-h-[5.25rem] border-t border-teal-950/10 bg-white/95 px-1 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(13,82,76,.10)] backdrop-blur-lg">
        <div className="mx-auto grid h-full max-w-lg grid-cols-4 gap-0.5">
          {mobileNavItems.map(item => { const active = activeMenuItem.path === item.path; return <button key={item.path} type="button" onClick={() => setLocation(item.path)} className={`flex min-h-[4rem] min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[13px] font-bold leading-5 tracking-wide transition active:scale-95 ${active ? "bg-teal-50 text-teal-800" : "text-slate-500 hover:bg-slate-50 hover:text-teal-700"}`} aria-current={active ? "page" : undefined}><item.icon className="h-5 w-5" /><span className="whitespace-nowrap">{item.label}</span></button>; })}
        </div>
      </nav> : null}
    </>

  );
}
