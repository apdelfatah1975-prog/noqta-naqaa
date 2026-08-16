import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { cacheOfflineReport, getLatestOfflineReport, getOfflineReport, getOfflineSession } from "@/lib/offlineSync";
import { CalendarDays, Download, FileBarChart, PackageSearch, Printer, RefreshCw, WalletCards } from "lucide-react";
import { labelVisitType } from "@/lib/filterUi";
import * as XLSX from "xlsx";

const money = (amount: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(amount / 100);
const number = (value: number) => new Intl.NumberFormat("ar-SA").format(value);
const dateLabel = (value: string | Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(value));
const isoDate = (date: Date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; };
const firstOfMonth = () => { const date = new Date(); date.setDate(1); return isoDate(date); };
const today = () => isoDate(new Date());

export default function Reports() {
  const user = getOfflineSession();
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [reportSection, setReportSection] = useState<"overview" | "financial" | "visits" | "inventory" | "all">("overview");
  const query = trpc.filters.reports.monthly.useQuery({ dateFrom, dateTo }, { retry: false, staleTime: 60_000 });
  const cachedReport = getOfflineReport<typeof query.data>(user?.id ?? 0, dateFrom, dateTo);
  const latestCachedReport = getLatestOfflineReport<NonNullable<typeof query.data>>(user?.id ?? 0);
  const emptyReport = {
    period: { dateFrom, dateTo },
    summary: { visits: 0, customers: 0, income: 0, expense: 0, balance: 0, pendingReminders: 0, lowStock: 0 },
    incomeByCategory: [], expenseByCategory: [], visitsByType: [], visitsByTechnician: [],
    inventory: { incomingQuantity: 0, outgoingQuantity: 0, purchaseCost: 0, items: [] },
    recentVisits: [],
  } as unknown as NonNullable<typeof query.data>;
  const data = query.data ?? cachedReport ?? latestCachedReport ?? emptyReport;
  const financial = data.financial ?? { serviceIncome: 0, externalIncome: 0, totalIncome: 0, technicianPayments: 0, technicianRequired: 0, technicianRemaining: 0, otherExpenses: 0, companyNet: 0, technicianPaymentsByName: [] };
  useEffect(() => {
    if (query.data && user) cacheOfflineReport(user.id, dateFrom, dateTo, query.data);
  }, [dateFrom, dateTo, query.data, user]);

  const exportExcel = () => {
    if (!data) return;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      { البيان: "الفترة من", القيمة: data.period.dateFrom },
      { البيان: "الفترة إلى", القيمة: data.period.dateTo },
      { البيان: "عدد الزيارات", القيمة: data.summary.visits },
      { البيان: "عدد العملاء الذين تمت زيارتهم", القيمة: data.summary.customers },
      { البيان: "الإيرادات", القيمة: data.summary.income / 100 },
      { البيان: "المصروفات", القيمة: data.summary.expense / 100 },
      { البيان: "صافي الحركة", القيمة: data.summary.balance / 100 },
      { البيان: "المتابعات المعلقة", القيمة: data.summary.pendingReminders },
      { البيان: "الأصناف منخفضة الرصيد", القيمة: data.summary.lowStock },
    ]), "الملخص");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.incomeByCategory.map(row => ({ البند: row.label, "الإجمالي": row.total / 100 }))), "الإيرادات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      { البيان: "إيرادات الخدمات", "الإجمالي": financial.serviceIncome / 100 },
      { البيان: "نقدية خارج إيرادات العمل", "الإجمالي": financial.externalIncome / 100 },
      { البيان: "إجمالي الداخل", "الإجمالي": financial.totalIncome / 100 },
      { البيان: "إجمالي مستحقات الفنيين", "الإجمالي": financial.technicianRequired / 100 },
      { البيان: "إجمالي المدفوع للفنيين", "الإجمالي": financial.technicianPayments / 100 },
      { البيان: "إجمالي المتبقي للفنيين", "الإجمالي": financial.technicianRemaining / 100 },
      { البيان: "المصروفات الأخرى", "الإجمالي": financial.otherExpenses / 100 },
      { البيان: "صافي إيراد الشركة", "الإجمالي": financial.companyNet / 100 },
    ]), "مالية الشركة");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(financial.technicianPaymentsByName.map(row => ({ الفني: row.technician, الحالة: row.status === "paid" ? "مدفوع" : "متبقي", "إجمالي المستحق": row.requiredAmount / 100, "إجمالي المدفوع": row.totalPaid / 100, "المتبقي": row.remainingAmount / 100, "عدد العمليات": row.transactionCount }))), "مستحقات الفنيين");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.expenseByCategory.map(row => ({ البند: row.label, "الإجمالي": row.total / 100 }))), "المصروفات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.visitsByType.map(row => ({ النوع: labelVisitType(row.label), العدد: row.total }))), "أنواع الزيارات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.visitsByTechnician.map(row => ({ الفني: row.label, "عدد الزيارات": row.total }))), "الفنيون");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.recentVisits.map(row => ({ التاريخ: dateLabel(row.date), العميل: row.customer, النوع: labelVisitType(row.type), الفني: row.technician }))), "آخر الزيارات");
    XLSX.writeFile(workbook, `تقرير-نقطة-نقاء-${dateFrom}-${dateTo}.xlsx`);
  };

  const cards = useMemo(() => data ? [
    { label: "الزيارات المنفذة", value: number(data.summary.visits), tone: "bg-teal-50 text-teal-900", icon: CalendarDays },
    { label: "الإيرادات", value: money(data.summary.income), tone: "bg-emerald-50 text-emerald-900", icon: WalletCards },
    { label: "المصروفات", value: money(data.summary.expense), tone: "bg-amber-50 text-amber-950", icon: WalletCards },
    { label: "صافي الحركة", value: money(data.summary.balance), tone: "bg-slate-950 text-white", icon: FileBarChart },
    { label: "المتابعات المعلقة", value: number(data.summary.pendingReminders), tone: "bg-indigo-50 text-indigo-900", icon: CalendarDays },
    { label: "أصناف منخفضة الرصيد", value: number(data.summary.lowStock), tone: "bg-rose-50 text-rose-900", icon: PackageSearch },
  ] : [] , [data]);

  const show = (section: Exclude<typeof reportSection, "all">) => reportSection === "all" || reportSection === section;
  const showAllDetails = reportSection === "all";

  return <div dir="rtl" className="mx-auto max-w-7xl space-y-6 print:bg-white">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div><p className="text-sm font-bold text-teal-700">مركز الإدارة</p><h1 className="page-heading">التقارير</h1><p className="page-subheading">ملخص سريع، ثم تفاصيل كل جانب من العمل عند الحاجة.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11 rounded-xl" onClick={() => query.refetch()}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button><Button variant="outline" className="h-11 rounded-xl" onClick={() => window.print()} disabled={!data}><Printer className="ml-2 h-4 w-4" />طباعة / PDF</Button><Button className="h-11 rounded-xl bg-teal-700 hover:bg-teal-800" onClick={exportExcel} disabled={!data}><Download className="ml-2 h-4 w-4" />تصدير Excel</Button></div>
    </div>

    <section className="soft-card flex flex-col gap-4 p-5 sm:flex-row sm:items-end print:hidden">
      <div className="flex-1"><label className="field-label" htmlFor="report-from">من تاريخ</label><input id="report-from" type="date" className="field-input mt-1" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></div>
      <div className="flex-1"><label className="field-label" htmlFor="report-to">إلى تاريخ</label><input id="report-to" type="date" className="field-input mt-1" value={dateTo} onChange={event => setDateTo(event.target.value)} /></div>
      <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900">{dateFrom && dateTo ? `تقرير من ${dateFrom} إلى ${dateTo}` : "اختر الفترة"}</div>
    </section>

    {query.isLoading && !data ? <div className="soft-card p-12 text-center text-sm text-muted-foreground">جارٍ إعداد التقرير…</div> : data ? <>
      {!query.data ? <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 print:hidden">يُعرض التقرير من البيانات المحلية؛ يمكنك التصدير والطباعة دون اتصال.</div> : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card => <article key={card.label} className={`rounded-2xl p-5 shadow-sm ${card.tone}`}><div className="flex items-center justify-between"><p className="text-sm font-bold opacity-80">{card.label}</p><card.icon className="h-5 w-5 opacity-80" /></div><p className="mt-4 text-2xl font-black">{card.value}</p></article>)}</div>
      <nav aria-label="أقسام التقرير" className="soft-card flex flex-wrap gap-2 p-3 print:hidden"><SectionButton active={reportSection === "overview"} onClick={() => setReportSection("overview")}>نظرة عامة</SectionButton><SectionButton active={reportSection === "financial"} onClick={() => setReportSection("financial")}>المالية</SectionButton><SectionButton active={reportSection === "visits"} onClick={() => setReportSection("visits")}>الزيارات</SectionButton><SectionButton active={reportSection === "inventory"} onClick={() => setReportSection("inventory")}>المخزون</SectionButton><SectionButton active={reportSection === "all"} onClick={() => setReportSection("all")}>كل التفاصيل</SectionButton></nav>
      <div className="hidden border-b pb-4 print:block"><h1 className="text-2xl font-black">تقرير نقطة نقاء</h1><p className="mt-2 text-sm">الفترة: {dateLabel(`${data.period.dateFrom}T00:00:00`)} — {dateLabel(`${data.period.dateTo}T00:00:00`)}</p></div>
      {show("financial") ? <><section className="soft-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">الملخص المالي للشركة</h2><p className="mt-1 text-xs text-muted-foreground">إيرادات الخدمات، النقدية الخارجية، مستحقات الفنيين، والمصروفات وصافي الشركة.</p></div><WalletCards className="h-5 w-5 text-teal-700" /></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Metric label="إيرادات الخدمات" value={money(financial.serviceIncome)} /><Metric label="نقدية خارج إيرادات العمل" value={money(financial.externalIncome)} /><Metric label="إجمالي الداخل" value={money(financial.totalIncome)} /><Metric label="إجمالي المستحق للفنيين" value={money(financial.technicianRequired)} /><Metric label="إجمالي ما استلمه الفنيون" value={money(financial.technicianPayments)} /><Metric label="إجمالي المتبقي للفنيين" value={money(financial.technicianRemaining)} /><Metric label="المصروفات الأخرى" value={money(financial.otherExpenses)} /><Metric label="صافي إيراد الشركة" value={money(financial.companyNet)} /></div></section><section className="soft-card overflow-hidden p-5"><div className="mb-4"><h2 className="font-black">كشف راتب الفنيين</h2><p className="mt-1 text-xs text-muted-foreground">المستحق والمدفوع والمتبقي لكل فني خلال الفترة المحددة.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-right text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-3">الفني</th><th className="px-3 py-3">الحالة</th><th className="px-3 py-3">المستحق</th><th className="px-3 py-3">المدفوع</th><th className="px-3 py-3">المتبقي</th><th className="px-3 py-3">العمليات</th></tr></thead><tbody className="divide-y">{financial.technicianPaymentsByName.length ? financial.technicianPaymentsByName.map(row => <tr key={row.technician}><td className="px-3 py-3 font-bold">{row.technician}</td><td className={`px-3 py-3 font-bold ${row.status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>{row.status === "paid" ? "مدفوع" : "متبقي"}</td><td className="px-3 py-3">{money(row.requiredAmount)}</td><td className="px-3 py-3 font-black text-teal-800">{money(row.totalPaid)}</td><td className="px-3 py-3 font-black text-amber-700">{money(row.remainingAmount)}</td><td className="px-3 py-3">{number(row.transactionCount)}</td></tr>) : <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد مستحقات أو مدفوعات فنيين في هذه الفترة.</td></tr>}</tbody></table></div></section></> : null}
      {show("visits") ? <><div className="grid gap-6 lg:grid-cols-2"><ReportList title="الإيرادات حسب البند" rows={data.incomeByCategory} moneyRows /><ReportList title="المصروفات حسب البند" rows={data.expenseByCategory} moneyRows /><ReportList title="الزيارات حسب النوع" rows={data.visitsByType.map(row => ({ ...row, label: labelVisitType(row.label) }))} /><ReportList title="الزيارات حسب الفني" rows={data.visitsByTechnician} /></div><section className="soft-card overflow-hidden p-5"><h2 className="font-black">آخر الزيارات في الفترة</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-right text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-3">التاريخ</th><th className="px-3 py-3">العميل</th><th className="px-3 py-3">نوع الزيارة</th><th className="px-3 py-3">الفني</th></tr></thead><tbody className="divide-y">{data.recentVisits.length ? data.recentVisits.map((visit, index) => <tr key={`${visit.customer}-${index}`}><td className="px-3 py-3">{dateLabel(visit.date)}</td><td className="px-3 py-3 font-bold">{visit.customer}</td><td className="px-3 py-3">{labelVisitType(visit.type)}</td><td className="px-3 py-3">{visit.technician}</td></tr>) : <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">لا توجد زيارات في هذه الفترة.</td></tr>}</tbody></table></div></section></> : null}
      {show("inventory") ? <section className="soft-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">ملخص المخزون</h2><p className="mt-1 text-xs text-muted-foreground">الحركة خلال الفترة والرصيد الحالي.</p></div><PackageSearch className="h-5 w-5 text-teal-700" /></div><div className="grid gap-3 sm:grid-cols-3"><InventoryMetric label="إجمالي الوارد" hint="الكميات التي دخلت المخزن خلال الفترة" value={number(data.inventory.incomingQuantity)} tone="incoming" /><InventoryMetric label="إجمالي المنصرف" hint="الكميات التي خرجت من المخزن خلال الفترة" value={number(data.inventory.outgoingQuantity)} tone="outgoing" /><InventoryMetric label="قيمة المشتريات" hint="إجمالي تكلفة الأصناف المشتراة" value={money(data.inventory.purchaseCost)} tone="cost" /></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{data.inventory.items.map(item => <div key={item.name} className="rounded-xl bg-teal-50/60 p-3 text-sm"><span className="font-bold">{item.name}</span><span className="mr-2 text-muted-foreground">{number(item.currentBalance)}</span></div>)}</div></section> : null}
      <section className={`soft-card p-5 ${showAllDetails ? "" : "print:hidden"}`}><h2 className="font-black">ملاحظات التقرير</h2><p className="mt-2 text-sm text-muted-foreground">استخدم تبويبات الأقسام لعرض التفاصيل المطلوبة بسرعة، أو اختر «كل التفاصيل» لعرض التقرير الكامل.</p></section>
    </> : null}
  </div>;
}

function SectionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} aria-pressed={active} className={`rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${active ? "bg-teal-700 text-white shadow-sm" : "bg-teal-50 text-teal-900 hover:bg-teal-100"}`}>{children}</button>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-teal-950/8 bg-white p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-black text-teal-950">{value}</p></div>; }
function InventoryMetric({ label, hint, value, tone }: { label: string; hint: string; value: string; tone: "incoming" | "outgoing" | "cost" }) { const styles = { incoming: "border-teal-200 bg-teal-50 text-teal-950", outgoing: "border-amber-200 bg-amber-50 text-amber-950", cost: "border-violet-200 bg-violet-50 text-violet-950" }[tone]; return <div className={`rounded-xl border p-4 ${styles}`}><p className="text-xs font-bold opacity-75">{label}</p><p className="mt-2 text-lg font-black">{value}</p><p className="mt-1 text-[11px] leading-5 opacity-70">{hint}</p></div>; }
function ReportList({ title, rows, moneyRows = false }: { title: string; rows: Array<{ label: string; total: number }>; moneyRows?: boolean }) { return <section className="soft-card p-5"><h2 className="font-black">{title}</h2><div className="mt-4 space-y-3">{rows.length ? rows.map(row => <div key={row.label} className="flex items-center justify-between rounded-xl bg-teal-50/55 px-4 py-3 text-sm"><span className="font-bold">{row.label}</span><span className="font-black text-teal-800">{moneyRows ? money(row.total) : number(row.total)}</span></div>) : <p className="py-5 text-sm text-muted-foreground">لا توجد بيانات في هذه الفترة.</p>}</div></section>; }
