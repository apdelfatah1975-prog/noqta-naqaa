import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatDateTime, visitTypeLabels } from "@/lib/filterUi";
import { ReminderAlertBanner } from "@/components/ReminderAlertBanner";
import { ArrowLeft, BellRing, CalendarDays, ChevronLeft, CircleDollarSign, PackageSearch, UsersRound } from "lucide-react";
import React from "react";
import { useLocation } from "wouter";

const statStyles = [
  { icon: UsersRound, color: "bg-teal-700", label: "عملاء اليوم", key: "today", href: "/customers" },
  { icon: CalendarDays, color: "bg-sky-600", label: "زيارات قادمة", key: "upcoming", href: "/visits" },
  { icon: BellRing, color: "bg-amber-500", label: "مستحقون للمتابعة", key: "due", href: "/reminders" },
  { icon: PackageSearch, color: "bg-violet-600", label: "أصناف بالمخزنة", key: "inventory", href: "/inventory" },
  { icon: CircleDollarSign, color: "bg-slate-800", label: "رصيد الخزينة (ج.م)", key: "cash", href: "/cash" },
] as const;

export default function Home() {
  const { data, isLoading } = trpc.filters.dashboard.useQuery();
  const { data: cash } = trpc.filters.cash.summary.useQuery();
  const [, setLocation] = useLocation();
  const counts = {
    today: data?.todayVisits.length ?? 0,
    upcoming: data?.upcomingVisits.length ?? 0,
    due: data?.dueReminders.length ?? 0,
    inventory: data?.inventory.totalItems ?? 0,
    cash: Math.round((cash?.balance ?? 0) / 100),
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-3xl bg-[linear-gradient(135deg,#064e4a,#0f766e)] px-6 py-7 text-white shadow-[0_16px_40px_rgba(6,78,74,.22)] sm:flex-row sm:items-center sm:px-8">
        <div>
          <p className="text-sm font-bold text-teal-100">لوحة التحكم</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">كل عملياتك في مكان واحد</h1>
          <p className="mt-2 text-sm text-teal-50/80">تابع الزيارات والعملاء والمخزنة بسرعة ووضوح.</p>
        </div>
        <Button onClick={() => setLocation("/visits")} className="h-11 rounded-xl bg-white px-5 font-bold text-teal-800 hover:bg-teal-50">
          <CalendarDays className="ml-2 h-5 w-5" /> تسجيل زيارة جديدة
        </Button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {statStyles.map(({ icon: Icon, color, label, key, href }) => (
          <button
            key={key}
            type="button"
            onClick={() => setLocation(href)}
            aria-label={`فتح تفاصيل ${label}`}
            className="soft-card group flex items-center gap-4 p-5 text-right transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(13,82,76,.13)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <div className={`grid h-12 w-12 place-items-center rounded-2xl ${color} text-white shadow-lg shadow-black/10`}><Icon className="h-5 w-5" /></div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-2xl font-extrabold">{isLoading ? "—" : counts[key]}</p>
            </div>
            <ChevronLeft className="h-5 w-5 text-teal-700 opacity-0 transition group-hover:translate-x-[-2px] group-hover:opacity-100" />
          </button>
        ))}
      </section>

      <ReminderAlertBanner />

      <section className="grid gap-6 xl:grid-cols-5">
        <div className="soft-card xl:col-span-3">
          <div className="flex items-center justify-between border-b border-teal-950/6 p-5">
            <div><h2 className="font-extrabold">الزيارات القادمة</h2><p className="mt-1 text-xs text-muted-foreground">أقرب خمس زيارات مسجلة</p></div>
            <button onClick={() => setLocation("/visits")} className="text-sm font-bold text-teal-700 hover:text-teal-900">عرض الكل</button>
          </div>
          <div className="divide-y divide-teal-950/6">
            {data?.upcomingVisits.length ? data.upcomingVisits.map(visit => (
              <button key={visit.id} onClick={() => setLocation(`/customers/${visit.customerId}`)} className="flex w-full items-center justify-between gap-3 p-4 text-right hover:bg-teal-50/55">
                <div className="min-w-0"><p className="truncate font-bold">{visit.customer?.name || "عميل"}</p><p className="mt-1 text-xs text-muted-foreground">{visit.customer?.customerCode ? `${visit.customer.customerCode} · ` : ""}{visitTypeLabels[visit.visitType]} · {formatDateTime(visit.visitDate)}</p></div>
                <ChevronLeft className="h-5 w-5 shrink-0 text-teal-600" />
              </button>
            )) : <EmptyRow text="لا توجد زيارات قادمة مسجلة." action="تسجيل زيارة" onAction={() => setLocation("/visits")} />}
          </div>
        </div>

        <div className="soft-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-teal-950/6 p-5">
            <div><h2 className="font-extrabold">متابعة مستحقة</h2><p className="mt-1 text-xs text-muted-foreground">عملاء تجاوزوا تاريخ التذكير</p></div>
            <BellRing className="h-5 w-5 text-amber-500" />
          </div>
          <div className="divide-y divide-teal-950/6">
            {data?.dueReminders.length ? data.dueReminders.slice(0, 4).map(reminder => (
              <button key={reminder.id} onClick={() => setLocation(`/customers/${reminder.customerId}`)} className="flex w-full items-center justify-between gap-3 p-4 text-right hover:bg-amber-50/60">
                <div className="min-w-0"><p className="truncate font-bold">{reminder.customer?.name || "عميل"}</p><p className="mt-1 text-xs text-amber-700">{reminder.customer?.customerCode ? `${reminder.customer.customerCode} · ` : ""}استحق في {formatDateTime(reminder.reminderDate)} · متأخر {reminder.daysOverdue} يوم</p></div>
                <ChevronLeft className="h-5 w-5 shrink-0 text-amber-600" />
              </button>
            )) : <EmptyRow text="لا توجد متابعة مستحقة الآن." />}
          </div>
        </div>
      </section>

      <section className="soft-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-teal-950/6 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="font-extrabold">حالة المخزنة</h2><p className="mt-1 text-xs text-muted-foreground">{data?.inventory.lowStockCount ? `${data.inventory.lowStockCount} أصناف تحتاج مراجعة الرصيد` : "الأرصدة المتاحة قيد المتابعة"}</p></div>
          <Button variant="outline" onClick={() => setLocation("/inventory")} className="rounded-xl border-teal-700/20 text-teal-800 hover:bg-teal-50"><PackageSearch className="ml-2 h-4 w-4" />إدارة المخزنة</Button>
        </div>
        {isLoading ? <EmptyRow text="جارٍ تحميل أسماء الأصناف…" /> : data?.inventory.items?.length ? <div className="p-4 sm:p-5"><div className="mb-3 flex items-center justify-between gap-3"><p className="text-xs font-bold text-muted-foreground">الأصناف الموجودة داخل المخزن</p><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-extrabold text-violet-700">{data.inventory.totalItems} صنف</span></div><div className="flex flex-wrap gap-2">{data.inventory.items.slice(0, 8).map(item => <span key={item.id} className="rounded-lg bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800">{item.name}</span>)}{data.inventory.items.length > 8 ? <span className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-600">+{data.inventory.items.length - 8} أصناف أخرى</span> : null}</div></div> : <EmptyRow text="لا توجد أصناف مسجلة في المخزن." />}
      </section>
    </div>
  );
}

function EmptyRow({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return <div className="flex flex-col items-center justify-center gap-3 p-8 text-center"><p className="text-sm text-muted-foreground">{text}</p>{action ? <button onClick={onAction} className="inline-flex items-center text-sm font-bold text-teal-700"><ArrowLeft className="ml-1 h-4 w-4" />{action}</button> : null}</div>;
}
