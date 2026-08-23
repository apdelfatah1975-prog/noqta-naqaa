import { CustomerContactActions } from "@/components/CustomerContactActions";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { moveToTrash } from "@/lib/trashBin";
import { formatDateTime, visitTypeLabels } from "@/lib/filterUi";
import { downloadRowsAsExcel, visitExcelHeaders, visitRowsForExcel, withArabicHeaders } from "@/lib/excelExport";
import { printArabicPdf } from "@/lib/pdfExport";
import { trpc } from "@/lib/trpc";
import { formatAppMoney, getAppSettings, saveAppSettings } from "@/lib/appSettings";
import { extractArray } from "@/lib/dataNormalization";
import { ChevronDown, ChevronUp, ClipboardList, Download, Pencil, Search, X } from "lucide-react";
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
  const customersQuery = trpc.filters.customers.list.useQuery(input, {
    staleTime: 5_000,
    refetchInterval: 8_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    networkMode: "online",
  });
  const visitsQuery = trpc.filters.visits.list.useQuery(undefined, {
    staleTime: 5_000,
    refetchInterval: 8_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    networkMode: "online",
  });
  const { data: customers } = customersQuery;
  const { data: visitList } = visitsQuery;
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  const normalizedCustomers = useMemo(() => extractArray<VisitRow>(customers), [customers]);
  const normalizedVisits = useMemo(() => normalizeVisitRows(visitList), [visitList]);
  const visibleCustomers = normalizedCustomers;
  // The server response is the only operational source of truth; invalid or empty responses become [].
  const visits = normalizedVisits;
  const pendingVisits: VisitRow[] = [];
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [editVisit, setEditVisit] = useState<VisitRow | null>(null);
  const [compactMobile, setCompactMobile] = useState(() => getAppSettings().compactVisitsOnMobile);
  const utils = trpc.useUtils();
  const deleteVisit = trpc.filters.visits.delete.useMutation({ onSuccess: () => { setDeleteId(null); toast.success("تم حذف الزيارة ونقل نسختها إلى سلة المحذوفات"); }, onError: error => toast.error(error.message || "تعذر حذف الزيارة.") });
  const updateVisit = trpc.filters.visits.updateDetails.useMutation({ onSuccess: async () => { setEditVisit(null); await utils.filters.visits.list.invalidate(); toast.success("تم تصحيح تسجيل الزيارة والخزينة"); }, onError: error => toast.error(error.message || "تعذر تصحيح تسجيل الزيارة.") });

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  useEffect(() => {
    const onSettingsChange = (event: Event) => setCompactMobile(Boolean((event as CustomEvent<{ compactVisitsOnMobile?: boolean }>).detail?.compactVisitsOnMobile));
    window.addEventListener("purepoint-settings-changed", onSettingsChange);
    return () => window.removeEventListener("purepoint-settings-changed", onSettingsChange);
  }, []);
  const customerMap = useMemo(() => new Map(visibleCustomers.map(customer => [customer.id, customer])), [visibleCustomers]);
  const rows = useMemo(() => {
    const safeVisits = Array.isArray(visits) ? visits : [];
    return filterVisitRows(
      safeVisits.map(visit => ({ ...visit, customer: ("customer" in visit ? visit.customer : undefined) ?? customerMap.get(visit.customerId) })),
      { search, type: typeFilter, dateFrom, dateTo },
    );
  }, [customerMap, dateFrom, dateTo, pendingVisits, search, typeFilter, visits]);
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

  return <div className="mx-auto -mt-2 w-full max-w-none space-y-4 px-0 sm:-mx-6 sm:w-[calc(100%+3rem)] sm:px-0 lg:-mx-8 lg:w-[calc(100%+4rem)]">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-teal-800"><ClipboardList className="h-5 w-5" /></span><div><h1 className="page-heading">سجل الزيارات والعملاء الذين تمت زيارتهم</h1><p className="page-subheading">كل عميل يظهر مرة واحدة، وتظهر جميع زياراته وتفاصيلها داخل بطاقته.</p></div></div></div><div className="flex flex-wrap items-center gap-2 self-start sm:self-end"><button type="button" onClick={exportVisits} disabled={!rows.length} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 text-sm font-extrabold text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />Excel</button><button type="button" onClick={exportVisitsPdf} disabled={!rows.length} className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-sky-200 bg-white px-3 text-sm font-extrabold text-sky-800 transition hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-50"><Download className="h-4 w-4" />PDF</button><span className="rounded-xl bg-teal-100 px-3 py-2 text-sm font-black text-teal-800">{rows.length.toLocaleString("ar-SA")} زيارة</span><span className={`rounded-xl px-3 py-2 text-sm font-bold ${online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{online ? "متصل" : "دون نت"}</span></div></div>

    <VisitHistory compactMobile={compactMobile} onToggleCompact={() => { const next = !compactMobile; setCompactMobile(next); saveAppSettings({ compactVisitsOnMobile: next }); }} rows={rows} search={search} onSearchChange={setSearch} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} dateFrom={dateFrom} onDateFromChange={setDateFrom} dateTo={dateTo} onDateToChange={setDateTo} onClearFilters={clearFilters} onOpenCustomer={customer => setLocation(`/customers/${customer.id}`)} onDelete={visit => setDeleteId(visit.id)} onEdit={visit => setEditVisit(visit)} />
    {editVisit ? <EditVisitDialog visit={editVisit} busy={updateVisit.isPending} onClose={() => setEditVisit(null)} onSubmit={values => updateVisit.mutate(values)} /> : null}
    <PinVerificationDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }} busy={deleteVisit.isPending} title="تأكيد حذف الزيارة" description="ستُنقل نسخة الزيارة إلى سلة المحذوفات قبل حذفها من السجل."     onConfirm={pin => { if (!selectedVisit || !deleteId) return; if (!navigator.onLine) { toast.error("حذف الزيارة يحتاج اتصالًا مباشرًا بالسيرفر المركزي."); return; } moveToTrash({ entityType: "visit", entityLabel: `زيارة: ${selectedVisit.customer?.name ?? "عميل"}`, payload: selectedVisit }); deleteVisit.mutate({ id: deleteId, pin }); }}
 />
  </div>;
}

export function normalizeVisitRows(response: unknown): VisitRow[] {
  return extractArray<VisitRow>(response);
}

export function filterVisitRows(rows: VisitRow[], filters: { search?: string; type?: string; dateFrom?: string; dateTo?: string }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const search = filters?.search?.trim().toLowerCase() ?? "";
  return safeRows.filter(visit => {
    const customer = visit.customer;
    const result = visit.visitResult ?? visit.visitOutcome ?? visit.result ?? "";
    const text = `${customer?.name ?? ""} ${customer?.manualCode ?? ""} ${customer?.phone ?? ""} ${customer?.address ?? ""} ${visit.notes ?? ""} ${result} ${visit.technicianName ?? ""}`.toLowerCase();
    const date = new Date(visit.visitDate).toISOString().slice(0, 10);
    return (!search || text.includes(search)) && (!filters.type || filters.type === "all" || visit.visitType === filters.type) && (!filters.dateFrom || date >= filters.dateFrom) && (!filters.dateTo || date <= filters.dateTo);
  });
}

function groupVisitsByCustomer(rows: VisitRow[]): CustomerVisitGroup[] {
  const groups = new Map<string, CustomerVisitGroup>();
  const safeRows = Array.isArray(rows) ? rows : [];
  safeRows.forEach(visit => {
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

function VisitHistory({ compactMobile, onToggleCompact, rows, search, onSearchChange, typeFilter, onTypeFilterChange, dateFrom, onDateFromChange, dateTo, onDateToChange, onClearFilters, onOpenCustomer, onDelete, onEdit }: { compactMobile: boolean; onToggleCompact: () => void; rows: VisitRow[]; search: string; onSearchChange: (value: string) => void; typeFilter: string; onTypeFilterChange: (value: string) => void; dateFrom: string; onDateFromChange: (value: string) => void; dateTo: string; onDateToChange: (value: string) => void; onClearFilters: () => void; onOpenCustomer: (customer: any) => void; onDelete: (visit: VisitRow) => void; onEdit: (visit: VisitRow) => void }) {
  const hasFilters = Boolean(search.trim() || typeFilter !== "all" || dateFrom || dateTo);
  const groups = useMemo(() => groupVisitsByCustomer(rows), [rows]);
  const totalCollected = useMemo(() => rows.reduce((sum, visit) => sum + Number(visit.collectedAmount || 0), 0), [rows]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleGroup = (key: string) => setExpanded(current => ({ ...current, [key]: !current[key] }));

  return <section className="soft-card overflow-hidden">
    <div className="border-b border-teal-950/6 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <label className="relative min-w-0 flex-1"><span className="sr-only">بحث سريع</span><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input aria-label="البحث في سجل الزيارات" className="field-input h-10 pr-9" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="بحث سريع: اسم العميل أو الكود أو الفني أو النتيجة" /></label>
        <label className="lg:w-44"><span className="sr-only">نوع الخدمة</span><select aria-label="تصفية حسب نوع الزيارة" className="field-input h-10" value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)}><option value="all">كل الخدمات</option>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button type="button" className="inline-flex h-10 items-center rounded-xl border border-teal-200 bg-white px-3 text-xs font-extrabold text-teal-800 md:hidden" onClick={onToggleCompact} aria-pressed={compactMobile}>{compactMobile ? "العرض الكامل" : "عرض مبسط"}</button><span className="shrink-0 rounded-full bg-teal-100 px-3 py-2 text-xs font-extrabold text-teal-900" aria-live="polite">العملاء: {groups.length.toLocaleString("ar-SA")} · الزيارات: {rows.length.toLocaleString("ar-SA")}</span>
        <button type="button" onClick={onClearFilters} disabled={!hasFilters} className="inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" />مسح</button>
      </div>
      <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5"><summary className="cursor-pointer text-sm font-bold text-slate-700">تحديد فترة زمنية <span className="font-normal text-muted-foreground">اختياري</span></summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="field-label">من تاريخ</span><input aria-label="من تاريخ الزيارة" type="date" className="field-input mt-1" value={dateFrom} onChange={event => onDateFromChange(event.target.value)} /></label><label><span className="field-label">إلى تاريخ</span><input aria-label="إلى تاريخ الزيارة" type="date" className="field-input mt-1" value={dateTo} onChange={event => onDateToChange(event.target.value)} /></label></div></details>
    </div>
    <div className="space-y-3 bg-slate-50/60 p-3 sm:p-4">{groups.length ? groups.map(group => {
      const customer = group.customer;
      const isExpanded = expanded[group.key] ?? true;
      return <article key={group.key} className="overflow-hidden rounded-2xl border border-teal-100 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-teal-100 bg-teal-50/70 px-3 py-3 sm:px-4"><div className="min-w-0"><button type="button" className="block max-w-full truncate text-right text-base font-black text-teal-950 hover:text-teal-700" onClick={() => customer && onOpenCustomer(customer)}>{customer?.name ?? "عميل غير معروف"}</button><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-teal-800"><span>الكود: {customer?.manualCode || "—"}</span><span>الهاتف: {customer?.phone || "—"}</span><span>{group.visits.length.toLocaleString("ar-SA")} زيارة</span></div></div><div className="flex items-center gap-2">{customer ? <CustomerContactActions customer={customer} compact labels /> : null}<button type="button" onClick={() => toggleGroup(group.key)} className="inline-flex h-9 items-center gap-1 rounded-lg border border-teal-200 bg-white px-3 text-xs font-extrabold text-teal-800 hover:bg-teal-50" aria-expanded={isExpanded}>{isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}{isExpanded ? "طي التفاصيل" : "عرض التفاصيل"}</button></div></div>
        {isExpanded ? <div className="overflow-x-auto overscroll-x-contain"><table className={`w-full min-w-[620px] table-fixed border-collapse text-right md:min-w-[980px] ${compactMobile ? "compact-mobile-visit-table" : ""}`}><colgroup><col className="w-[90px] sm:w-[110px]" /><col className="w-[118px] sm:w-[130px]" /><col className="w-[105px] sm:w-[120px]" /><col className="w-[82px] sm:w-[100px]" /><col className="hidden sm:table-column sm:w-[190px]" /><col className="w-[165px] sm:w-[270px]" /><col className="w-[78px] sm:w-[120px]" /></colgroup><thead className="bg-white text-xs text-teal-950/70"><tr><th className="border-b border-teal-100 px-3 py-2 font-bold">نوع الزيارة</th><th className="border-b border-teal-100 px-3 py-2 font-bold">التاريخ والوقت</th><th className="border-b border-teal-100 px-3 py-2 font-bold">الفني</th><th className="border-b border-teal-100 px-3 py-2 font-bold">المبلغ</th><th className="border-b border-teal-100 px-3 py-2 font-bold">قياسات TDS</th><th className="hidden border-b border-teal-100 px-3 py-2 font-bold sm:table-cell">العنوان</th><th className="border-b border-teal-100 px-3 py-2 font-bold">نتيجة الزيارة</th><th className="border-b border-teal-100 px-3 py-2 font-bold">إجراءات</th></tr></thead><tbody>{group.visits.map(visit => { const result = visit.visitResult ?? visit.visitOutcome ?? visit.result ?? visit.notes ?? "لا توجد نتيجة مسجلة"; return <tr key={`${visit.id}-${visit.visitDate}`} className="align-top hover:bg-teal-50/40"><td className="border-b border-teal-50 px-3 py-2 text-sm font-bold text-sky-800">{visitTypeLabels[visit.visitType as keyof typeof visitTypeLabels] ?? "زيارة"}{visit.id < 0 ? <span className="mt-1 block text-[11px] font-bold text-amber-700">محفوظة محليًا</span> : null}</td><td className="border-b border-teal-50 px-3 py-2 text-sm font-bold text-teal-950">{formatDateTime(visit.visitDate)}</td><td className="border-b border-teal-50 px-3 py-2 text-sm font-bold text-teal-900">{visit.technicianName || "—"}</td><td className="border-b border-teal-50 px-3 py-2 text-sm font-extrabold text-emerald-700">{formatAppMoney(Number(visit.collectedAmount ?? 0))}</td><td className="border-b border-teal-50 px-3 py-2 text-xs font-extrabold text-sky-800">{visit.tdsIn !== null || visit.tdsOut !== null ? <>قبل: {visit.tdsIn ?? "—"} · بعد: {visit.tdsOut ?? "—"} ppm</> : "—"}</td><td className="hidden border-b border-teal-50 px-3 py-2 text-sm text-slate-700 sm:table-cell"><p className="whitespace-normal break-words" title={customer?.address || "غير مسجل"}>{customer?.address || "غير مسجل"}</p></td><td className="border-b border-teal-50 px-3 py-2 text-sm text-slate-700"><span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-700">منفذة</span><p className="mt-1 whitespace-normal break-words" title={result}>{result}</p></td><td className="border-b border-teal-50 px-3 py-2"><div className="flex flex-wrap items-center gap-1.5"><button type="button" onClick={() => onEdit(visit)} disabled={visit.id < 0} className="inline-flex h-8 items-center gap-1 rounded-lg bg-amber-50 px-2 text-xs font-extrabold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"><Pencil className="h-3.5 w-3.5" />تعديل</button><button type="button" onClick={() => onDelete(visit)} className="inline-flex h-8 items-center rounded-lg bg-rose-50 px-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100">حذف</button></div></td></tr>; })}</tbody></table></div> : null}
      </article>;
    }) : <div className="p-12 text-center text-sm text-muted-foreground">لا توجد زيارات مطابقة للبحث أو التصفية.</div>}{groups.length ? <div className="flex items-center justify-between gap-3 border-t-2 border-teal-200 bg-teal-50 px-4 py-3 text-sm font-black text-teal-950"><span>إجمالي المبلغ المحصل للزيارات المعروضة</span><span className="text-base text-emerald-700">{formatAppMoney(totalCollected)}</span></div> : null}</div>
  </section>;
}


type EditVisitValues = {
  id: number;
  visitType: keyof typeof visitTypeLabels;
  visitDate: Date;
  technicianName: string | null;
  visitResult: string | null;
  notes: string | null;
  status: "assigned" | "en_route" | "arrived" | "in_progress" | "completed" | "postponed" | "cancelled";
  collectedAmount: number;
  tdsIn: number | null;
  tdsOut: number | null;
  pin: string;
};

function EditVisitDialog({ visit, busy, onClose, onSubmit }: { visit: VisitRow; busy: boolean; onClose: () => void; onSubmit: (values: EditVisitValues) => void }) {
  const [visitType, setVisitType] = useState<EditVisitValues["visitType"]>(visit.visitType);
  const [visitDate, setVisitDate] = useState(() => new Date(visit.visitDate).toISOString().slice(0, 16));
  const [technicianName, setTechnicianName] = useState(visit.technicianName ?? "");
  const [visitResult, setVisitResult] = useState(visit.visitResult ?? "");
  const [notes, setNotes] = useState(visit.notes ?? "");
  const [status, setStatus] = useState<EditVisitValues["status"]>(visit.status ?? "completed");
  const [collectedAmount, setCollectedAmount] = useState(String(visit.collectedAmount ?? 0));
  const [tdsIn, setTdsIn] = useState(visit.tdsIn == null ? "" : String(visit.tdsIn));
  const [tdsOut, setTdsOut] = useState(visit.tdsOut == null ? "" : String(visit.tdsOut));
  const [pin, setPin] = useState("");

  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-visit-title">
    <form className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl" onSubmit={event => { event.preventDefault(); onSubmit({ id: visit.id, visitType, visitDate: new Date(visitDate), technicianName: technicianName.trim() || null, visitResult: visitResult.trim() || null, notes: notes.trim() || null, status, collectedAmount: Math.round(Math.max(0, Number(collectedAmount) || 0)), tdsIn: tdsIn.trim() ? Math.round(Number(tdsIn)) : null, tdsOut: tdsOut.trim() ? Math.round(Number(tdsOut)) : null, pin }); }}>
      <div className="mb-4 flex items-start justify-between gap-3"><div><h2 id="edit-visit-title" className="text-lg font-black text-teal-950">تصحيح تسجيل الزيارة</h2><p className="mt-1 text-sm text-slate-500">التعديل متاح للمسؤول فقط، ويُحدّث القيد المرتبط بالخزينة.</p></div><button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xl text-slate-500 hover:bg-slate-100" aria-label="إغلاق">×</button></div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="field-label">نوع الزيارة</span><select className="field-input mt-1" value={visitType} onChange={event => setVisitType(event.target.value as EditVisitValues["visitType"])}>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="field-label">تاريخ الزيارة</span><input className="field-input mt-1" type="datetime-local" value={visitDate} onChange={event => setVisitDate(event.target.value)} required /></label>
        <label><span className="field-label">الفني</span><input className="field-input mt-1" value={technicianName} onChange={event => setTechnicianName(event.target.value)} /></label>
        <label><span className="field-label">حالة الزيارة</span><select className="field-input mt-1" value={status} onChange={event => setStatus(event.target.value as EditVisitValues["status"])}>{[["assigned", "مسندة"], ["en_route", "في الطريق"], ["arrived", "وصل"], ["in_progress", "قيد التنفيذ"], ["completed", "مكتملة"], ["postponed", "مؤجلة"], ["cancelled", "ملغاة"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label><span className="field-label">المبلغ المحصل</span><input className="field-input mt-1" type="number" min="0" step="1" value={collectedAmount} onChange={event => setCollectedAmount(event.target.value)} /></label>
        <label><span className="field-label">TDS قبل الفلتر (ppm)</span><input className="field-input mt-1" type="number" min="0" step="1" inputMode="numeric" value={tdsIn} onChange={event => setTdsIn(event.target.value)} placeholder="اختياري" /></label>
        <label><span className="field-label">TDS بعد الفلتر (ppm)</span><input className="field-input mt-1" type="number" min="0" step="1" inputMode="numeric" value={tdsOut} onChange={event => setTdsOut(event.target.value)} placeholder="اختياري" /></label>
        <label className="sm:col-span-2"><span className="field-label">نتيجة الزيارة</span><textarea className="field-input mt-1 min-h-24" value={visitResult} onChange={event => setVisitResult(event.target.value)} /></label>
        <label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-input mt-1 min-h-20" value={notes} onChange={event => setNotes(event.target.value)} /></label>
        <label className="sm:col-span-2"><span className="field-label">الرقم السري للمسؤول</span><input className="field-input mt-1" type="password" minLength={4} value={pin} onChange={event => setPin(event.target.value)} required /></label>
      </div>
      <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700">إلغاء</button><button type="submit" disabled={busy || pin.trim().length < 4} className="rounded-xl bg-teal-700 px-4 py-2 text-sm font-black text-white disabled:opacity-50">{busy ? "جارٍ الحفظ..." : "حفظ التصحيح"}</button></div>
    </form>
  </div>;
}
