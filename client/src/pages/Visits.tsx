import { Button } from "@/components/ui/button";
import { cacheOfflineCustomers, getOfflineCustomers, getOfflineSession, queueOfflineVisit } from "@/lib/offlineSync";
import { trpc } from "@/lib/trpc";
import { formatDateTime, toDateTimeLocal, visitTypeLabels } from "@/lib/filterUi";
import { CalendarClock, CalendarPlus, CheckCircle2, ChevronLeft } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Currency = "SAR";

export default function Visits() {
  const input = useMemo(() => ({}), []);
  const { data: customers, isLoading } = trpc.filters.customers.list.useQuery(input);
  const { data: dashboard } = trpc.filters.dashboard.useQuery();
  const offlineCustomers = getOfflineCustomers();
  const visibleCustomers = customers ?? (!navigator.onLine ? offlineCustomers : []);
  const [, setLocation] = useLocation();
  const upcomingFollowUps = dashboard?.upcomingFollowUps ?? [];
  const [customerId, setCustomerId] = useState("");
  const [visitType, setVisitType] = useState<keyof typeof visitTypeLabels>("maintenance");
  const [visitDate, setVisitDate] = useState(toDateTimeLocal());
  const [notes, setNotes] = useState("");
  const [collectedAmount, setCollectedAmount] = useState("");
  const [collectedCurrency, setCollectedCurrency] = useState<Currency>("SAR");
  const utils = trpc.useUtils();
  const createVisit = trpc.filters.visits.create.useMutation({ onSuccess: result => { utils.filters.dashboard.invalidate(); utils.filters.customers.list.invalidate(); utils.filters.customers.get.invalidate(); utils.filters.reminders.due.invalidate(); toast.success(result.reminderCreated ? "تم التسجيل وإنشاء تذكير تلقائي بعد 120 يومًا" : "تم تسجيل الزيارة بنجاح"); setNotes(""); setCollectedAmount(""); setCollectedCurrency("SAR"); }, onError: error => toast.error(error.message || "تعذر تسجيل الزيارة. يرجى المحاولة مرة أخرى.") });
  useEffect(() => { if (customers) cacheOfflineCustomers(customers); }, [customers]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!customerId) return toast.error("اختر العميل أولًا");
    if (!navigator.onLine) {
      const offlineUser = getOfflineSession();
      if (!offlineUser) return toast.error("افتح التطبيق مرة واحدة مع الإنترنت أولًا.");
      queueOfflineVisit(offlineUser.id, { customerId: Number(customerId), visitType, visitDate: new Date(visitDate).toISOString(), notes: notes || null, collectedAmount: Math.round(Number(collectedAmount || 0) * 100), collectedCurrency });
      setNotes("");
      setCollectedAmount("");
      setCollectedCurrency("SAR");
      toast.success("تم حفظ الزيارة على الجهاز وستتزامن تلقائيًا عند عودة الإنترنت.");
      return;
    }
    createVisit.mutate({ customerId: Number(customerId), visitType, visitDate: new Date(visitDate), notes: notes || null, collectedAmount: Math.round(Number(collectedAmount || 0) * 100), collectedCurrency });
  }
  return <div className="mx-auto max-w-4xl space-y-6">
    <div><h1 className="page-heading">المتابعات القادمة وتسجيل زيارة</h1><p className="page-subheading">تظهر المتابعات تلقائيًا قبل موعدها بخمسة أيام، ويمكنك تسجيل الزيارة من القسم المنفصل أدناه.</p></div>
    <section className="soft-card overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-teal-950/6 bg-sky-50/75 p-5">
        <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-sky-600 text-white"><CalendarClock className="h-5 w-5" /></div><div><h2 className="font-extrabold">العملاء أصحاب المتابعة القادمة</h2><p className="mt-1 text-xs text-muted-foreground">يعرض التطبيق العميل تلقائيًا قبل الموعد بخمسة أيام.</p></div></div>
        <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-extrabold text-sky-700">{upcomingFollowUps.length}</span>
      </div>
      <div className="divide-y divide-teal-950/6">
        {upcomingFollowUps.length ? upcomingFollowUps.map(reminder => { const days = reminder.customer?.followUp?.daysRemaining ?? 0; return <button key={reminder.id} onClick={() => setLocation(`/customers/${reminder.customerId}`)} className="flex w-full items-center justify-between gap-3 p-4 text-right transition hover:bg-sky-50/60"><div className="min-w-0"><p className="truncate font-bold">{reminder.customer?.name || "عميل"}</p><p className="mt-1 text-xs text-muted-foreground">{reminder.customer?.customerCode ? `${reminder.customer.customerCode} · ` : ""}متابعة تلقائية · {formatDateTime(reminder.reminderDate)}</p></div><span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-extrabold ${days <= 0 ? "bg-amber-100 text-amber-800" : "bg-sky-50 text-sky-700"}`}>{days === 0 ? "اليوم" : days < 0 ? `متأخر ${Math.abs(days)} يوم` : `بعد ${days} يوم`}<ChevronLeft className="mr-1 inline h-3.5 w-3.5" /></span></button>; }) : <div className="p-8 text-center text-sm text-muted-foreground">لا توجد متابعات قريبة حاليًا. ستظهر تلقائيًا قبل الموعد بخمسة أيام.</div>}
      </div>
    </section>
    <section className="soft-card overflow-hidden"><div className="flex items-center gap-3 bg-teal-50/75 p-5"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-white"><CalendarPlus className="h-5 w-5" /></div><div><h2 className="font-extrabold">تسجيل زيارة جديدة</h2><p className="mt-1 text-xs text-muted-foreground">هذا النموذج لتسجيل ما تم تنفيذه، وليس لإنشاء موعد المتابعة تلقائيًا.</p></div></div><form onSubmit={submit} className="grid gap-5 p-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="field-label">العميل</span><select className="field-input" value={customerId} onChange={event => setCustomerId(event.target.value)} required><option value="">{isLoading && !visibleCustomers.length ? "جارٍ تحميل العملاء…" : "اختر العميل"}</option>{visibleCustomers.map(customer => <option key={customer.id} value={customer.id}>{customer.name} — {customer.phone}</option>)}</select></label><label><span className="field-label">نوع الزيارة</span><select className="field-input" value={visitType} onChange={event => setVisitType(event.target.value as keyof typeof visitTypeLabels)}>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="field-label">تاريخ ووقت الزيارة</span><input type="datetime-local" className="field-input" value={visitDate} onChange={event => setVisitDate(event.target.value)} required /></label><label><span className="field-label">المبلغ المحصل (اختياري)</span><input type="number" min="0" step="0.01" className="field-input" value={collectedAmount} onChange={event => setCollectedAmount(event.target.value)} placeholder="مثال: 250" /></label><label><span className="field-label">عملة التحصيل</span><select className="field-input" value={collectedCurrency} onChange={event => setCollectedCurrency(event.target.value as Currency)}><option value="SAR">ريال سعودي (ر.س)</option></select></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={notes} onChange={event => setNotes(event.target.value)} placeholder="مثل نوع الفلتر، القطع التي تم استبدالها، أو ملاحظات للفريق" /></label><div className="flex items-center justify-between gap-3 border-t border-teal-950/6 pt-5 sm:col-span-2"><p className="flex items-center gap-2 text-xs leading-6 text-teal-700"><CheckCircle2 className="h-4 w-4 shrink-0" />{navigator.onLine ? "يُنشأ التذكير تلقائيًا لزيارات التركيب والصيانة." : "سيُحفظ السجل على هذا الجهاز ثم يتزامن تلقائيًا."}</p><Button type="submit" disabled={createVisit.isPending} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800">{createVisit.isPending ? "جارٍ الحفظ…" : navigator.onLine ? "تسجيل الزيارة" : "حفظ للمزامنة"}</Button></div></form></section>
  </div>;
}
