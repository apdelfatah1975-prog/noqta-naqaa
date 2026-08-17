import { CustomerContactActions } from "@/components/CustomerContactActions";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { cacheOfflineCustomers, cacheOfflineVisits, getOfflineCustomers, getOfflineSession, getOfflineVisits, getPendingVisits, queueOfflineDelete } from "@/lib/offlineSync";
import { moveToTrash } from "@/lib/trashBin";
import { formatDateTime, visitTypeLabels } from "@/lib/filterUi";
import { downloadRowsAsExcel, visitExcelHeaders, visitRowsForExcel, withArabicHeaders } from "@/lib/excelExport";
import { printArabicPdf } from "@/lib/pdfExport";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp, ClipboardList, Download, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type VisitRow = any;

type CustomerVisitGroup = {
  key: string;
  customer: any;
  visits: VisitRow[];
};

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
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteVisit = trpc.filters.visits.delete.useMutation({ onSuccess: () => { setDeleteId(null); toast.success("تم حذف الزيارة ونقل نسختها إلى سلة المحذوفات"); }, onError: error => toast.error(error.message || "تعذر حذف الزيارة.") });

  useEffect(() => { if (customers) cacheOfflineCustomers(customers); }, [customers]);
  useEffect(() => {
    if (visitList) cacheOfflineVisits(visitList.map(visit => ({ id: visit.id, customerId: visit.customerId, visitType: visit.visitType, visitDate: new Date(visit.visitDate).toISOString(), technicianName: visit.technicianName, visitResult: visit.visitResult, notes: visit.notes, collectedAmount: visit.collectedAmount, collectedCurrency: "SAR" })));
  }, [visitList]);

  const customerMap = useMemo(() => new Map(visibleCustomers.map(customer => [customer.id, customer])), [visibleCustomers]);
  const rows = useMemo(() => filterVisitRows([
    ...visits.map(visit => ({ ...visit, customer: ("customer" in visit ? visit.customer : undefined) ?? customerMap.get(visit.customerId) })),
    ...pendingVisits.map(visit => ({ ...visit, id: -Math.abs(String(visit.clientOperationId ?? visit.visitDate).length), customer: customerMap.get(visit.customerId) })),
  ], { search, type: typeFilter, dateFrom, dateTo }), [customerMap, dateFrom, dateTo, pendingVisits, search, typeFilter, visits]);
  const clearFilters = () => { setSearch(""); setTypeFilter("all"); setDateFrom(""); setDateTo(""); };
  const selectedVisit: VisitRow | null = deleteId === null ? null : (rows.find(visit => visit.id === deleteId) ?? null);
  const exportVisits = () => {
    if (!rows.length) { toast.info("لا توجد زيارات مطابقة للتصدير"); return; }
    downloadRowsAsExcel(`سجل-الزيارات-نقطة-نقاء-${new Date().toISOString().slice(0, 10)}.xlsx`, "سجل الزيارات", withArabicHeaders(visitRowsForExcel(rows), visitExcelHeaders));
    toast.success(`تم تصدير ${rows.length.toLocaleString("ar-SA")} زيارة إلى ملف Excel`);
  };
  const exportVisitsPdf = () => {
    if (!rows.length) { toast.info("لا توجد زيارات مطابقة للتصدير"); return; }
    const pdfRows = withArabicHeaders(visitRowsForExcel(rows), visitExcelHeaders);
    const opened = printArabicPdf("سجل الزيارات", pdfRows, Object.entries(visitExcelHeaders).map(([key, label]) => ({ key: label, label })));
    if (opened) toast.success(`تم تجهيز PDF لعدد ${rows.length.toLocaleString("ar-SA")} زيارة`);
    else toast.error("تعذر فتح نافذة PDF؛ اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى");
  };

  return <div className="-mx-4 -mt-2 w-[calc(100%+2rem)] max-w-none space-y-4 px-0 sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-teal-800"><ClipboardList className="h-5 w-5" /></span><div><h1 className="page-heading">سجل الزيارات والعملاء الذين تمت زيارتهم</h1><p className="page-subheading">كل عميل يظهر مرة واحدة، وتظهر جميع زياراته وتفاصيلها داخل بطاقته.</p></div></div></div><div className="flex flex-wrap items-center gap-2 self-start sm:self-end"><button type="button" onClick={exportVisits} disabled={!rows.length} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 text-sm font-extrabold text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />Excel</button><button type="button" onClick={exportVisitsPdf} disabled={!rows.length} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 text-sm font-extrabold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />PDF</button><span className="rounded-xl bg-teal-100 px-3 py-2 text-sm font-black text-teal-800">{rows.length.toLocaleString("ar-SA")} زيارة</span><span className={`rounded-xl px-3 py-2 text-sm font-bold ${online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{online ? "متصل" : "دون نت"}</span></div></div>

    <VisitHistory rows={rows} search={search} onSearchChange={setSearch} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} dateFrom={dateFrom} onDateFromChange={setDateFrom} dateTo={dateTo} onDateToChange={setDateTo} onClearFilters={clearFilters} onOpenCustomer={customer => setLocation(`/customers/${customer.id}`)} onDelete={visit => setDeleteId(visit.id)} />
    <PinVerificationDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }} busy={deleteVisit.isPending} title="تأكيد حذف الزيارة" description="ستُنقل نسخة الزيارة إلى سلة المحذوفات قبل حذفها من السجل." onConfirm={pin => { if (!selectedVisit || !deleteId) return; moveToTrash({ entityType: "visit", entityLabel: `زيارة: ${selectedVisit.customer?.name ?? "عميل"}`, payload: selectedVisit }); if (!navigator.onLine && offlineUser) { queueOfflineDelete(offlineUser.id, { entity: "visit", id: deleteId, pin }); cacheOfflineVisits(getOfflineVisits().filter(visit => visit.id !== deleteId)); setDeleteId(null); toast.success("تم حذف الزيارة محليًا ونقل نسختها إلى السلة"); } else { deleteVisit.mutate({ id: deleteId, pin }); } }} />
  </div>;
}

export function filterVisitRows(rows: VisitRow[], filters: { search?: string; type?: string; dateFrom?: string; dateTo?: string }) {
  const search = filters.search?.trim().toLowerCase() ?? "";
  return rows.filter(visit => {
    const customer = visit.customer;
    const result = visit.visitResult ?? visit.visitOutcome ?? visit.result ?? "";
    const text = `${customer?.name ?? ""} ${customer?.manualCode ?? ""} ${customer?.phone ?? ""} ${customer?.address ?? ""} ${visit.notes ?? ""} ${result} ${visit.technicianName ?? ""}`.toLowerCase();
    const date = new Date(visit.visitDate).toISOString().slice(0, 10);
    return (!search || text.includes(search)) && (!filters.type || filters.type === "all" || visit.visitType === filters.type) && (!filters.dateFrom || date >= filters.dateFrom) && (!filters.dateTo || date <= filters.dateTo);
  });
}

function groupVisitsByCustomer(rows: VisitRow[]): CustomerVisitGroup[] {
  const groups = new Map<string, CustomerVisitGroup>();
  rows.forEach(visit => {
    const customer = visit.customer;
    const key = customer?.id ? `customer-${customer.id}` : `unknown-${customer?.name ?? "unknown"}`;
    const existing = groups.get(key);
    if (existing) existing.visits.push(visit);
    else groups.set(key, { key, customer, visits: [visit] });
  });
  return Array.from(groups.values()).sort((left, right) => {
    const leftDate = Math.max(...left.visits.map(visit => new Date(visit.visitDate).getTime()));
    const rightDate = Math.max(...right.visits.map(visit => new Date(visit.visitDate).getTime()));
    return rightDate - leftDate;
  });
}

function VisitHistory({ rows, search, onSearchChange, typeFilter, onTypeFilterChange, dateFrom, onDateFromChange, dateTo, onDateToChange, onClearFilters, onOpenCustomer, onDelete }: { rows: VisitRow[]; search: string; onSearchChange: (value: string) => void; typeFilter: string; onTypeFilterChange: (value: string) => void; dateFrom: string; onDateFromChange: (value: string) => void; dateTo: string; onDateToChange: (value: string) => void; onClearFilters: () => void; onOpenCustomer: (customer: any) => void; onDelete: (visit: VisitRow) => void }) {
  const hasFilters = Boolean(search.trim() || typeFilter !== "all" || dateFrom || dateTo);
  const groups = useMemo(() => groupVisitsByCustomer(rows), [rows]);
  const totalCollected = useMemo(() => rows.reduce((sum, visit) => sum + Number(visit.collectedAmount || 0), 0) / 100, [rows]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setExpanded(current => ({ ...current, [key]: !current[key] }));

  return <section className="soft-card overflow-hidden">
    <div className="border-b border-teal-950/6 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="relative min-w-0 flex-1"><span className="sr-only">بحث سريع</span><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="البحث في سجل الزيارات" className="field-input h-10 pr-9" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="بحث سريع: اسم العميل أو الكود أو الفني أو النتيجة" /></label>
        <label className="lg:w-44"><span className="sr-only">نوع الخدمة</span><select aria-label="تصفية حسب نوع الزيارة" className="field-input h-10" value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)}><option value="all">كل الخدمات</option>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <span className="shrink-0 rounded-full bg-teal-100 px-3 py-2 text-xs font-extrabold text-teal-900" aria-live="polite">العملاء: {groups.length.toLocaleString("ar-SA")} · الزيارات: {rows.length.toLocaleString("ar-SA")}</span>
        <button type="button" onClick={onClearFilters} disabled={!hasFilters} className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" />مسح</button>
      </div>
      <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5"><summary className="cursor-pointer text-sm font-bold text-slate-700">تحديد فترة زمنية <span className="font-normal text-muted-foreground">اختياري</span></summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="field-label">من تاريخ</span><input aria-label="من تاريخ الزيارة" type="date" className="field-input mt-1" value={dateFrom} onChange={event => onDateFromChange(event.target.value)} /></label><label><span className="field-label">إلى تاريخ</span><input aria-label="إلى تاريخ الزيارة" type="date" className="field-input mt-1" value={dateTo} onChange={event => onDateToChange(event.target.value)} /></label></div></details>
    </div>
    <div className="space-y-3 bg-slate-50/60 p-3 sm:p-4">{groups.length ? groups.map(group => {
      const customer = group.customer;
      const isExpanded = expanded[group.key] ?? true;
      return <article key={group.key} className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 bg-teal-50/70 px-3 py-3 sm:px-4"><div className="min-w-0"><button type="button" className="block max-w-full truncate text-right text-base font-black text-teal-950 hover:text-teal-700" onClick={() => customer && onOpenCustomer(customer)}>{customer?.name ?? "عميل غير معروف"}</button><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-teal-800"><span>الكود: {customer?.manualCode || "—"}</span><span>الهاتف: {customer?.phone || "—"}</span><span>{group.visits.length.toLocaleString("ar-SA")} زيارة</span></div></div><div className="flex items-center gap-2">{customer ? <CustomerContactActions customer={customer} compact labels /> : null}<button type="button" onClick={() => toggleGroup(group.key)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-teal-200 bg-white px-3 text-xs font-extrabold text-teal-800 hover:bg-teal-50" aria-expanded={isExpanded}>{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{isExpanded ? "طي التفاصيل" : "عرض التفاصيل"}</button></div></div>
        {isExpanded ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] table-fixed border-collapse text-right"><colgroup><col className="w-[110px]" /><col className="w-[130px]" /><col className="w-[120px]" /><col className="w-[100px]" /><col className="w-[190px]" /><col className="w-[270px]" /><col className="w-[120px]" /></colgroup><thead className="bg-white text-xs text-teal-950/70"><tr><th className="border-b border-teal-100 px-3 py-2 font-bold">نوع الزيارة</th><th className="border-b border-teal-100 px-3 py-2 font-bold">التاريخ والوقت</th><th className="border-b border-teal-100 px-3 py-2 font-bold">الفني</th><th className="border-b border-teal-100 px-3 py-2 font-bold">المبلغ</th><th className="border-b border-teal-100 px-3 py-2 font-bold">العنوان</th><th className="border-b border-teal-100 px-3 py-2 font-bold">نتيجة الزيارة</th><th className="border-b border-teal-100 px-3 py-2 font-bold">إجراءات</th></tr></thead><tbody>{group.visits.map(visit => { const result = visit.visitResult ?? visit.visitOutcome ?? visit.result ?? visit.notes ?? "لا توجد نتيجة مسجلة"; return <tr key={`${visit.id}-${visit.visitDate}`} className="align-top hover:bg-teal-50/40"><td className="border-b border-teal-50 px-3 py-2 text-sm font-bold text-sky-800">{visitTypeLabels[visit.visitType as keyof typeof visitTypeLabels] ?? "زيارة"}{visit.id < 0 ? <span className="mt-1 block text-[11px] font-bold text-amber-700">محفوظة محليًا</span> : null}</td><td className="border-b border-teal-50 px-3 py-2 text-sm font-bold text-teal-950">{formatDateTime(visit.visitDate)}</td><td className="border-b border-teal-50 px-3 py-2 text-sm font-bold text-teal-900">{visit.technicianName || "—"}</td><td className="border-b border-teal-50 px-3 py-2 text-sm font-extrabold text-emerald-700">{(visit.collectedAmount ? visit.collectedAmount / 100 : 0).toLocaleString("ar-SA")}</td><td className="border-b border-teal-50 px-3 py-2 text-sm text-slate-700"><p className="whitespace-normal break-words" title={customer?.address || "غير مسجل"}>{customer?.address || "غير مسجل"}</p></td><td className="border-b border-teal-50 px-3 py-2 text-sm text-slate-700"><span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">منفذة</span><p className="mt-1 whitespace-normal break-words" title={result}>{result}</p></td><td className="border-b border-teal-50 px-3 py-2"><div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => onDelete(visit)} className="inline-flex h-8 items-center rounded-lg bg-rose-50 px-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100">حذف</button></div></td></tr>; })}</tbody></table></div> : null}
      </article>;
    }) : <div className="p-12 text-center text-sm text-muted-foreground">لا توجد زيارات مطابقة للبحث أو التصفية.</div>}{groups.length ? <div className="flex items-center justify-between gap-3 border-t-2 border-teal-200 bg-teal-50 px-4 py-3 text-sm font-black text-teal-950"><span>إجمالي المبلغ المحصل للزيارات المعروضة</span><span className="text-base text-emerald-700">{totalCollected.toLocaleString("ar-SA")}</span></div> : null}</div>
  </section>;
}
