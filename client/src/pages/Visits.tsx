import { CustomerContactActions } from "@/components/CustomerContactActions";
import { cacheOfflineCustomers, cacheOfflineVisits, getOfflineCustomers, getOfflineSession, getOfflineVisits, getPendingVisits } from "@/lib/offlineSync";
import { formatDateTime, visitTypeLabels } from "@/lib/filterUi";
import { trpc } from "@/lib/trpc";
import { CalendarCheck2, ClipboardList, Search, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";

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
  const [visitSearch, setVisitSearch] = useState("");
  const [visitTypeFilter, setVisitTypeFilter] = useState("all");

  useEffect(() => { if (customers) cacheOfflineCustomers(customers); }, [customers]);
  useEffect(() => {
    if (visitList) cacheOfflineVisits(visitList.map(visit => ({ id: visit.id, customerId: visit.customerId, visitType: visit.visitType, visitDate: new Date(visit.visitDate).toISOString(), technicianName: visit.technicianName, notes: visit.notes, collectedAmount: visit.collectedAmount, collectedCurrency: "SAR" })));
  }, [visitList]);

  const customerMap = useMemo(() => new Map(visibleCustomers.map(customer => [customer.id, customer])), [visibleCustomers]);
  const rows = useMemo(() => [...visits.map(visit => ({ ...visit, customer: ("customer" in visit ? visit.customer : undefined) ?? customerMap.get(visit.customerId) })), ...pendingVisits.map(visit => ({ ...visit, id: -Math.abs(String(visit.clientOperationId ?? visit.visitDate).length), customer: customerMap.get(visit.customerId) }))].filter(visit => {
    const customer = visit.customer;
    const text = `${customer?.name ?? ""} ${customer?.phone ?? ""} ${customer?.address ?? ""} ${visit.notes ?? ""} ${visit.technicianName ?? ""}`.toLowerCase();
    return (!visitSearch.trim() || text.includes(visitSearch.trim().toLowerCase())) && (visitTypeFilter === "all" || visit.visitType === visitTypeFilter);
  }), [customerMap, pendingVisits, visitSearch, visitTypeFilter, visits]);
  const totalCollected = rows.reduce((sum, visit) => sum + (visit.collectedAmount ?? 0), 0);

  return <div className="mx-auto max-w-5xl space-y-6">
    <div><h1 className="page-heading">سجل الزيارات</h1><p className="page-subheading">جميع الزيارات المسجلة بالتفاصيل، مع البحث والتصفية وفتح ملف العميل مباشرة.</p></div>
    <div className="grid gap-3 sm:grid-cols-3">
      <SummaryCard icon={<ClipboardList className="h-5 w-5" />} label="إجمالي الزيارات" value={rows.length.toLocaleString("ar-SA")} tone="teal" />
      <SummaryCard icon={<CalendarCheck2 className="h-5 w-5" />} label="زيارات محفوظة محليًا" value={pendingVisits.length.toLocaleString("ar-SA")} tone="amber" />
      <SummaryCard icon={<WalletCards className="h-5 w-5" />} label="إجمالي التحصيل الظاهر" value={`${(totalCollected / 100).toLocaleString("ar-SA")} ر.س`} tone="sky" />
    </div>
    <VisitHistory rows={rows} search={visitSearch} onSearchChange={setVisitSearch} typeFilter={visitTypeFilter} onTypeFilterChange={setVisitTypeFilter} onOpenCustomer={customer => setLocation(`/customers/${customer.id}`)} />
  </div>;
}

function SummaryCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "teal" | "amber" | "sky" }) {
  const tones = { teal: "bg-teal-50 text-teal-800", amber: "bg-amber-50 text-amber-800", sky: "bg-sky-50 text-sky-800" };
  return <div className={`soft-card flex items-center gap-3 p-4 ${tones[tone]}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/80">{icon}</div><div className="min-w-0"><p className="text-xs font-bold opacity-75">{label}</p><p className="mt-1 truncate text-lg font-extrabold">{value}</p></div></div>;
}

function VisitHistory({ rows, search, onSearchChange, typeFilter, onTypeFilterChange, onOpenCustomer }: { rows: any[]; search: string; onSearchChange: (value: string) => void; typeFilter: string; onTypeFilterChange: (value: string) => void; onOpenCustomer: (customer: any) => void }) {
  return <section className="soft-card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-950/6 bg-white p-5"><div><h2 className="font-extrabold">كل تفاصيل الزيارات</h2><p className="mt-1 text-xs text-muted-foreground">العميل، التاريخ، نوع أمر الخدمة، الفني، المبلغ، الملاحظات ووسائل التواصل.</p></div><span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-extrabold text-teal-700">{rows.length.toLocaleString("ar-SA")}</span></div><div className="grid gap-3 border-b border-teal-950/6 bg-slate-50/60 p-4 sm:grid-cols-[1fr_190px]"><label className="relative"><Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-muted-foreground" /><input className="field-input pr-9" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="ابحث باسم العميل أو الهاتف أو الفني أو الملاحظات" /></label><select className="field-input" value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)}><option value="all">كل أنواع الزيارات</option>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="divide-y divide-teal-950/6">{rows.length ? rows.map(visit => { const customer = visit.customer; return <article key={`${visit.id}-${visit.visitDate}`} className="space-y-3 p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><button className="min-w-0 text-right" onClick={() => customer && onOpenCustomer(customer)}><p className="font-extrabold text-teal-800">{customer?.name ?? "عميل غير معروف"}</p><p className="mt-1 text-xs text-muted-foreground">{customer?.manualCode ? `كود ${customer.manualCode} · ` : ""}{customer?.phone || "بدون هاتف"} · {formatDateTime(visit.visitDate)}</p></button><span className="shrink-0 rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">{visitTypeLabels[visit.visitType as keyof typeof visitTypeLabels] ?? "زيارة"}{visit.id < 0 ? " · محفوظة محليًا" : ""}</span></div><div className="grid gap-2 rounded-xl bg-slate-50/80 p-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4"><span><strong>الفني:</strong> {visit.technicianName || "غير محدد"}</span><span><strong>المبلغ المحصل:</strong> {((visit.collectedAmount ?? 0) / 100).toLocaleString("ar-SA")} ر.س</span><span className="sm:col-span-2"><strong>العنوان:</strong> {customer?.address || "غير مسجل"}</span><span className="sm:col-span-2 lg:col-span-4"><strong>الملاحظات:</strong> {visit.notes || "لا توجد ملاحظات"}</span></div>{customer && <CustomerContactActions customer={customer} compact labels />}</article>; }) : <div className="p-10 text-center text-sm text-muted-foreground">لا توجد زيارات مطابقة للبحث أو التصفية.</div>}</div></section>;
}
