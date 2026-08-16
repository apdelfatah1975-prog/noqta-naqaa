import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { CalendarDays, Download, FileBarChart, PackageSearch, Printer, RefreshCw, WalletCards } from "lucide-react";
import * as XLSX from "xlsx";

const money = (amount: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(amount / 100);
const number = (value: number) => new Intl.NumberFormat("ar-SA").format(value);
const dateLabel = (value: string | Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(value));
const isoDate = (date: Date) => { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; };
const firstOfMonth = () => { const date = new Date(); date.setDate(1); return isoDate(date); };
const today = () => isoDate(new Date());

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const query = trpc.filters.reports.monthly.useQuery({ dateFrom, dateTo });
  const data = query.data;

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
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.incomeByCategory.map(row => ({ البند: row.label, "الإجمالي بالريال": row.total / 100 }))), "الإيرادات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.expenseByCategory.map(row => ({ البند: row.label, "الإجمالي بالريال": row.total / 100 }))), "المصروفات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.visitsByType.map(row => ({ النوع: row.label, العدد: row.total }))), "أنواع الزيارات");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.visitsByTechnician.map(row => ({ الفني: row.label, "عدد الزيارات": row.total }))), "الفنيون");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(data.recentVisits.map(row => ({ التاريخ: dateLabel(row.date), العميل: row.customer, النوع: row.type, الفني: row.technician }))), "آخر الزيارات");
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

  if (query.isError) return <div dir="rtl" className="soft-card mx-auto max-w-xl p-8 text-center"><h1 className="text-xl font-black text-teal-950">تعذر تحميل التقرير</h1><p className="mt-2 text-sm text-muted-foreground">تحقق من الفترة أو الاتصال ثم أعد المحاولة.</p><Button className="mt-5 rounded-xl" onClick={() => query.refetch()}>إعادة المحاولة</Button></div>;

  return <div dir="rtl" className="mx-auto max-w-7xl space-y-6 print:bg-white">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
      <div><p className="text-sm font-bold text-teal-700">مركز الإدارة</p><h1 className="page-heading">التقارير والتحليلات</h1><p className="page-subheading">صورة شهرية واضحة عن الزيارات والخزينة والمتابعات والمخزون.</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11 rounded-xl" onClick={() => query.refetch()}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button><Button variant="outline" className="h-11 rounded-xl" onClick={() => window.print()} disabled={!data}><Printer className="ml-2 h-4 w-4" />طباعة / PDF</Button><Button className="h-11 rounded-xl bg-teal-700 hover:bg-teal-800" onClick={exportExcel} disabled={!data}><Download className="ml-2 h-4 w-4" />تصدير Excel</Button></div>
    </div>

    <section className="soft-card flex flex-col gap-4 p-5 sm:flex-row sm:items-end print:hidden">
      <div className="flex-1"><label className="field-label" htmlFor="report-from">من تاريخ</label><input id="report-from" type="date" className="field-input mt-1" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></div>
      <div className="flex-1"><label className="field-label" htmlFor="report-to">إلى تاريخ</label><input id="report-to" type="date" className="field-input mt-1" value={dateTo} onChange={event => setDateTo(event.target.value)} /></div>
      <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900">{dateFrom && dateTo ? `تقرير من ${dateFrom} إلى ${dateTo}` : "اختر الفترة"}</div>
    </section>

    {query.isLoading ? <div className="soft-card p-12 text-center text-sm text-muted-foreground">جارٍ إعداد التقرير…</div> : data ? <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(card => <article key={card.label} className={`rounded-2xl p-5 shadow-sm ${card.tone}`}><div className="flex items-center justify-between"><p className="text-sm font-bold opacity-80">{card.label}</p><card.icon className="h-5 w-5 opacity-80" /></div><p className="mt-4 text-2xl font-black">{card.value}</p></article>)}</div>
      <div className="hidden border-b pb-4 print:block"><h1 className="text-2xl font-black">تقرير نقطة نقاء</h1><p className="mt-2 text-sm">الفترة: {dateLabel(`${data.period.dateFrom}T00:00:00`)} — {dateLabel(`${data.period.dateTo}T00:00:00`)}</p></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <ReportList title="الإيرادات حسب البند" rows={data.incomeByCategory} moneyRows />
        <ReportList title="المصروفات حسب البند" rows={data.expenseByCategory} moneyRows />
        <ReportList title="الزيارات حسب النوع" rows={data.visitsByType} />
        <ReportList title="الزيارات حسب الفني" rows={data.visitsByTechnician} />
      </div>
      <section className="soft-card p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">ملخص المخزون</h2><p className="mt-1 text-xs text-muted-foreground">الحركة خلال الفترة والرصيد الحالي.</p></div><PackageSearch className="h-5 w-5 text-teal-700" /></div><div className="grid gap-3 sm:grid-cols-3"><Metric label="الوارد" value={number(data.inventory.incomingQuantity)} /><Metric label="المنصرف" value={number(data.inventory.outgoingQuantity)} /><Metric label="تكلفة المشتريات" value={money(data.inventory.purchaseCost)} /></div><div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{data.inventory.items.map(item => <div key={item.name} className="rounded-xl bg-teal-50/60 p-3 text-sm"><span className="font-bold">{item.name}</span><span className="mr-2 text-muted-foreground">{number(item.currentBalance)}</span></div>)}</div></section>
      <section className="soft-card overflow-hidden p-5"><h2 className="font-black">آخر الزيارات في الفترة</h2><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[620px] text-right text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-3">التاريخ</th><th className="px-3 py-3">العميل</th><th className="px-3 py-3">نوع الزيارة</th><th className="px-3 py-3">الفني</th></tr></thead><tbody className="divide-y">{data.recentVisits.length ? data.recentVisits.map((visit, index) => <tr key={`${visit.customer}-${index}`}><td className="px-3 py-3">{dateLabel(visit.date)}</td><td className="px-3 py-3 font-bold">{visit.customer}</td><td className="px-3 py-3">{visit.type}</td><td className="px-3 py-3">{visit.technician}</td></tr>) : <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">لا توجد زيارات في هذه الفترة.</td></tr>}</tbody></table></div></section>
    </> : null}
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-teal-950/8 bg-white p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-black text-teal-950">{value}</p></div>; }
function ReportList({ title, rows, moneyRows = false }: { title: string; rows: Array<{ label: string; total: number }>; moneyRows?: boolean }) { return <section className="soft-card p-5"><h2 className="font-black">{title}</h2><div className="mt-4 space-y-3">{rows.length ? rows.map(row => <div key={row.label} className="flex items-center justify-between rounded-xl bg-teal-50/55 px-4 py-3 text-sm"><span className="font-bold">{row.label}</span><span className="font-black text-teal-800">{moneyRows ? money(row.total) : number(row.total)}</span></div>) : <p className="py-5 text-sm text-muted-foreground">لا توجد بيانات في هذه الفترة.</p>}</div></section>; }
