import { CustomerContactActions } from "@/components/CustomerContactActions";
import { cacheOfflineCustomers, cacheOfflineVisits, getOfflineCustomers, getOfflineSession, getOfflineVisits, getPendingVisits } from "@/lib/offlineSync";
import { formatDateTime, visitTypeLabels } from "@/lib/filterUi";
import { trpc } from "@/lib/trpc";
import { CalendarCheck2, ClipboardList, Search, WalletCards, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

type VisitRow = any;

export default function Visits() {
  const input = useMemo(() => ({}), []);
  const { data: customers } = trpc.filters.customers.list.useQuery(input);
  const { data: visitList } = trpc.filters.visits.list.useQuery();
  const offlineCustomers = getOfflineCustomers();
  const offlineVisits = getOfflineVisits();
  const offlineUser = getOfflineSession();
  const online = navigator.onLine;
  const visibleCustomers = customers ?? (!online ? offlineCustomers : []);
  const visits = visitList ?? (!online ? offlineVisits : []);
  const pendingVisits = !online && offlineUser ? getPendingVisits(offlineUser.id) : [];
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => { if (customers) cacheOfflineCustomers(customers); }, [customers]);
  useEffect(() => {
    if (visitList) cacheOfflineVisits(visitList.map(visit => ({ id: visit.id, customerId: visit.customerId, visitType: visit.visitType, visitDate: new Date(visit.visitDate).toISOString(), technicianName: visit.technicianName, notes: visit.notes, collectedAmount: visit.collectedAmount, collectedCurrency: "SAR" })));
  }, [visitList]);

  const customerMap = useMemo(() => new Map(visibleCustomers.map(customer => [customer.id, customer])), [visibleCustomers]);
  const rows = useMemo(() => filterVisitRows([
    ...visits.map(visit => ({ ...visit, customer: ("customer" in visit ? visit.customer : undefined) ?? customerMap.get(visit.customerId) })),
    ...pendingVisits.map(visit => ({ ...visit, id: -Math.abs(String(visit.clientOperationId ?? visit.visitDate).length), customer: customerMap.get(visit.customerId) })),
  ], { search, type: typeFilter, dateFrom, dateTo }), [customerMap, dateFrom, dateTo, pendingVisits, search, typeFilter, visits]);
  const totalCollected = rows.reduce((sum, visit) => sum + (visit.collectedAmount ?? 0), 0);
  const clearFilters = () => { setSearch(""); setTypeFilter("all"); setDateFrom(""); setDateTo(""); };

  return <div className="mx-auto max-w-6xl space-y-5">
    <header className="flex flex-col gap-4 rounded-3xl bg-gradient-to-l from-teal-950 to-teal-800 p-5 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><div className="mb-2 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">سجل ومتابعة العمل</div><h1 className="text-2xl font-black tracking-tight">سجل الزيارات</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-teal-50/85">هنا ترى الزيارات التي تمت بكل تفاصيلها. تسجيل زيارة جديدة يتم من بطاقة العميل مباشرة.</p></div>
      <div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold leading-6">{online ? "متصل بالمزامنة" : "يعمل دون إنترنت"}<br /><span className="font-normal text-teal-50/75">{pendingVisits.length ? `${pendingVisits.length} زيارة بانتظار المزامنة` : "البيانات الحالية محفوظة"}</span></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard icon={<ClipboardList className="h-5 w-5" />} label="الزيارات الظاهرة" value={rows.length.toLocaleString("ar-SA")} tone="teal" />
      <SummaryCard icon={<CalendarCheck2 className="h-5 w-5" />} label="محفوظة محليًا" value={pendingVisits.length.toLocaleString("ar-SA")} tone="amber" />
      <SummaryCard icon={<WalletCards className="h-5 w-5" />} label="إجمالي التحصيل" value={`${(totalCollected / 100).toLocaleString("ar-SA")} ر.س`} tone="sky" />
    </div>

    <VisitHistory rows={rows} search={search} onSearchChange={setSearch} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} dateFrom={dateFrom} onDateFromChange={setDateFrom} dateTo={dateTo} onDateToChange={setDateTo} onClearFilters={clearFilters} onOpenCustomer={customer => setLocation(`/customers/${customer.id}`)} />
  </div>;
}

