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
    <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-teal-950 via-teal-900 to-cyan-800 p-5 text-white shadow-lg shadow-teal-950/10 sm:p-7">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div><span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-bold">متابعة العمل اليومية</span><h1 className="mt-3 text-3xl font-black tracking-tight">سجل الزيارات</h1><p className="mt-2 max-w-2xl text-sm leading-7 text-teal-50/85">كل زيارة في مكان واحد، بتفاصيل واضحة وسهلة للمراجعة والرجوع إلى ملف العميل.</p></div>
        <div className="grid grid-cols-2 gap-2 text-center text-xs font-bold sm:min-w-64"><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"><p className="text-2xl font-black">{rows.length.toLocaleString("ar-SA")}</p><p className="mt-1 text-teal-50/75">زيارة ظاهرة</p></div><div className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3"><p className="text-2xl font-black">{online ? "متصل" : "دون نت"}</p><p className="mt-1 text-teal-50/75">حالة البيانات</p></div></div>
      </div>
    </header>

    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard icon={<ClipboardList className="h-5 w-5" />} label="الزيارات الظاهرة" value={rows.length.toLocaleString("ar-SA")} tone="teal" />
      <SummaryCard icon={<CalendarCheck2 className="h-5 w-5" />} label="بانتظار المزامنة" value={pendingVisits.length.toLocaleString("ar-SA")} tone="amber" />
      <SummaryCard icon={<WalletCards className="h-5 w-5" />} label="إجمالي التحصيل" value={(totalCollected / 100).toLocaleString("ar-SA")} tone="sky" />
    </div>

    <VisitHistory rows={rows} search={search} onSearchChange={setSearch} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} dateFrom={dateFrom} onDateFromChange={setDateFrom} dateTo={dateTo} onDateToChange={setDateTo} onClearFilters={clearFilters} onOpenCustomer={customer => setLocation(`/customers/${customer.id}`)} onRecordVisit={customer => setLocation(`/customers?visit=1&customerId=${customer.id}`)} />
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
  const tones = { teal: "bg-teal-50 text-teal-800 border-teal-100", amber: "bg-amber-50 text-amber-800 border-amber-100", sky: "bg-sky-50 text-sky-800 border-sky-100" };
  return <div className={`soft-card flex items-center gap-3 border p-4 ${tones[tone]}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80">{icon}</div><div className="min-w-0"><p className="text-xs font-bold opacity-75">{label}</p><p className="mt-1 truncate text-xl font-black">{value}</p></div></div>;
}

function VisitHistory({ rows, search, onSearchChange, typeFilter, onTypeFilterChange, dateFrom, onDateFromChange, dateTo, onDateToChange, onClearFilters, onOpenCustomer, onRecordVisit }: { rows: VisitRow[]; search: string; onSearchChange: (value: string) => void; typeFilter: string; onTypeFilterChange: (value: string) => void; dateFrom: string; onDateFromChange: (value: string) => void; dateTo: string; onDateToChange: (value: string) => void; onClearFilters: () => void; onOpenCustomer: (customer: any) => void; onRecordVisit: (customer: any) => void }) {
  const hasFilters = Boolean(search.trim() || typeFilter !== "all" || dateFrom || dateTo);
  return <section className="soft-card overflow-hidden">
    <div className="border-b border-teal-950/6 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-teal-950">الزيارات المسجلة</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">استخدم البحث للوصول إلى العميل أو الفني أو تفاصيل الزيارة بسرعة.</p></div><span className="rounded-full bg-teal-50 px-3 py-1.5 text-sm font-black text-teal-700">{rows.length.toLocaleString("ar-SA")} زيارة</span></div>
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_auto] md:items-end"><label className="relative"><span className="field-label">بحث سريع</span><Search className="pointer-events-none absolute right-3 top-10 h-4 w-4 text-muted-foreground" /><input aria-label="البحث في سجل الزيارات" className="field-input pr-9" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="اسم العميل أو الكود أو الفني" /></label><label><span className="field-label">نوع الخدمة</span><select aria-label="تصفية حسب نوع الزيارة" className="field-input mt-1" value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)}><option value="all">كل الخدمات</option>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={onClearFilters} disabled={!hasFilters} className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" />مسح</button></div>
      <details className="mt-3 rounded-2xl bg-slate-50 px-4 py-3"><summary className="cursor-pointer text-sm font-bold text-slate-700">تحديد فترة زمنية <span className="font-normal text-muted-foreground">اختياري</span></summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="field-label">من تاريخ</span><input aria-label="من تاريخ الزيارة" type="date" className="field-input mt-1" value={dateFrom} onChange={event => onDateFromChange(event.target.value)} /></label><label><span className="field-label">إلى تاريخ</span><input aria-label="إلى تاريخ الزيارة" type="date" className="field-input mt-1" value={dateTo} onChange={event => onDateToChange(event.target.value)} /></label></div></details>
    </div>
    <div className="space-y-3 bg-slate-50/60 p-3 sm:p-5">{rows.length ? rows.map(visit => { const customer = visit.customer; return <article key={`${visit.id}-${visit.visitDate}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><button className="text-right text-lg font-black text-teal-900 hover:text-teal-700" onClick={() => customer && onOpenCustomer(customer)}>{customer?.name ?? "عميل غير معروف"}</button><span className="rounded-full bg-sky-50 px-2.5 py-1 text-xs font-black text-sky-700">{visitTypeLabels[visit.visitType as keyof typeof visitTypeLabels] ?? "زيارة"}</span>{visit.id < 0 ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-black text-amber-700">محفوظة محليًا</span> : null}</div><p className="mt-2 text-sm font-bold text-slate-500">{customer?.manualCode ? `كود ${customer.manualCode} · ` : ""}{formatDateTime(visit.visitDate)}</p><div className="mt-4 grid gap-3 sm:grid-cols-2"><Info label="الفني" value={visit.technicianName || "غير محدد"} /><Info label="المبلغ المحصل" value={(visit.collectedAmount ? visit.collectedAmount / 100 : 0).toLocaleString("ar-SA")} /></div></div><div className="grid gap-3 rounded-2xl bg-teal-50/60 p-4 text-sm sm:grid-cols-2 lg:min-w-[340px]"><Info label="العنوان" value={customer?.address || "غير مسجل"} /><Info label="الملاحظات" value={visit.notes || "لا توجد ملاحظات"} /></div></div>{customer && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3"><CustomerContactActions customer={customer} compact labels /><button type="button" onClick={() => onRecordVisit(customer)} className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-black text-white transition hover:bg-teal-800">تسجيل زيارة جديدة</button></div>}</article>; }) : <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center text-sm text-muted-foreground">لا توجد زيارات مطابقة للبحث أو التصفية.</div>}</div>
  </section>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-[11px] font-black text-slate-400">{label}</p><p className="mt-1 break-words font-black text-slate-700">{value}</p></div>; }
