import { useAuth } from "@/_core/hooks/useAuth";
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
import { useIsMobile } from "@/hooks/useMobile";
import { useRef } from "react";
import {
  BellRing,
  CalendarPlus,
  CircleDollarSign,
  Download,
  FileBarChart,
  Upload,
  Droplets,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  UsersRound,
} from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { downloadOfflineBackup, getOfflineBackupKeyCount, restoreOfflineBackupFromText } from "@/lib/offlineSync";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { AutomaticReminderNotifications } from "./AutomaticReminderNotifications";
import { InstallAppButton } from "./InstallAppButton";
import { OfflineSyncManager } from "./OfflineSyncManager";

const menuItems = [
  { icon: LayoutDashboard, label: "الرئيسية", path: "/" },
  { icon: UsersRound, label: "العملاء", path: "/customers" },
  { icon: CalendarPlus, label: "تسجيل زيارة", path: "/visits" },
  { icon: BellRing, label: "التذكيرات", path: "/reminders" },
  { icon: PackageSearch, label: "المخزنة", path: "/inventory" },
  { icon: CircleDollarSign, label: "الخزينة والمصروفات", path: "/cash" },
  { icon: FileBarChart, label: "التقارير", path: "/reports" },
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
          <p className="mt-3 text-sm leading-7 text-muted-foreground">سجّل الدخول للوصول إلى بيانات العملاء والزيارات والمخزنة بصورة آمنة.</p>
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
  const visibleMenuItems = user?.role === "admin" ? menuItems : menuItems.filter(item => item.path !== "/inventory" && item.path !== "/cash" && item.path !== "/reports");
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isMobile = useIsMobile();
  const activeMenuItem = menuItems.find(item => item.path === location)
    ?? (location.startsWith("/customers/") ? menuItems[1] : undefined)
    ?? menuItems[0];
  const initials = user?.name?.trim().slice(0, 1) || "م";
  const restoreInputRef = useRef<HTMLInputElement>(null);

  async function handleRestoreBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const confirmed = window.confirm("تحذير: استعادة النسخة الاحتياطية ستستبدل البيانات المحلية الحالية. نزّل نسخة احتياطية من الحالة الحالية أولًا إذا كانت مهمة. هل تريد المتابعة؟");
    if (!confirmed) return;
    try {
      const result = restoreOfflineBackupFromText(await file.text());
      toast.success(`تمت استعادة ${result.restoredKeys} عناصر محلية. أعد تحميل التطبيق لإظهار البيانات.`);
      window.setTimeout(() => window.location.reload(), 700);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "تعذر استعادة النسخة الاحتياطية.");
    }
  }

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
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-teal-950/5 bg-[#f6fbfa]/90 px-4 backdrop-blur-lg lg:px-8">
          <div className="flex items-center gap-3">
            {isMobile ? <SidebarTrigger className="h-10 w-10 rounded-xl border border-teal-950/10 bg-white text-teal-800"><Menu className="h-5 w-5" /></SidebarTrigger> : null}
            <div>
              <p className="text-xs font-bold text-teal-700">نظام الإدارة</p>
              <h2 className="text-sm font-extrabold text-foreground">{activeMenuItem.label}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input ref={restoreInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleRestoreBackup} aria-label="اختيار ملف النسخة الاحتياطية" />
            <button
              type="button"
              onClick={() => restoreInputRef.current?.click()}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-amber-950/8 bg-white px-3 text-xs font-bold text-amber-800 transition hover:bg-amber-50"
              aria-label="استعادة نسخة احتياطية"
              title="استعادة البيانات من ملف احتياطي"
            >
              <Upload className="h-4 w-4" />
              {!isMobile ? <span>استعادة</span> : null}
            </button>
            <button
              type="button"
              onClick={() => {
                const downloaded = downloadOfflineBackup();
                toast(downloaded ? `تم تنزيل النسخة الاحتياطية (${getOfflineBackupKeyCount()} عناصر محلية)` : "تعذر إنشاء النسخة الاحتياطية على هذا الجهاز.");
              }}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-teal-950/8 bg-white px-3 text-xs font-bold text-teal-800 transition hover:bg-teal-50"
              aria-label="تنزيل نسخة احتياطية"
              title="تنزيل نسخة احتياطية من البيانات المحلية"
            >
              <Download className="h-4 w-4" />
              {!isMobile ? <span>نسخة احتياطية</span> : null}
            </button>
            <InstallAppButton compact={isMobile} />
            {!isMobile ? (
              <button onClick={toggleSidebar} className="grid h-10 w-10 place-items-center rounded-xl border border-teal-950/8 bg-white text-teal-800 transition hover:bg-teal-50" aria-label="طي القائمة الجانبية">
                <Menu className="h-5 w-5" />
              </button>
            ) : null}
          </div>
        </header>
        <main className="min-w-0 min-h-[calc(100vh-4rem)] pb-24 p-4 sm:p-6 lg:p-8 lg:pb-8">{children}</main>
      </SidebarInset>
      {isMobile ? <nav aria-label="التنقل السريع" className="fixed inset-x-0 bottom-0 z-40 border-t border-teal-950/10 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(13,82,76,.10)] backdrop-blur-lg">
        <div className="mx-auto grid max-w-lg grid-cols-4 gap-1">
          {mobileNavItems.map(item => { const active = activeMenuItem.path === item.path; return <button key={item.path} type="button" onClick={() => setLocation(item.path)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition ${active ? "bg-teal-50 text-teal-800" : "text-slate-500 hover:bg-slate-50 hover:text-teal-700"}`} aria-current={active ? "page" : undefined}><item.icon className="h-5 w-5" /><span>{item.path === "/visits" ? "زيارة جديدة" : item.label}</span></button>; })}
        </div>
      </nav> : null}
    </>

  );
}