export function filterVisitRows(rows: VisitRow[], filters: { search?: string; type?: string; dateFrom?: string; dateTo?: string }) {
  const search = filters.search?.trim().toLowerCase() ?? "";
  return rows.filter(visit => {
    const customer = visit.customer;
    const text = `${customer?.name ?? ""} ${customer?.manualCode ?? ""} ${customer?.phone ?? ""} ${customer?.address ?? ""} ${visit.notes ?? ""} ${visit.technicianName ?? ""}`.toLowerCase();
    const date = new Date(visit.visitDate).toISOString().slice(0, 10);
    return (!search || text.includes(search)) && (!filters.type || filters.type === "all" || visit.visitType === filters.type) && (!filters.dateFrom || date >= filters.dateFrom) && (!filters.dateTo || date <= filters.dateTo);
  });
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "teal" | "amber" | "sky" }) {
  const tones = { teal: "bg-teal-50 text-teal-800", amber: "bg-amber-50 text-amber-800", sky: "bg-sky-50 text-sky-800" };
  return <div className={`soft-card flex items-center gap-3 p-4 ${tones[tone]}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80">{icon}</div><div className="min-w-0"><p className="text-xs font-bold opacity-75">{label}</p><p className="mt-1 truncate text-lg font-extrabold">{value}</p></div></div>;
}

function VisitHistory({ rows, search, onSearchChange, typeFilter, onTypeFilterChange, dateFrom, onDateFromChange, dateTo, onDateToChange, onClearFilters, onOpenCustomer }: { rows: VisitRow[]; search: string; onSearchChange: (value: string) => void; typeFilter: string; onTypeFilterChange: (value: string) => void; dateFrom: string; onDateFromChange: (value: string) => void; dateTo: string; onDateToChange: (value: string) => void; onClearFilters: () => void; onOpenCustomer: (customer: any) => void }) {
  const hasFilters = Boolean(search.trim() || typeFilter !== "all" || dateFrom || dateTo);
  return <section className="soft-card overflow-hidden">
    <div className="border-b border-teal-950/6 bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black text-teal-950">الزيارات المسجلة</h2><p className="mt-1 text-xs text-muted-foreground">ابحث بسرعة، ثم افتح بطاقة العميل لمراجعة بياناته أو تسجيل زيارة جديدة.</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-extrabold text-teal-700">{rows.length.toLocaleString("ar-SA")} زيارة</span></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_200px_auto] sm:items-end"><label className="relative"><span className="field-label">بحث في السجل</span><Search className="pointer-events-none absolute right-3 top-10 h-4 w-4 text-muted-foreground" /><input aria-label="البحث في سجل الزيارات" className="field-input pr-9" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="اسم العميل أو الكود أو الهاتف" /></label><label><span className="field-label">نوع الزيارة</span><select aria-label="تصفية حسب نوع الزيارة" className="field-input mt-1" value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)}><option value="all">كل الأنواع</option>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={onClearFilters} disabled={!hasFilters} className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" />مسح البحث</button></div>
      <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2"><summary className="cursor-pointer text-sm font-bold text-slate-700">تصفية حسب الفترة الزمنية <span className="font-normal text-muted-foreground">(اختياري)</span></summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="field-label">من تاريخ</span><input aria-label="من تاريخ الزيارة" type="date" className="field-input mt-1" value={dateFrom} onChange={event => onDateFromChange(event.target.value)} /></label><label><span className="field-label">إلى تاريخ</span><input aria-label="إلى تاريخ الزيارة" type="date" className="field-input mt-1" value={dateTo} onChange={event => onDateToChange(event.target.value)} /></label></div></details>
    </div>
    <div className="divide-y divide-teal-950/6 bg-slate-50/35">{rows.length ? rows.map(visit => { const customer = visit.customer; return <article key={`${visit.id}-${visit.visitDate}`} className="p-4 transition-colors hover:bg-white sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><button className="text-right text-base font-black text-teal-800 hover:text-teal-950" onClick={() => customer && onOpenCustomer(customer)}>{customer?.name ?? "عميل غير معروف"}</button><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700">{visitTypeLabels[visit.visitType as keyof typeof visitTypeLabels] ?? "زيارة"}</span>{visit.id < 0 ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">محفوظة محليًا</span> : null}</div><p className="mt-1 text-xs text-muted-foreground">{customer?.manualCode ? `كود ${customer.manualCode} · ` : ""}{customer?.phone || "بدون هاتف"} · {formatDateTime(visit.visitDate)}</p></div><div className="grid gap-2 rounded-2xl bg-white p-3 text-sm shadow-sm sm:grid-cols-2 lg:min-w-[460px] lg:grid-cols-4"><Info label="الفني" value={visit.technicianName || "غير محدد"} /><Info label="المبلغ المحصل" value={`${((visit.collectedAmount ?? 0) / 100).toLocaleString("ar-SA")} ر.س`} /><Info label="العنوان" value={customer?.address || "غير مسجل"} wide /><Info label="الملاحظات" value={visit.notes || "لا توجد ملاحظات"} wide /></div></div>{customer && <div className="mt-3 border-t border-slate-200 pt-3"><CustomerContactActions customer={customer} compact labels /></div>}</article>; }) : <div className="p-12 text-center text-sm text-muted-foreground">لا توجد زيارات مطابقة للبحث أو التصفية.</div>}</div>
  </section>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={wide ? "sm:col-span-2 lg:col-span-2" : ""}><p className="text-[11px] font-bold text-slate-400">{label}</p><p className="mt-0.5 break-words font-bold text-slate-700">{value}</p></div>; }
