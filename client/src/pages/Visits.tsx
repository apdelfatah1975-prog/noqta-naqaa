import { CustomerContactActions } from "@/components/CustomerContactActions";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { cacheOfflineCustomers, cacheOfflineVisits, getOfflineCustomers, getOfflineSession, getOfflineVisits, getPendingVisits, queueOfflineDelete } from "@/lib/offlineSync";
import { moveToTrash } from "@/lib/trashBin";
import { formatDateTime, visitTypeLabels } from "@/lib/filterUi";
import { trpc } from "@/lib/trpc";
import { ClipboardList, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

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
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const deleteVisit = trpc.filters.visits.delete.useMutation({ onSuccess: () => { setDeleteId(null); toast.success("تم حذف الزيارة ونقل نسختها إلى سلة المحذوفات"); }, onError: error => toast.error(error.message || "تعذر حذف الزيارة.") });

  useEffect(() => { if (customers) cacheOfflineCustomers(customers); }, [customers]);
  useEffect(() => {
    if (visitList) cacheOfflineVisits(visitList.map(visit => ({ id: visit.id, customerId: visit.customerId, visitType: visit.visitType, visitDate: new Date(visit.visitDate).toISOString(), technicianName: visit.technicianName, notes: visit.notes, collectedAmount: visit.collectedAmount, collectedCurrency: "SAR" })));
  }, [visitList]);

  const customerMap = useMemo(() => new Map(visibleCustomers.map(customer => [customer.id, customer])), [visibleCustomers]);
  const rows = useMemo(() => filterVisitRows([
    ...visits.map(visit => ({ ...visit, customer: ("customer" in visit ? visit.customer : undefined) ?? customerMap.get(visit.customerId) })),
    ...pendingVisits.map(visit => ({ ...visit, id: -Math.abs(String(visit.clientOperationId ?? visit.visitDate).length), customer: customerMap.get(visit.customerId) })),
  ], { search, type: typeFilter, dateFrom, dateTo }), [customerMap, dateFrom, dateTo, pendingVisits, search, typeFilter, visits]);
  const clearFilters = () => { setSearch(""); setTypeFilter("all"); setDateFrom(""); setDateTo(""); };
  const selectedVisit: VisitRow | null = deleteId === null ? null : (rows.find(visit => visit.id === deleteId) ?? null);

  return <div className="-mx-4 -mt-2 w-[calc(100%+2rem)] max-w-none space-y-4 px-0 sm:-mx-6 sm:w-[calc(100%+3rem)] lg:-mx-8 lg:w-[calc(100%+4rem)]">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-100 text-teal-800"><ClipboardList className="h-5 w-5" /></span><div><h1 className="page-heading">سجل الزيارات</h1><p className="page-subheading">راجع الزيارات المسجلة وابحث فيها بسرعة.</p></div></div></div><div className="flex items-center gap-2 self-start sm:self-end"><span className="rounded-xl bg-teal-100 px-3 py-2 text-sm font-black text-teal-800">{rows.length.toLocaleString("ar-SA")} زيارة</span><span className={`rounded-xl px-3 py-2 text-sm font-bold ${online ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{online ? "متصل" : "دون نت"}</span></div></div>

    <VisitHistory rows={rows} search={search} onSearchChange={setSearch} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} dateFrom={dateFrom} onDateFromChange={setDateFrom} dateTo={dateTo} onDateToChange={setDateTo} onClearFilters={clearFilters} onOpenCustomer={customer => setLocation(`/customers/${customer.id}`)} onDelete={visit => setDeleteId(visit.id)} />
    <PinVerificationDialog open={deleteId !== null} onOpenChange={open => { if (!open) setDeleteId(null); }} busy={deleteVisit.isPending} title="تأكيد حذف الزيارة" description="ستُنقل نسخة الزيارة إلى سلة المحذوفات قبل حذفها من السجل." onConfirm={pin => { if (!selectedVisit || !deleteId) return; moveToTrash({ entityType: "visit", entityLabel: `زيارة: ${selectedVisit.customer?.name ?? "عميل"}`, payload: selectedVisit }); if (!navigator.onLine && offlineUser) { queueOfflineDelete(offlineUser.id, { entity: "visit", id: deleteId, pin }); cacheOfflineVisits(getOfflineVisits().filter(visit => visit.id !== deleteId)); setDeleteId(null); toast.success("تم حذف الزيارة محليًا ونقل نسختها إلى السلة"); } else { deleteVisit.mutate({ id: deleteId, pin }); } }} />
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

