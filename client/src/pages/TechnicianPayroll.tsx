import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Printer, RefreshCw, Save, UserPlus, WalletCards } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { getOfflineCash, getOfflineSession, getOfflineVisits } from "@/lib/offlineSync";
import { getAppSettings, saveAppSettings, type AppSettings } from "@/lib/appSettings";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const paidCategories = new Set(["راتب فني", "سلفة فني", "مصروف فني"]);
const dueCategory = "مستحق فني";

type TechnicianProfile = { monthlySalary: number; installationPercent: number; maintenancePercent: number };

export function upsertTechnicianProfile(payroll: Record<string, TechnicianProfile>, name: string) {
  const cleanName = name.trim();
  if (!cleanName || payroll[cleanName]) return payroll;
  return { ...payroll, [cleanName]: { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0 } };
}

export function updateTechnicianProfile(payroll: Record<string, TechnicianProfile>, name: string, field: keyof TechnicianProfile, value: number) {
  const profile = payroll[name] ?? { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0 };
  const maximum = field === "monthlySalary" ? 99_999_999 : 100;
  return { ...payroll, [name]: { ...profile, [field]: Math.max(0, Math.min(maximum, Number.isFinite(value) ? value : 0)) } };
}
const money = (amount: number) => new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 2 }).format(amount / 100);
const dateLabel = (value: string | Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(value));
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
export const monthBounds = (month: string) => { const [year, monthNumber] = month.split("-").map(Number); const from = `${month}-01`; const lastDay = new Date(year, monthNumber, 0).getDate(); return { from, to: `${month}-${String(lastDay).padStart(2, "0")}` }; };

type PayrollTransaction = { id: number; transactionType: "income" | "expense"; amount: number; category: string; transactionDate: string | Date; recipientName: string | null; notes: string | null };
type VisitRecord = { id: number; visitType: string; visitDate: string | Date; technicianName: string | null; collectedAmount?: number | null };
type CashData = { transactions: PayrollTransaction[] };
type PayrollRow = { technician: string; required: number; paid: number; remaining: number; status: "paid" | "remaining"; transactions: PayrollTransaction[] }; 
const installationTypes = new Set(["installation"]);
const maintenanceTypes = new Set(["maintenance", "cartridge_change"]);
export function calculateTechnicianCommission(amount: number, visitType: string, installationPercent: number, maintenancePercent: number) {
  const percent = installationTypes.has(visitType) ? installationPercent : maintenanceTypes.has(visitType) ? maintenancePercent : 0;
  return Math.round(Math.max(0, amount) * Math.max(0, Math.min(100, percent)) / 100);
}

