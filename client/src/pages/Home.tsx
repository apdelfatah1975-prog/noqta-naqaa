import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { formatDateTime, visitTypeLabels } from "@/lib/filterUi";
import { ReminderAlertBanner } from "@/components/ReminderAlertBanner";
import { ArrowLeft, BellRing, CalendarDays, CheckCircle2, ChevronLeft, CircleDollarSign, CloudDownload, Info, PackageSearch, RefreshCw, UsersRound } from "lucide-react";
import React from "react";
import { useLocation } from "wouter";

const statStyles = [
  { icon: BellRing, color: "bg-amber-500", label: "مستحقون للمتابعة", key: "due", href: "/reminders" },
  { icon: UsersRound, color: "bg-teal-700", label: "عملاء اليوم", key: "today", href: "/customers" },
  { icon: CalendarDays, color: "bg-sky-600", label: "زيارات قادمة", key: "upcoming", href: "/visits" },
  { icon: CircleDollarSign, color: "bg-slate-800", label: "رصيد الخزينة (ر.س)", key: "cash", href: "/cash" },
  { icon: PackageSearch, color: "bg-violet-600", label: "أصناف بالمخزنة", key: "inventory", href: "/inventory" },
] as const;

export default function Home() {
  const { data, isLoading } = trpc.filters.dashboard.useQuery();
  const { data: cash } = trpc.filters.cash.summary.useQuery();
  const { data: backupStatus, isLoading: backupLoading } = trpc.filters.backup.status.useQuery();
  const backupMutation = trpc.filters.backup.createNow.useMutation();
  const backupUtils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const counts = {
    today: data?.todayVisits.length ?? 0,
    upcoming: data?.upcomingVisits.length ?? 0,
    due: data?.dueReminders.length ?? 0,
    inventory: data?.inventory.totalItems ?? 0,
    cash: Math.round((cash?.balance ?? 0) / 100),
  };
  const nextVisit = data?.upcomingVisits[0];
  const nextDueReminder = data?.dueReminders[0];
  const cardDetails = {
    today: "الزيارات المسجلة لهذا اليوم",
    upcoming: nextVisit ? `${nextVisit.customer?.name || "عميل"} · ${formatDateTime(nextVisit.visitDate)}` : "لا توجد زيارات مسجلة",
    due: nextDueReminder ? `${nextDueReminder.customer?.name || "عميل"} · متأخر ${nextDueReminder.daysOverdue} يوم` : "لا توجد متابعة متأخرة",
    inventory: "عدد الأصناف المسجلة",
    cash: "الرصيد بالريال السعودي",
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="flex flex-col justify-between gap-4 rounded-3xl bg-[linear-gradient(135deg,#064e4a,#0f766e)] px-6 py-7 text-white shadow-[0_16px_40px_rgba(6,78,74,.22)] sm:flex-row sm:items-center sm:px-8">
        <div>
          <p className="text-sm font-bold text-teal-100">لوحة التحكم</p>
          <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">كل عملياتك في مكان واحد</h1>
          <p className="mt-2 text-sm text-teal-50/80">تابع الزيارات والعملاء والمخزنة بسرعة ووضوح.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => setLocation("/visits")} className="h-11 rounded-xl bg-white px-5 font-bold text-teal-800 hover:bg-teal-50">
            <CalendarDays className="ml-2 h-5 w-5" /> تسجيل زيارة جديدة
          </Button>
          <Button onClick={() => setLocation("/cash?entry=expense")} variant="outline" className="h-11 rounded-xl border-white/40 bg-white/10 px-5 font-bold text-white hover:bg-white/20 hover:text-white">
            <CircleDollarSign className="ml-2 h-5 w-5" /> تسجيل مصروف
          </Button>
        </div>
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
              <p className="mt-1 text-2xl font-extrabold">{isLoading ? "—" : counts[key]}</p><p className="mt-1 line-clamp-1 text-[11px] font-semibold text-muted-foreground" title={cardDetails[key]}>{isLoading ? "جارٍ التحميل…" : cardDetails[key]}</p>
            </div>
            <ChevronLeft className="h-5 w-5 text-teal-700 opacity-0 transition group-hover:translate-x-[-2px] group-hover:opacity-100" />
          </button>
        ))}
      </section>

      <ReminderAlertBanner />

      <section className="grid gap-6 xl:grid-cols-5">
        <div className="soft-card xl:col-span-3">
          <div className="flex items-center justify-between border-b border-teal-950/6 p-5">
            <div><div className="flex items-center gap-2"><h2 className="font-extrabold">الزيارات القادمة</h2><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-extrabold text-sky-700">{data?.upcomingVisits.length ?? 0}</span></div><p className="mt-1 text-xs text-muted-foreground">المواعيد المسجلة خلال الأيام الخمسة القادمة</p><p className="mt-1 text-[11px] font-semibold text-sky-700">تظهر من الغد وحتى خمسة أيام قبل الموعد</p></div>
            <div className="flex items-center gap-3"><span title="هذه مواعيد مسجلة خلال خمسة أيام قادمة" className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Info className="h-3.5 w-3.5" />خلال ٥ أيام</span><button onClick={() => setLocation("/visits")} className="text-sm font-bold text-teal-700 hover:text-teal-900">عرض الكل</button></div>
          </div>
          <div className="divide-y divide-teal-950/6">
            {data?.upcomingVisits.length ? data.upcomingVisits.map(visit => {
              const days = daysUntil(visit.visitDate);
              return <button key={visit.id} onClick={() => setLocation(`/customers/${visit.customerId}`)} className="flex w-full items-center justify-between gap-3 p-4 text-right hover:bg-teal-50/55">
                <div className="min-w-0"><p className="truncate font-bold">{visit.customer?.name || "عميل"}</p><p className="mt-1 text-xs text-muted-foreground">{visit.customer?.customerCode ? `${visit.customer.customerCode} · ` : ""}{visitTypeLabels[visit.visitType as keyof typeof visitTypeLabels] || "زيارة"} · {formatDateTime(visit.visitDate)}</p></div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${days <= 0 ? "bg-amber-100 text-amber-800" : "bg-sky-50 text-sky-700"}`}>{days === 0 ? "اليوم" : `بعد ${days} يوم`}</span><ChevronLeft className="h-5 w-5 shrink-0 text-teal-600" />
              </button>;
            }) : <EmptyRow text="لا توجد زيارات مسجلة قادمة حاليًا." action="تسجيل زيارة" onAction={() => setLocation("/visits")} />}
          </div>
        </div>

        <div className="soft-card xl:col-span-2">
          <div className="flex items-center justify-between border-b border-teal-950/6 p-5">
            <div><div className="flex items-center gap-2"><h2 className="font-extrabold">المتابعة المستحقة</h2><span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800">{data?.dueReminders.length ?? 0}</span></div><p className="mt-1 text-xs text-muted-foreground">تذكيرات أنشأها التطبيق بعد 120 يومًا من آخر تركيب أو صيانة</p></div>
            <div className="flex items-center gap-2"><span title="هذه القائمة تحتاج إجراء منك: اتصل بالعميل وحدد الزيارة" className="inline-flex items-center gap-1 text-xs font-bold text-amber-700"><Info className="h-3.5 w-3.5" />تحتاج متابعة</span><BellRing className="h-5 w-5 text-amber-500" /></div>
          </div>
          <div className="divide-y divide-teal-950/6">
            {data?.dueReminders.length ? data.dueReminders.slice(0, 4).map(reminder => (
              <button key={reminder.id} onClick={() => setLocation(`/customers/${reminder.customerId}`)} className="flex w-full items-center justify-between gap-3 p-4 text-right hover:bg-amber-50/60">
                <div className="min-w-0"><p className="truncate font-bold">{reminder.customer?.name || "عميل"}</p><p className="mt-1 text-xs text-amber-700">{reminder.customer?.customerCode ? `${reminder.customer.customerCode} · ` : ""}استحق في {formatDateTime(reminder.reminderDate)} · <strong>متأخر {reminder.daysOverdue} يوم</strong></p><p className="mt-1 text-[11px] font-bold text-teal-700">اضغط لفتح ملف العميل وتسجيل الزيارة</p></div>
                <ChevronLeft className="h-5 w-5 shrink-0 text-amber-600" />
              </button>
             )) : <EmptyRow text="لا توجد متابعة مستحقة الآن." action="عرض كل التذكيرات" onAction={() => setLocation("/reminders")} />}
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

      <section className="soft-card overflow-hidden border border-sky-200/70 bg-gradient-to-l from-sky-50/80 to-white">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-600 text-white shadow-lg shadow-sky-600/20"><CloudDownload className="h-5 w-5" /></div>
            <div>
              <h2 className="font-extrabold text-slate-900">النسخة الاحتياطية السحابية</h2>
              <p className="mt-1 text-xs leading-6 text-slate-600">تتحدث تلقائيًا بعد حفظ أي بيان، وتضم العملاء والزيارات والتذكيرات والمخزون والخزينة.</p>
              <p className="mt-1 text-[11px] font-bold text-sky-700">{backupLoading ? "جارٍ فحص آخر نسخة…" : backupStatus?.generatedAt ? `آخر مزامنة: ${formatDateTime(backupStatus.generatedAt)}` : "لم تُنشأ نسخة بعد"}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:min-w-52 sm:flex-row">
            {backupStatus?.downloadUrl ? <a href={backupStatus.downloadUrl} download="نقطة-نقاء-نسخة-احتياطية.xlsx" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-sky-700 px-4 text-sm font-extrabold text-white transition hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"><CloudDownload className="h-4 w-4" />تنزيل Excel</a> : null}
            <button type="button" disabled={backupMutation.isPending} onClick={() => backupMutation.mutate(undefined, { onSuccess: () => backupUtils.filters.backup.status.invalidate() })} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white px-4 text-sm font-extrabold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"><RefreshCw className={`h-4 w-4 ${backupMutation.isPending ? "animate-spin" : ""}`} />{backupStatus?.downloadUrl ? "تحديث النسخة" : "إنشاء النسخة الآن"}</button>
          </div>
        </div>
        {backupMutation.isSuccess ? <div className="flex items-center gap-2 border-t border-sky-200/70 px-5 py-3 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-4 w-4" />تم تحديث النسخة ويمكن تنزيلها الآن.</div> : null}
      </section>
    </div>
  );
}

function daysUntil(value: Date | string) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const date = new Date(value);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.ceil((target.getTime() - today.getTime()) / 86_400_000));
}

function EmptyRow({ text, action, onAction }: { text: string; action?: string; onAction?: () => void }) {
  return <div className="flex flex-col items-center justify-center gap-3 p-8 text-center"><p className="text-sm text-muted-foreground">{text}</p>{action ? <button onClick={onAction} className="inline-flex items-center text-sm font-bold text-teal-700"><ArrowLeft className="ml-1 h-4 w-4" />{action}</button> : null}</div>;
}