function VisitHistory({ rows, search, onSearchChange, typeFilter, onTypeFilterChange, dateFrom, onDateFromChange, dateTo, onDateToChange, onClearFilters, onOpenCustomer, onDelete }: { rows: VisitRow[]; search: string; onSearchChange: (value: string) => void; typeFilter: string; onTypeFilterChange: (value: string) => void; dateFrom: string; onDateFromChange: (value: string) => void; dateTo: string; onDateToChange: (value: string) => void; onClearFilters: () => void; onOpenCustomer: (customer: any) => void; onDelete: (visit: VisitRow) => void }) {
  const hasFilters = Boolean(search.trim() || typeFilter !== "all" || dateFrom || dateTo);
  return <section className="soft-card overflow-hidden">
    <div className="border-b border-teal-950/6 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-teal-950">الزيارات المسجلة</h2><p className="mt-1 text-sm text-muted-foreground">ابحث باسم العميل أو الفني، ثم اختر نوع الخدمة أو الفترة المطلوبة.</p></div><span className="rounded-full bg-teal-100 px-3 py-1.5 text-xs font-extrabold text-teal-900" aria-live="polite">النتائج: {rows.length.toLocaleString("ar-SA")}</span></div>
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-end"><label className="relative min-w-0 flex-1"><span className="field-label">بحث سريع</span><Search className="pointer-events-none absolute right-3 top-10 h-4 w-4 text-muted-foreground" /><input aria-label="البحث في سجل الزيارات" className="field-input pr-9" value={search} onChange={event => onSearchChange(event.target.value)} placeholder="اسم العميل أو الكود أو الفني أو الملاحظات" /></label><label className="lg:w-48"><span className="field-label">نوع الخدمة</span><select aria-label="تصفية حسب نوع الزيارة" className="field-input mt-1" value={typeFilter} onChange={event => onTypeFilterChange(event.target.value)}><option value="all">كل الخدمات</option>{Object.entries(visitTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><button type="button" onClick={onClearFilters} disabled={!hasFilters} className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-4 w-4" />مسح</button></div>
      <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5"><summary className="cursor-pointer text-sm font-bold text-slate-700">تحديد فترة زمنية <span className="font-normal text-muted-foreground">اختياري</span></summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label><span className="field-label">من تاريخ</span><input aria-label="من تاريخ الزيارة" type="date" className="field-input mt-1" value={dateFrom} onChange={event => onDateFromChange(event.target.value)} /></label><label><span className="field-label">إلى تاريخ</span><input aria-label="إلى تاريخ الزيارة" type="date" className="field-input mt-1" value={dateTo} onChange={event => onDateToChange(event.target.value)} /></label></div></details>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1120px] table-fixed border border-teal-200/80 text-right [&_td]:border [&_td]:border-teal-100 [&_th]:border [&_th]:border-teal-200/80"><colgroup><col className="w-[175px]" /><col className="w-[90px]" /><col className="w-[120px]" /><col className="w-[155px]" /><col className="w-[125px]" /><col className="w-[105px]" /><col className="w-[235px]" /><col className="w-[190px]" /></colgroup><thead className="sticky top-0 z-10 bg-teal-50 text-xs text-teal-950/70 shadow-[0_2px_8px_rgba(15,118,110,0.08)]"><tr><th className="whitespace-nowrap bg-teal-50 px-3 py-2.5 font-bold">العميل</th><th className="whitespace-nowrap bg-teal-50 px-2 py-2.5 font-bold">الكود</th><th className="whitespace-nowrap bg-teal-50 px-2 py-2.5 font-bold">نوع الزيارة</th><th className="whitespace-nowrap bg-teal-50 px-2 py-2.5 font-bold">التاريخ والوقت</th><th className="whitespace-nowrap bg-teal-50 px-2 py-2.5 font-bold">الفني</th><th className="whitespace-nowrap bg-teal-50 px-2 py-2.5 font-bold">المبلغ</th><th className="bg-teal-50 px-3 py-2.5 font-bold">التفاصيل</th><th className="bg-teal-50 px-2 py-2.5 font-bold">إجراءات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{rows.length ? rows.map(visit => { const customer = visit.customer; return <tr key={`${visit.id}-${visit.visitDate}`} className="h-14 align-middle hover:bg-teal-50/45"><td className="px-2 py-1"><button type="button" className="block w-full whitespace-normal break-words text-right font-extrabold leading-5 text-teal-900 hover:text-teal-600" onClick={() => customer && onOpenCustomer(customer)}>{customer?.name ?? "عميل غير معروف"}</button><p className="mt-0.5 text-xs text-muted-foreground">{customer?.phone || "—"}</p></td><td className="whitespace-nowrap px-2 py-1 text-sm font-bold text-teal-800">{customer?.manualCode || "—"}</td><td className="px-2 py-1 text-sm font-bold text-sky-800">{visitTypeLabels[visit.visitType as keyof typeof visitTypeLabels] ?? "زيارة"}{visit.id < 0 ? <span className="mt-1 block text-[11px] font-bold text-amber-700">محفوظة محليًا</span> : null}</td><td className="px-2 py-1 text-sm font-bold text-teal-950">{formatDateTime(visit.visitDate)}</td><td className="whitespace-nowrap px-2 py-1 text-sm font-bold text-teal-900">{visit.technicianName || "—"}</td><td className="whitespace-nowrap px-2 py-1 text-sm font-extrabold text-emerald-700">{(visit.collectedAmount ? visit.collectedAmount / 100 : 0).toLocaleString("ar-SA")}</td><td className="px-3 py-1 text-sm"><p className="truncate text-slate-700" title={visit.notes || "لا توجد ملاحظات"}>{visit.notes || "لا توجد ملاحظات"}</p><p className="mt-0.5 truncate text-xs text-muted-foreground" title={customer?.address || "غير مسجل"}>{customer?.address || "العنوان غير مسجل"}</p></td><td className="px-2 py-1"><div className="flex flex-wrap items-center gap-1.5">{customer ? <CustomerContactActions customer={customer} compact labels /> : null}<button type="button" onClick={() => onDelete(visit)} className="inline-flex h-8 items-center rounded-lg bg-rose-50 px-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100">حذف</button></div></td></tr>; }) : <tr><td colSpan={8} className="p-12 text-center text-sm text-muted-foreground">لا توجد زيارات مطابقة للبحث أو التصفية.</td></tr>}</tbody></table></div>
  </section>;
}
