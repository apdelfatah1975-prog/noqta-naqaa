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
const money = (amount: number) => new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", maximumFractionDigits: 2 }).format(amount / 100);
const dateLabel = (value: string | Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(value));
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
const monthBounds = (month: string) => { const [year, monthNumber] = month.split("-").map(Number); const from = `${month}-01`; const lastDay = new Date(year, monthNumber, 0).getDate(); return { from, to: `${month}-${String(lastDay).padStart(2, "0")}` }; };

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
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ البيان: "الشهر", القيمة: month }, { البيان: "الفني", القيمة: technician === "all" ? "كل الفنيين" : technician }, { البيان: "إجمالي المستحق بالريال", القيمة: totals.required / 100 }, { البيان: "إجمالي المدفوع بالريال", القيمة: totals.paid / 100 }, { البيان: "إجمالي المتبقي بالريال", القيمة: totals.remaining / 100 }]), "ملخص الكشف");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(selected.map(row => ({ الفني: row.technician, الحالة: row.status === "paid" ? "مدفوع" : "متبقي", "المستحق بالريال": row.required / 100, "المدفوع بالريال": row.paid / 100, "المتبقي بالريال": row.remaining / 100, "عدد العمليات": row.transactions.length }))), "الفنيون");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(selected.flatMap(row => row.transactions.map(item => ({ الفني: row.technician, التاريخ: dateLabel(item.transactionDate), التصنيف: item.category, "المبلغ بالريال": item.amount / 100, الملاحظات: item.notes || "" })))), "تفاصيل العمليات");
    XLSX.writeFile(workbook, `كشف-رواتب-الفنيين-${month}.xlsx`);
  };
  return <div dir="rtl" className="mx-auto max-w-7xl space-y-6 print:bg-white">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden"><div><p className="text-sm font-bold text-teal-700">الإدارة المالية</p><h1 className="page-heading">كشف رواتب الفنيين</h1><p className="page-subheading">يحسب الراتب الأساسي والعمولات تلقائيًا من إعدادات الفني والزيارات المسجلة، بينما يظل الدفع الفعلي من الخزينة فقط.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11 rounded-xl" onClick={() => query.refetch()}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button><Button variant="outline" className="h-11 rounded-xl" onClick={() => window.print()}><Printer className="ml-2 h-4 w-4" />طباعة / PDF</Button><Button className="h-11 rounded-xl bg-teal-700 hover:bg-teal-800" onClick={exportExcel}><Download className="ml-2 h-4 w-4" />تصدير Excel</Button></div></div>
    {!query.data ? <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 print:hidden">يُعرض الكشف من البيانات المحلية؛ يمكنك متابعة الرواتب والتصدير دون اتصال.</div> : null}
    <section className="soft-card overflow-hidden print:hidden"><div className="flex items-start gap-3 border-b border-teal-950/6 p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-sky-100 text-sky-700"><UserPlus className="h-5 w-5" /></div><div><h2 className="font-extrabold">إدارة الفنيين والرواتب</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">أضف الفني وحدد راتبه الشهري ونسب العمولات من هنا. هذه الإعدادات تحفظ محليًا وتستخدم تلقائيًا في كشف الشهر، ولا تعني أن المبلغ دُفع.</p></div></div><div className="space-y-4 p-5"><div className="flex flex-col gap-2 sm:flex-row"><input className="field-input flex-1" value={technicianNameDraft} onChange={event => setTechnicianNameDraft(event.target.value)} placeholder="اكتب اسم الفني لإضافته" /><Button type="button" variant="outline" onClick={addTechnician} className="h-11 rounded-xl border-teal-700/30 text-teal-800"><UserPlus className="ml-2 h-4 w-4" />إضافة فني</Button></div>{Object.keys(settings.technicianPayroll).length ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-right text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-3">الفني</th><th className="px-3 py-3">الراتب الشهري (ر.س)</th><th className="px-3 py-3">عمولة التركيبات %</th><th className="px-3 py-3">عمولة الصيانة %</th><th className="px-3 py-3">إجراء</th></tr></thead><tbody className="divide-y">{Object.entries(settings.technicianPayroll).map(([name, profile]) => <tr key={name}><td className="px-3 py-3 font-bold">{name}</td><td className="px-3 py-2"><input type="number" min="0" step="0.01" className="field-input w-40" value={(profile.monthlySalary / 100).toString()} onChange={event => updateTechnician(name, "monthlySalary", Math.round(Number(event.target.value || 0) * 100))} /></td><td className="px-3 py-2"><input type="number" min="0" max="100" step="0.01" className="field-input w-32" value={profile.installationPercent} onChange={event => updateTechnician(name, "installationPercent", Number(event.target.value))} /></td><td className="px-3 py-2"><input type="number" min="0" max="100" step="0.01" className="field-input w-32" value={profile.maintenancePercent} onChange={event => updateTechnician(name, "maintenancePercent", Number(event.target.value))} /></td><td className="px-3 py-2"><Button type="button" variant="ghost" className="text-rose-700" onClick={() => removeTechnician(name)}>حذف الإعدادات</Button></td></tr>)}</tbody></table></div> : <div className="rounded-xl bg-slate-50 p-4 text-sm text-muted-foreground">لم تتم إضافة فنيين بعد. أضف أول فني من الحقل أعلاه.</div>}<div className="flex items-center gap-2 text-xs font-semibold text-teal-800"><Save className="h-4 w-4" />يتم حفظ كل تعديل تلقائيًا على هذا الجهاز.</div></div></section>
    <section className="soft-card flex flex-col gap-4 p-5 sm:flex-row sm:items-end print:hidden"><label className="flex-1"><span className="field-label">الشهر</span><input type="month" className="field-input mt-1" value={month} onChange={event => setMonth(event.target.value)} /></label><label className="flex-1"><span className="field-label">الفني</span><select className="field-input mt-1" value={technician} onChange={event => setTechnician(event.target.value)}><option value="all">كل الفنيين</option>{technicians.map(name => <option key={name} value={name}>{name}</option>)}</select></label><div className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900">من {bounds.from} إلى {bounds.to}</div></section>
    <section className="grid gap-4 sm:grid-cols-3"><SummaryCard label="إجمالي المستحق" value={money(totals.required)} tone="text-indigo-900 bg-indigo-50" /><SummaryCard label="إجمالي المدفوع" value={money(totals.paid)} tone="text-emerald-900 bg-emerald-50" /><SummaryCard label="إجمالي المتبقي" value={money(totals.remaining)} tone="text-amber-950 bg-amber-50" /></section>
    <section className="soft-card overflow-hidden p-5"><div className="mb-4 flex items-center justify-between"><div><h2 className="font-black">ملخص الفنيين</h2><p className="mt-1 text-xs text-muted-foreground">المستحق يشمل الراتب الأساسي والعمولات المعتمدة تلقائيًا؛ ولا يتحول إلى مدفوع إلا من خلال حركة خزينة.</p></div><WalletCards className="h-5 w-5 text-teal-700" /></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-3">الفني</th><th className="px-3 py-3">الحالة</th><th className="px-3 py-3">المستحق</th><th className="px-3 py-3">المدفوع</th><th className="px-3 py-3">المتبقي</th><th className="px-3 py-3">العمليات</th></tr></thead><tbody className="divide-y">{selected.length ? selected.map(row => <tr key={row.technician}><td className="px-3 py-3 font-bold">{row.technician}</td><td className={`px-3 py-3 font-bold ${row.status === "paid" ? "text-emerald-700" : "text-amber-700"}`}>{row.status === "paid" ? "مدفوع" : "متبقي"}</td><td className="px-3 py-3">{money(row.required)}</td><td className="px-3 py-3 font-black text-teal-800">{money(row.paid)}</td><td className="px-3 py-3 font-black text-amber-700">{money(row.remaining)}</td><td className="px-3 py-3">{row.transactions.length}</td></tr>) : <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">لا توجد عمليات رواتب في هذا الشهر.</td></tr>}</tbody></table></div></section>
    <section className="soft-card overflow-hidden p-5"><div className="mb-4 flex items-center gap-2"><FileText className="h-5 w-5 text-teal-700" /><div><h2 className="font-black">تفاصيل العمليات</h2><p className="mt-1 text-xs text-muted-foreground">كل بند مستحق أو مدفوع مسجل للفني خلال الشهر المحدد.</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="px-3 py-3">التاريخ</th><th className="px-3 py-3">الفني</th><th className="px-3 py-3">التصنيف</th><th className="px-3 py-3">المبلغ</th><th className="px-3 py-3">الملاحظات</th></tr></thead><tbody className="divide-y">{selected.flatMap(row => row.transactions.map(item => <tr key={`${item.id}-${item.category}`}><td className="px-3 py-3">{dateLabel(item.transactionDate)}</td><td className="px-3 py-3 font-bold">{row.technician}</td><td className="px-3 py-3">{item.category}</td><td className={`px-3 py-3 font-black ${item.category === dueCategory ? "text-indigo-700" : "text-emerald-700"}`}>{money(item.amount)}</td><td className="max-w-xs truncate px-3 py-3 text-muted-foreground">{item.notes || "—"}</td></tr>))}{!selected.some(row => row.transactions.length) ? <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد تفاصيل لعرضها.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) { return <article className={`rounded-2xl p-5 shadow-sm ${tone}`}><p className="text-sm font-bold opacity-80">{label}</p><p className="mt-3 text-2xl font-black">{value}</p></article>; }

export { monthBounds };
