import { Button } from "@/components/ui/button";
import { cacheOfflineCustomers, cacheOfflineVisits, getOfflineCustomers, getOfflineSession, getOfflineVisits, getPendingVisits, queueOfflineVisit } from "@/lib/offlineSync";
import { CustomerContactActions } from "@/components/CustomerContactActions";
import { trpc } from "@/lib/trpc";
import { formatDateTime, toDateTimeLocal, visitTypeLabels } from "@/lib/filterUi";
import { CalendarClock, CalendarPlus, CheckCircle2, ChevronLeft, Search } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Currency = "SAR";

export default function Visits() {
  const input = useMemo(() => ({}), []);
  const { data: customers, isLoading } = trpc.filters.customers.list.useQuery(input);
  const { data: dashboard } = trpc.filters.dashboard.useQuery();
  const { data: visitList } = trpc.filters.visits.list.useQuery();
  const offlineCustomers = getOfflineCustomers();
  const offlineVisits = getOfflineVisits();
  const offlineUser = getOfflineSession();
  const visibleCustomers = customers ?? (!navigator.onLine ? offlineCustomers : []);
  const [, setLocation] = useLocation();
  const upcomingFollowUps = dashboard?.upcomingFollowUps ?? [];
  const [customerId, setCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const customerSearchResults = useMemo(() => {
    const query = customerQuery.trim().toLowerCase();
    if (!query) return visibleCustomers.slice(0, 8);
    return visibleCustomers.filter(customer => `${customer.name} ${customer.phone} ${customer.manualCode ?? ""}`.toLowerCase().includes(query)).slice(0, 8);
  }, [customerQuery, visibleCustomers]);
  const selectedCustomer = visibleCustomers.find(customer => String(customer.id) === customerId);
  useEffect(() => {
    const requestedCustomerId = new URLSearchParams(window.location.search).get("customerId");
    if (!requestedCustomerId || !visibleCustomers.length) return;
    if (!visibleCustomers.some(customer => String(customer.id) === requestedCustomerId)) return;
    setCustomerId(requestedCustomerId);
    setCustomerQuery("");
    window.history.replaceState({}, "", "/visits");
  }, [visibleCustomers]);
  const [visitType, setVisitType] = useState<keyof typeof visitTypeLabels>("maintenance");
  const [visitDate, setVisitDate] = useState(toDateTimeLocal());
  const [notes, setNotes] = useState("");
  const [technicianName, setTechnicianName] = useState("");
  const [collectedAmount, setCollectedAmount] = useState("");
  const [visitSearch, setVisitSearch] = useState("");
  const [visitTypeFilter, setVisitTypeFilter] = useState("all");
  const [collectedCurrency, setCollectedCurrency] = useState<Currency>("SAR");
  const utils = trpc.useUtils();
  const createVisit = trpc.filters.visits.create.useMutation({ onSuccess: result => { utils.filters.dashboard.invalidate(); utils.filters.customers.list.invalidate(); utils.filters.customers.get.invalidate(); utils.filters.reminders.due.invalidate(); utils.filters.visits.list.invalidate(); toast.success(result.reminderCreated ? "تم التسجيل وإنشاء تذكير تلقائي بعد 120 يومًا" : "تم تسجيل الزيارة بنجاح"); setNotes(""); setCollectedAmount(""); setCollectedCurrency("SAR"); }, onError: error => toast.error(error.message || "تعذر تسجيل الزيارة. يرجى المحاولة مرة أخرى.") });
  useEffect(() => { if (customers) cacheOfflineCustomers(customers); }, [customers]);
  useEffect(() => { if (visitList) cacheOfflineVisits(visitList.map(visit => ({ id: visit.id, customerId: visit.customerId, visitType: visit.visitType, visitDate: new Date(visit.visitDate).toISOString(), technicianName: visit.technicianName, notes: visit.notes, collectedAmount: visit.collectedAmount, collectedCurrency: "SAR" }))); }, [visitList]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!customerId) return toast.error("اختر العميل أولًا");
    if (!navigator.onLine) {
      const offlineUser = getOfflineSession();
      if (!offlineUser) return toast.error("افتح التطبيق مرة واحدة مع الإنترنت أولًا.");
      queueOfflineVisit(offlineUser.id, { customerId: Number(customerId), visitType, visitDate: new Date(visitDate).toISOString(), technicianName: technicianName || null, notes: notes || null, collectedAmount: Math.round(Number(collectedAmount || 0) * 100), collectedCurrency });
      setNotes("");
      setCollectedAmount("");
      setCollectedCurrency("SAR");
      toast.success("تم حفظ الزيارة على الجهاز وستتزامن تلقائيًا عند عودة الإنترنت.");
      return;
    }
    createVisit.mutate({ customerId: Number(customerId), visitType, visitDate: new Date(visitDate), technicianName: technicianName || null, notes: notes || null, collectedAmount: Math.round(Number(collectedAmount || 0) * 100), collectedCurrency });
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
    <section className="soft-card overflow-hidden"><div className="flex items-center gap-3 bg-teal-50/75 p-5"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-700 text-white"><CalendarPlus className="h-5 w-5" /></div><div><h2 className="font-extrabold">تسجيل زيارة جديدة</h2><p className="mt-1 text-xs text-muted-foreground">هذا النموذج لتسجيل ما تم تنفيذه، وليس لإنشاء موعد المتابعة تلقائيًا.</p></div></div><form onSubmit={submit} className="grid gap-5 p-5 sm:grid-cols-2"><div className="sm:col-span-2"><span className="field-label">العميل</span><div className="relative"><Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><input className="field-input pr-9" value={selectedCustomer ? `${selectedCustomer.name} — ${selectedCustomer.phone}` : customerQuery} onChange={event => { setCustomerQuery(event.target.value); setCustomerId(""); }} placeholder={isLoading && !visibleCustomers.length ? "جارٍ تحميل العملاء…" : "ابحث بالاسم أو الكود أو الهاتف"} required={!customerId} />{!selectedCustomer && customerSearchResults.length > 0 && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-teal-950/10 bg-white p-1 shadow-xl">{customerSearchResults.map(customer => <button type="button" key={customer.id} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-sm hover:bg-teal-50" onClick={() => { setCustomerId(String(customer.id)); setCustomerQuery(""); }}><span className="font-bold">{customer.name}</span><span className="text-xs text-muted-foreground">{customer.manualCode ?? ""} · {customer.phone}</span></button>)}</div>}{selectedCustomer && <button type="button" className="mt-1 text-xs font-bold text-teal-700" onClick={() => { setCustomerId(""); setCustomerQuery(""); }}>تغيير العميل</button>}</div></div><label><span className="field-label">نوع أمر الخدمة</span><select className="field-input" value={visitType} onChange={event => setVisitType(event.target.value as keyof typeof visitTypeLabels)}>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label><span className="field-label">تاريخ ووقت الزيارة</span><input type="datetime-local" className="field-input" value={visitDate} onChange={event => setVisitDate(event.target.value)} required /></label><label><span className="field-label">اسم الفني</span><input className="field-input" value={technicianName} onChange={event => setTechnicianName(event.target.value)} placeholder="اسم الفني المنفذ" /></label><label><span className="field-label">المبلغ المحصل (اختياري)</span><input type="number" min="0" step="0.01" className="field-input" value={collectedAmount} onChange={event => setCollectedAmount(event.target.value)} placeholder="مثال: 250" /></label><label><span className="field-label">عملة التحصيل</span><select className="field-input" value={collectedCurrency} onChange={event => setCollectedCurrency(event.target.value as Currency)}><option value="SAR">ريال سعودي (ر.س)</option></select></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={notes} onChange={event => setNotes(event.target.value)} placeholder="مثل نوع الفلتر، القطع التي تم استبدالها، أو ملاحظات للفريق" /></label><div className="flex items-center justify-between gap-3 border-t border-teal-950/6 pt-5 sm:col-span-2"><p className="flex items-center gap-2 text-xs leading-6 text-teal-700"><CheckCircle2 className="h-4 w-4 shrink-0" />{navigator.onLine ? "يُنشأ التذكير تلقائيًا لزيارات التركيب والصيانة." : "سيُحفظ السجل على هذا الجهاز ثم يتزامن تلقائيًا."}</p><Button type="submit" disabled={createVisit.isPending} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800">{createVisit.isPending ? "جارٍ الحفظ…" : navigator.onLine ? "تسجيل الزيارة" : "حفظ للمزامنة"}</Button></div></form></section>
    <VisitHistory visitList={visitList ?? (!navigator.onLine ? offlineVisits : [])} pendingVisits={!navigator.onLine && offlineUser ? getPendingVisits(offlineUser.id) : []} customers={visibleCustomers} search={visitSearch} onSearchChange={setVisitSearch} typeFilter={visitTypeFilter} onTypeFilterChange={setVisitTypeFilter} onOpenCustomer={customer => setLocation(`/customers/${customer.id}`)} />
  </div>;
}


function VisitHistory({ visitList, pendingVisits, customers, search, onSearchChange, typeFilter, onTypeFilterChange, onOpenCustomer }: { visitList: any[]; pendingVisits: any[]; customers: any[]; search: string; onSearchChange: (value: string) => void; typeFilter: string; onTypeFilterChange: (value: string) => void; onOpenCustomer: (customer: any) => void }) {
  const customerMap = new Map(customers.map(customer => [customer.id, customer]));
  const rows = [...visitList, ...pendingVisits.map(visit => ({ ...visit, id: -Math.abs(String(visit.clientOperationId ?? visit.visitDate).length), customer: customerMap.get(visit.customerId) }))].filter(visit => {
    const customer = visit.customer ?? customerMap.get(visit.customerId);
    const text = `${customer?.name ?? ""} ${customer?.phone ?? ""} ${visit.notes ?? ""} ${visit.technicianName ?? ""}`.toLowerCase();
    return (!search.trim() || text.includes(search.trim().toLowerCase())) && (typeFilter === "all" || visit.visitType === typeFilter);
  });
  return <section className="soft-card overflow-hidden"><div className="flex items-center justify-between gap-3 border-b border-teal-950/6 bg-white p-5"><div><h2 className="font-extrabold">سجل الزيارات المنفذة</h2><p className="mt-1 text-xs text-muted-foreground">كل زيارة تم تسجيلها، بما فيها الزيارات المحفوظة محليًا في انتظار المزامنة.</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-extrabold text-teal-700">{rows.length}</span></div><div className="grid gap-3 border-b border-teal-950/6 bg-slate-50/60 p-4 sm:grid-cols-[1fr_190px]"><label className="relative"><Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><input className="field-input pr-9" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="ابحث باسم العميل أو الهاتف أو الفني" /></label><select className="field-input" value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)}><option value="all">كل أنواع الزيارات</option>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="divide-y divide-teal-950/6">{rows.length ? rows.map(visit => { const customer = visit.customer ?? customerMap.get(visit.customerId); return <article key={`${visit.id}-${visit.visitDate}`} className="space-y-3 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><button className="text-right" onClick={() => customer && onOpenCustomer(customer)}><p className="font-extrabold text-teal-800">{customer?.name ?? "عميل غير معروف"}</p><p className="mt-1 text-xs text-muted-foreground">{customer?.manualCode ? `كود ${customer.manualCode} · ` : ""}{formatDateTime(visit.visitDate)}</p></button><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">{visitTypeLabels[visit.visitType as keyof typeof visitTypeLabels] ?? "زيارة"}{visit.id < 0 ? " · محفوظة محليًا" : ""}</span></div><div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3"><span><strong>الفني:</strong> {visit.technicianName || "غير محدد"}</span><span><strong>المبلغ:</strong> {((visit.collectedAmount ?? 0) / 100).toLocaleString("ar-SA")} ر.س</span><span><strong>الملاحظات:</strong> {visit.notes || "لا توجد"}</span></div>{customer && <CustomerContactActions customer={customer} compact labels />}</article>; }) : <div className="p-8 text-center text-sm text-muted-foreground">لا توجد زيارات مسجلة حتى الآن.</div>}</div></section>;
}