export default function TechnicianPayroll() {
  const owner = getOfflineSession();
  const [month, setMonth] = useState(currentMonth);
  const [technician, setTechnician] = useState("all");
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [technicianNameDraft, setTechnicianNameDraft] = useState("");
  const bounds = monthBounds(month);
  const query = trpc.filters.cash.summary.useQuery({ startDate: bounds.from, endDate: bounds.to, technician: technician === "all" ? undefined : technician }, { retry: false, staleTime: 60_000 });
  const visitQuery = trpc.filters.visits.list.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const cached = getOfflineCash<CashData>(owner?.id ?? 0);
  const source = (query.data ?? cached ?? { transactions: [] }) as CashData;
  const transactions = source.transactions ?? [];
  const visits = (visitQuery.data ?? (!navigator.onLine ? getOfflineVisits() : [])) as VisitRecord[];
  useEffect(() => {
    const refresh = () => setSettings(getAppSettings());
    window.addEventListener("purepoint-settings-changed", refresh);
    return () => window.removeEventListener("purepoint-settings-changed", refresh);
  }, []);
  const addTechnician = () => {
    const name = technicianNameDraft.trim();
    if (!name) { toast.error("اكتب اسم الفني أولًا."); return; }
    if (settings.technicianPayroll[name]) { toast.error("هذا الفني مضاف بالفعل."); return; }
    const next = saveAppSettings({ technicianPayroll: upsertTechnicianProfile(settings.technicianPayroll, name) });
    if (next.technicianPayroll === settings.technicianPayroll) { toast.error("هذا الفني مضاف بالفعل."); return; }
    setSettings(next);
    setTechnicianNameDraft("");
    toast.success(`تمت إضافة الفني ${name}`);
  };
  const updateTechnician = (name: string, field: "monthlySalary" | "installationPercent" | "maintenancePercent", value: number) => {
    const next = saveAppSettings({ technicianPayroll: updateTechnicianProfile(settings.technicianPayroll, name, field, value) });
    setSettings(next);
  };
  const removeTechnician = (name: string) => {
    if (!window.confirm(`حذف إعدادات الفني ${name} فقط؟ لن تُحذف زياراته أو معاملاته.`)) return;
    const nextPayroll = { ...settings.technicianPayroll };
    delete nextPayroll[name];
    setSettings(saveAppSettings({ technicianPayroll: nextPayroll }));
    toast.success("تم حذف إعدادات الفني فقط");
  };
  const rows = useMemo<PayrollRow[]>(() => {
    const monthVisits = visits.filter(visit => {
      const date = new Date(visit.visitDate);
      return date >= new Date(`${bounds.from}T00:00:00`) && date <= new Date(`${bounds.to}T23:59:59`);
    });
    const names = new Set<string>();
    transactions.forEach(transaction => { if (transaction.recipientName?.trim()) names.add(transaction.recipientName.trim()); });
    monthVisits.forEach(visit => { if (visit.technicianName?.trim()) names.add(visit.technicianName.trim()); });
    Object.keys(settings.technicianPayroll).forEach(name => names.add(name));
    const grouped = new Map<string, PayrollRow>();
    names.forEach(name => grouped.set(name, { technician: name, required: 0, paid: 0, remaining: 0, status: "paid", transactions: [] }));
    for (const transaction of transactions) {
      const category = transaction.category?.trim() || "";
      if (category !== dueCategory && !paidCategories.has(category)) continue;
      const name = transaction.recipientName?.trim() || "فني غير محدد";
      const row = grouped.get(name) ?? { technician: name, required: 0, paid: 0, remaining: 0, status: "paid", transactions: [] };
      if (category === dueCategory) row.required += transaction.amount;
      else row.paid += transaction.amount;
      row.transactions.push(transaction);
      grouped.set(name, row);
    }
    for (const name of Array.from(names)) {
      const payroll = settings.technicianPayroll[name] ?? { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0 };
      const row = grouped.get(name)!;
      if (payroll.monthlySalary > 0) {
        row.required += payroll.monthlySalary;
        row.transactions.push({ id: -Math.abs(name.length * 101 + 1), transactionType: "expense", amount: payroll.monthlySalary, category: "راتب أساسي تلقائي", transactionDate: `${month}-01`, recipientName: name, notes: "راتب شهري أساسي من إعدادات الفني" });
      }
      for (const visit of monthVisits.filter(item => item.technicianName?.trim() === name)) {
        const amount = Number(visit.collectedAmount ?? 0);
        const percent = installationTypes.has(visit.visitType) ? payroll.installationPercent : maintenanceTypes.has(visit.visitType) ? payroll.maintenancePercent : 0;
        const commission = calculateTechnicianCommission(amount, visit.visitType, payroll.installationPercent, payroll.maintenancePercent);
        if (commission > 0) {
          row.required += commission;
          row.transactions.push({ id: -Math.abs(visit.id), transactionType: "expense", amount: commission, category: installationTypes.has(visit.visitType) ? "عمولة تركيب تلقائية" : "عمولة صيانة تلقائية", transactionDate: visit.visitDate, recipientName: name, notes: `احتساب تلقائي بنسبة ${percent}% من تحصيل الزيارة` });
        }
      }
    }
    return Array.from(grouped.values()).map(row => ({ ...row, remaining: Math.max(row.required - row.paid, 0), status: (Math.max(row.required - row.paid, 0) > 0 ? "remaining" : "paid") as "paid" | "remaining" })).filter(row => row.required > 0 || row.paid > 0 || row.transactions.length > 0).sort((a, b) => b.remaining - a.remaining || a.technician.localeCompare(b.technician, "ar"));
  }, [transactions, visits, settings, bounds.from, bounds.to, month]);
  const selected = technician === "all" ? rows : rows.filter(row => row.technician === technician);
  const totals = selected.reduce((acc, row) => ({ required: acc.required + row.required, paid: acc.paid + row.paid, remaining: acc.remaining + row.remaining }), { required: 0, paid: 0, remaining: 0 });
  const technicians = rows.map(row => row.technician).sort((a, b) => a.localeCompare(b, "ar"));
  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ البيان: "الشهر", القيمة: month }, { البيان: "الفني", القيمة: technician === "all" ? "كل الفنيين" : technician }, { البيان: "إجمالي المستحق", القيمة: totals.required / 100 }, { البيان: "إجمالي المدفوع", القيمة: totals.paid / 100 }, { البيان: "إجمالي المتبقي", القيمة: totals.remaining / 100 }]), "ملخص الكشف");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(selected.map(row => ({ الفني: row.technician, الحالة: row.status === "paid" ? "مدفوع" : "متبقي", "المستحق": row.required / 100, "المدفوع": row.paid / 100, "المتبقي": row.remaining / 100, "عدد العمليات": row.transactions.length }))), "الفنيون");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(selected.flatMap(row => row.transactions.map(item => ({ الفني: row.technician, التاريخ: dateLabel(item.transactionDate), التصنيف: item.category, "المبلغ": item.amount / 100, الملاحظات: item.notes || "" })))), "تفاصيل العمليات");
    XLSX.writeFile(workbook, `كشف-رواتب-الفنيين-${month}.xlsx`);
  };
  return <div dir="rtl" className="mx-auto max-w-7xl space-y-6 print:bg-white">
    <header className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-teal-950 via-teal-800 to-cyan-700 p-6 text-white shadow-xl shadow-teal-950/10 sm:p-8 print:hidden">
      <div className="absolute -left-12 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl"><p className="mb-2 text-sm font-bold text-teal-100">الإدارة المالية · فريق العمل</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">إدارة الفنيين والرواتب</h1><p className="mt-3 text-sm leading-7 text-teal-50/90">تابع راتب كل فني وعمولاته وما تم دفعه والمتبقي له من شاشة واحدة، مع حفظ الإعدادات تلقائيًا على هذا الجهاز.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => query.refetch()}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button><Button variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => window.print()}><Printer className="ml-2 h-4 w-4" />طباعة / PDF</Button><Button className="h-11 rounded-xl bg-white text-teal-900 hover:bg-teal-50" onClick={exportExcel}><Download className="ml-2 h-4 w-4" />تصدير Excel</Button></div>
      </div>
    </header>
    {!query.data ? <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 print:hidden"><span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100">!</span><span>يُعرض الكشف من البيانات المحلية؛ يمكنك متابعة الرواتب والتصدير دون اتصال.</span></div> : null}
    <section className="soft-card overflow-hidden print:hidden"><div className="border-b border-teal-950/6 bg-gradient-to-l from-teal-50 to-white p-5 sm:p-6"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20"><UserPlus className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-teal-950">الفنيون وإعدادات الاستحقاق</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">أضف الفني مرة واحدة، ثم حدد راتبه ونسبة عمولة التركيبات والصيانة. هذه الإعدادات لا تعني أن المبلغ دُفع.</p></div></div></div><div className="space-y-5 p-5 sm:p-6"><div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 sm:flex-row"><input className="field-input flex-1 bg-white" value={technicianNameDraft} onChange={event => setTechnicianNameDraft(event.target.value)} placeholder="اكتب اسم الفني لإضافته" aria-label="اسم الفني الجديد" /><Button type="button" onClick={addTechnician} className="h-11 rounded-xl bg-teal-700 hover:bg-teal-800"><UserPlus className="ml-2 h-4 w-4" />إضافة فني</Button></div>{Object.keys(settings.technicianPayroll).length ? <div className="grid gap-3 md:grid-cols-2">{Object.entries(settings.technicianPayroll).map(([name, profile]) => <article key={name} className="rounded-2xl border border-teal-950/8 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="mb-4 flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-muted-foreground">بيانات الفني</p><h3 className="mt-1 text-lg font-black text-teal-950">{name}</h3></div><Button type="button" variant="ghost" className="rounded-xl text-xs font-bold text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => removeTechnician(name)}>حذف</Button></div><div className="grid gap-3 sm:grid-cols-3"><label><span className="field-label">الراتب الشهري</span><input type="number" min="0" step="0.01" className="field-input mt-1" value={(profile.monthlySalary / 100).toString()} onChange={event => updateTechnician(name, "monthlySalary", Math.round(Number(event.target.value || 0) * 100))} /></label><label><span className="field-label">تركيبات %</span><input type="number" min="0" max="100" step="0.01" className="field-input mt-1" value={profile.installationPercent} onChange={event => updateTechnician(name, "installationPercent", Number(event.target.value))} /></label><label><span className="field-label">صيانة %</span><input type="number" min="0" max="100" step="0.01" className="field-input mt-1" value={profile.maintenancePercent} onChange={event => updateTechnician(name, "maintenancePercent", Number(event.target.value))} /></label></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 p-6 text-center text-sm font-bold text-teal-800">لم تتم إضافة فنيين بعد. ابدأ بإضافة أول فني من الحقل أعلاه.</div>}<div className="flex items-center gap-2 text-xs font-semibold text-teal-800"><Save className="h-4 w-4" />يتم حفظ كل تعديل تلقائيًا على هذا الجهاز.</div></div></section>
    <section className="soft-card grid gap-4 p-5 sm:grid-cols-2 sm:p-6 print:hidden"><label><span className="field-label">الشهر</span><input type="month" className="field-input mt-1" value={month} onChange={event => setMonth(event.target.value)} /></label><label><span className="field-label">الفني</span><select className="field-input mt-1" value={technician} onChange={event => setTechnician(event.target.value)}><option value="all">كل الفنيين</option>{technicians.map(name => <option key={name} value={name}>{name}</option>)}</select></label><div className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900 sm:col-span-2">الفترة: <span dir="ltr">{bounds.from} — {bounds.to}</span></div></section>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard label="عدد الفنيين" value={selected.length.toLocaleString("ar-SA")} tone="text-sky-950 bg-sky-50 border-sky-100" /><SummaryCard label="إجمالي المستحق" value={money(totals.required)} tone="text-indigo-950 bg-indigo-50 border-indigo-100" /><SummaryCard label="إجمالي المدفوع" value={money(totals.paid)} tone="text-emerald-950 bg-emerald-50 border-emerald-100" /><SummaryCard label="إجمالي المتبقي" value={money(totals.remaining)} tone="text-amber-950 bg-amber-50 border-amber-100" /></section>
    <section className="soft-card overflow-hidden p-5 sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-teal-950">ملخص الفنيين</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">المستحق يشمل الراتب والعمولات، والمدفوع يأتي من حركات الخزينة فقط.</p></div><WalletCards className="h-6 w-6 shrink-0 text-teal-700" /></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="rounded-xl bg-teal-50 text-xs font-bold text-teal-950"><tr><th className="px-3 py-3">الفني</th><th className="px-3 py-3">الحالة</th><th className="px-3 py-3">المستحق</th><th className="px-3 py-3">المدفوع</th><th className="px-3 py-3">المتبقي</th><th className="px-3 py-3">العمليات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{selected.length ? selected.map(row => <tr key={row.technician} className="transition hover:bg-teal-50/40"><td className="px-3 py-4 font-black text-teal-950">{row.technician}</td><td className="px-3 py-4"><span className={row.status === "paid" ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800" : "inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"}>{row.status === "paid" ? "مدفوع" : "متبقي"}</span></td><td className="px-3 py-4 font-bold">{money(row.required)}</td><td className="px-3 py-4 font-black text-teal-800">{money(row.paid)}</td><td className="px-3 py-4 font-black text-amber-700">{money(row.remaining)}</td><td className="px-3 py-4 font-bold text-muted-foreground">{row.transactions.length}</td></tr>) : <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">لا توجد عمليات رواتب في هذا الشهر.</td></tr>}</tbody></table></div></section>
    <section className="soft-card overflow-hidden p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><FileText className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-teal-950">تفاصيل العمليات</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">كل بند مستحق أو مدفوع مسجل للفني خلال الفترة المحددة.</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-slate-50 text-xs font-bold text-slate-700"><tr><th className="px-3 py-3">التاريخ</th><th className="px-3 py-3">الفني</th><th className="px-3 py-3">التصنيف</th><th className="px-3 py-3">المبلغ</th><th className="px-3 py-3">الملاحظات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{selected.flatMap(row => row.transactions.map(item => <tr key={item.id + "-" + item.category} className="transition hover:bg-slate-50"><td className="px-3 py-3">{dateLabel(item.transactionDate)}</td><td className="px-3 py-3 font-bold">{row.technician}</td><td className="px-3 py-3">{item.category}</td><td className={item.category === dueCategory ? "px-3 py-3 font-black text-indigo-700" : "px-3 py-3 font-black text-emerald-700"}>{money(item.amount)}</td><td className="max-w-xs truncate px-3 py-3 text-muted-foreground">{item.notes || "—"}</td></tr>))}{!selected.some(row => row.transactions.length) ? <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد تفاصيل لعرضها.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) { return <article className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}><p className="text-sm font-bold opacity-80">{label}</p><p className="mt-3 text-2xl font-black tracking-tight">{value}</p></article>; }
