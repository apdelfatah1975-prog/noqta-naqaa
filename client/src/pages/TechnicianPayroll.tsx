import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Printer, RefreshCw, Save, UserPlus, WalletCards } from "lucide-react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { formatAppMoney, getAppSettings, saveAppSettings, type AppSettings, type SalesAgentCommissionMode, type SalesAgentProfile } from "@/lib/appSettings";
import { printArabicPdf } from "@/lib/pdfExport";
import { localizeExcelRows } from "@/lib/excelExport";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const paidCategories = new Set(["راتب فني", "دفعة راتب فني", "سلفة فني", "مصروف فني"]);
const dueCategory = "مستحق فني";

type TechnicianProfile = { monthlySalary: number; installationPercent: number; maintenancePercent: number; phone?: string };

export function upsertSalesAgentProfile(agents: Record<string, SalesAgentProfile>, name: string) {
  const cleanName = name.trim();
  if (!cleanName || agents[cleanName]) return agents;
  return { ...agents, [cleanName]: { commissionMode: "per_filter" as const, commissionValue: 0, filtersPerGroup: 1, phone: "" } };
}

export function updateSalesAgentProfile(agents: Record<string, SalesAgentProfile>, name: string, field: keyof SalesAgentProfile, value: number | string) {
  const profile = agents[name] ?? { commissionMode: "per_filter" as const, commissionValue: 0, filtersPerGroup: 1, phone: "" };
  if (field === "commissionMode") return { ...agents, [name]: { ...profile, commissionMode: value as SalesAgentCommissionMode } };
  if (field === "phone") return { ...agents, [name]: { ...profile, phone: String(value) } };
  const numericValue = Number(value);
  const safeValue = field === "filtersPerGroup" ? Math.max(1, Math.min(1000, Number.isFinite(numericValue) ? Math.round(numericValue) : 1)) : Math.max(0, Math.min(99_999_999, Number.isFinite(numericValue) ? numericValue : 0));
  return { ...agents, [name]: { ...profile, [field]: safeValue } };
}

export function calculateSalesAgentCommission(filterCount: number, profile: SalesAgentProfile) {
  const count = Math.max(0, Math.floor(filterCount));
  if (profile.commissionMode === "per_group") return Math.floor(count / Math.max(1, profile.filtersPerGroup)) * Math.max(0, profile.commissionValue);
  return count * Math.max(0, profile.commissionValue);
}

export function upsertTechnicianProfile(payroll: Record<string, TechnicianProfile>, name: string) {
  const cleanName = name.trim();
  if (!cleanName || payroll[cleanName]) return payroll;
  return { ...payroll, [cleanName]: { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0, phone: "" } };
}

export function updateTechnicianProfile(payroll: Record<string, TechnicianProfile>, name: string, field: keyof TechnicianProfile, value: number | string) {
  const profile = payroll[name] ?? { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0, phone: "" };
  if (field === "phone") return { ...payroll, [name]: { ...profile, phone: String(value) } };
  const numericValue = Number(value);
  const maximum = field === "monthlySalary" ? 99_999_999 : 100;
  return { ...payroll, [name]: { ...profile, [field]: Math.max(0, Math.min(maximum, Number.isFinite(numericValue) ? numericValue : 0)) } };
}
export const formatPayrollMoney = (amount: number) => formatAppMoney(Number(amount) || 0);
const dateLabel = (value: string | Date) => new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(new Date(value));
const currentMonth = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`; };
export const monthBounds = (month: string) => { const [year, monthNumber] = month.split("-").map(Number); const from = `${month}-01`; const lastDay = new Date(year, monthNumber, 0).getDate(); return { from, to: `${month}-${String(lastDay).padStart(2, "0")}` }; };

type PayrollTransaction = { id: number; transactionType: "income" | "expense"; amount: number; category: string; transactionDate: string | Date; recipientName: string | null; notes: string | null };
type VisitRecord = { id: number; visitType: string; visitDate: string | Date; technicianName: string | null; salesAgentName?: string | null; filterCount?: number | null; collectedAmount?: number | null };
type CashData = { transactions: PayrollTransaction[] };
type PayrollRow = { technician: string; required: number; paid: number; remaining: number; status: "paid" | "remaining"; transactions: PayrollTransaction[] }; 
const installationTypes = new Set(["installation"]);
const maintenanceTypes = new Set(["maintenance", "cartridge_change"]);
export function calculateTechnicianCommission(amount: number, visitType: string, installationPercent: number, maintenancePercent: number) {
  const percent = installationTypes.has(visitType) ? installationPercent : maintenanceTypes.has(visitType) ? maintenancePercent : 0;
  return Math.round(Math.max(0, amount) * Math.max(0, Math.min(100, percent)) / 100);
}

export function buildTechnicianMonthlyReportRows(row: PayrollRow) {
  return row.transactions.map(item => ({
    التاريخ: dateLabel(item.transactionDate),
    النوع: item.category === dueCategory ? "مستحق" : "مدفوع",
    التصنيف: item.category,
    المبلغ: formatPayrollMoney(item.amount),
    الملاحظات: item.notes || "—",
  }));
}


export default function TechnicianPayroll() {
  const [month, setMonth] = useState(currentMonth);
  const [technician, setTechnician] = useState("all");
  const [settings, setSettings] = useState<AppSettings>(() => getAppSettings());
  const [technicianNameDraft, setTechnicianNameDraft] = useState("");
  const [salesAgentNameDraft, setSalesAgentNameDraft] = useState("");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentTechnician, setPaymentTechnician] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [paymentNotes, setPaymentNotes] = useState("");
  const bounds = monthBounds(month);
  const query = trpc.filters.cash.summary.useQuery({ startDate: bounds.from, endDate: bounds.to, technician: technician === "all" ? undefined : technician }, { retry: false, staleTime: 5_000, refetchInterval: 8_000, refetchOnReconnect: true, refetchOnWindowFocus: false, networkMode: "online" });
  const utils = trpc.useUtils();
  const createTechnicianPayment = trpc.filters.cash.create.useMutation({
    onSuccess: () => {
      utils.filters.cash.summary.invalidate();
      toast.success(`تم تسجيل دفعة ${paymentTechnician} وخصمها من حساب راتبه والخزنة`);
      setPaymentOpen(false);
      setPaymentAmount("");
      setPaymentNotes("");
      query.refetch();
    },
    onError: error => toast.error(error.message || "تعذر تسجيل الدفعة.")
  });
  const visitQuery = trpc.filters.visits.list.useQuery(undefined, { retry: false, staleTime: 5_000, refetchInterval: 8_000, refetchOnReconnect: true, refetchOnWindowFocus: false, networkMode: "online" });
  const source = (query.data ?? { transactions: [] }) as CashData;
  const transactions = Array.isArray(source.transactions) ? source.transactions : [];
  const visits = Array.isArray(visitQuery.data) ? visitQuery.data as VisitRecord[] : [];
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
  const updateTechnician = (name: string, field: "monthlySalary" | "installationPercent" | "maintenancePercent" | "phone", value: number | string) => {
    const next = saveAppSettings({ technicianPayroll: updateTechnicianProfile(settings.technicianPayroll, name, field, value) });
    setSettings(next);
  };
  const addSalesAgent = () => {
    const name = salesAgentNameDraft.trim();
    if (!name) { toast.error("اكتب اسم متابع العملاء أولًا."); return; }
    if (settings.salesAgents[name]) { toast.error("هذا المتابع مضاف بالفعل."); return; }
    const next = saveAppSettings({ salesAgents: upsertSalesAgentProfile(settings.salesAgents, name) });
    setSettings(next);
    setSalesAgentNameDraft("");
    toast.success(`تمت إضافة متابع العملاء ${name}`);
  };
  const updateSalesAgent = (name: string, field: keyof SalesAgentProfile, value: number | string) => {
    const next = saveAppSettings({ salesAgents: updateSalesAgentProfile(settings.salesAgents, name, field, value) });
    setSettings(next);
  };
  const removeSalesAgent = (name: string) => {
    if (!window.confirm(`حذف إعدادات متابع العملاء ${name} فقط؟ لن تُحذف الزيارات المرتبطة به.`)) return;
    const nextAgents = { ...settings.salesAgents };
    delete nextAgents[name];
    setSettings(saveAppSettings({ salesAgents: nextAgents }));
  };
  const removeTechnician = (name: string) => {
    if (!window.confirm(`حذف إعدادات الفني ${name} فقط؟ لن تُحذف زياراته أو معاملاته.`)) return;
    const nextPayroll = { ...settings.technicianPayroll };
    delete nextPayroll[name];
    setSettings(saveAppSettings({ technicianPayroll: nextPayroll }));
    toast.success("تم حذف إعدادات الفني فقط");
  };
  const monthlyVisits = useMemo(() => visits.filter(visit => {
    const date = new Date(visit.visitDate);
    return date >= new Date(`${bounds.from}T00:00:00`) && date <= new Date(`${bounds.to}T23:59:59`);
  }), [visits, bounds.from, bounds.to]);
  const rows = useMemo<PayrollRow[]>(() => {
    const names = new Set<string>();
    transactions.forEach(transaction => { if (transaction.recipientName?.trim()) names.add(transaction.recipientName.trim()); });
    monthlyVisits.forEach(visit => { if (visit.technicianName?.trim()) names.add(visit.technicianName.trim()); });
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
      const payroll = settings.technicianPayroll[name] ?? { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0, phone: "" };
      const row = grouped.get(name)!;
      if (payroll.monthlySalary > 0) {
        row.required += payroll.monthlySalary;
        row.transactions.push({ id: -Math.abs(name.length * 101 + 1), transactionType: "expense", amount: payroll.monthlySalary, category: "راتب أساسي تلقائي", transactionDate: `${month}-01`, recipientName: name, notes: "راتب شهري أساسي من إعدادات الفني" });
      }
      for (const visit of monthlyVisits.filter(item => item.technicianName?.trim() === name)) {
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
  }, [transactions, monthlyVisits, settings, bounds.from, bounds.to, month]);
  const salesAgentRows = useMemo(() => Object.entries(settings.salesAgents).map(([name, profile]) => {
    const filterCount = monthlyVisits.filter(visit => visit.salesAgentName?.trim() === name).reduce((sum, visit) => sum + Math.max(0, Number(visit.filterCount ?? 1)), 0);
    return { name, filterCount, commission: calculateSalesAgentCommission(filterCount, profile), profile };
  }).sort((a, b) => b.commission - a.commission || a.name.localeCompare(b.name, "ar")), [settings.salesAgents, monthlyVisits]);
  const salesCommissionTotal = salesAgentRows.reduce((sum, row) => sum + row.commission, 0);
  const selected = technician === "all" ? rows : rows.filter(row => row.technician === technician);
  const totals = selected.reduce((acc, row) => ({ required: acc.required + row.required, paid: acc.paid + row.paid, remaining: acc.remaining + row.remaining }), { required: 0, paid: 0, remaining: 0 });
  const technicianCommissionTotal = selected.reduce((sum, row) => sum + row.transactions.filter(item => item.category.includes("عمولة")).reduce((inner, item) => inner + item.amount, 0), 0);
  const technicians = rows.map(row => row.technician).sort((a, b) => a.localeCompare(b, "ar"));
  const exportExcel = () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(localizeExcelRows([{ البيان: "الشهر", القيمة: month }, { البيان: "الفني", القيمة: technician === "all" ? "كل الفنيين" : technician }, { البيان: "إجمالي المستحق", القيمة: Math.round(totals.required) }, { البيان: "إجمالي المدفوع", القيمة: Math.round(totals.paid) }, { البيان: "إجمالي المتبقي", القيمة: Math.round(totals.remaining) }])), "ملخص الكشف");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(localizeExcelRows(selected.map(row => ({ الفني: row.technician, الحالة: row.status === "paid" ? "مدفوع" : "متبقي", "المستحق": Math.round(row.required), "المدفوع": Math.round(row.paid), "المتبقي": Math.round(row.remaining), "عدد العمليات": row.transactions.length })))), "الفنيون");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(localizeExcelRows(selected.flatMap(row => row.transactions.map(item => ({ الفني: row.technician, التاريخ: dateLabel(item.transactionDate), التصنيف: item.category, "المبلغ": Math.round(item.amount), الملاحظات: item.notes || "" }))))), "تفاصيل العمليات");
    XLSX.writeFile(workbook, `كشف-رواتب-الفنيين-${month}.xlsx`);
  };
  const exportPdf = () => {
    const rows = selected.map(row => ({ الفني: row.technician, الحالة: row.status === "paid" ? "مدفوع" : "متبقي", المستحق: Math.round(row.required).toString(), المدفوع: Math.round(row.paid).toString(), المتبقي: Math.round(row.remaining).toString(), "عدد العمليات": row.transactions.length }));
    const opened = printArabicPdf(`كشف رواتب الفنيين - ${month}`, rows, [
      { key: "الفني", label: "الفني" }, { key: "الحالة", label: "الحالة" }, { key: "المستحق", label: "المستحق" },
      { key: "المدفوع", label: "المدفوع" }, { key: "المتبقي", label: "المتبقي" }, { key: "عدد العمليات", label: "عدد العمليات" },
    ]);
    if (opened) toast.success("تم تجهيز PDF لكشف الرواتب"); else toast.error("تعذر فتح نافذة PDF؛ اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى");
  };
  const exportTechnicianPdf = () => {
    const row = selected[0];
    if (technician === "all" || !row) {
      toast.error("اختر فنيًا محددًا أولًا لإصدار كشفه الشهري");
      return;
    }
    const summaryRows = [
      { التاريخ: "ملخص الشهر", النوع: "إجمالي", التصنيف: "المستحق", المبلغ: formatPayrollMoney(row.required), الملاحظات: `الفترة: ${month}` },
      { التاريخ: "ملخص الشهر", النوع: "إجمالي", التصنيف: "المدفوع", المبلغ: formatPayrollMoney(row.paid), الملاحظات: "الراتب والسلف والمصروفات المسجلة" },
      { التاريخ: "ملخص الشهر", النوع: "إجمالي", التصنيف: "المتبقي", المبلغ: formatPayrollMoney(row.remaining), الملاحظات: row.status === "paid" ? "تمت التسوية" : "المبلغ المتبقي للفني" },
    ];
    const opened = printArabicPdf(`كشف شهري تفصيلي - ${row.technician} - ${month}`, [...summaryRows, ...buildTechnicianMonthlyReportRows(row)], [
      { key: "التاريخ", label: "التاريخ" }, { key: "النوع", label: "النوع" }, { key: "التصنيف", label: "التصنيف" },
      { key: "المبلغ", label: "المبلغ" }, { key: "الملاحظات", label: "الملاحظات" },
    ]);
    if (opened) toast.success(`تم تجهيز كشف ${row.technician} الشهري`); else toast.error("تعذر فتح نافذة PDF؛ اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى");
  };
  return <div dir="rtl" className="mx-auto max-w-7xl space-y-4 print:bg-white">
    <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-950 via-teal-800 to-cyan-700 p-4 text-white shadow-xl shadow-teal-950/10 sm:p-6 print:hidden">
      <div className="absolute -left-12 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl"><p className="mb-2 text-sm font-bold text-teal-100">الإدارة المالية · فريق العمل</p><h1 className="text-3xl font-black tracking-tight sm:text-4xl">إدارة الفنيين والرواتب</h1><p className="mt-3 text-sm leading-7 text-teal-50/90">تابع راتب كل فني وعمولاته وما تم دفعه والمتبقي له من شاشة واحدة، مع حفظ الإعدادات تلقائيًا على هذا الجهاز.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => query.refetch()}><RefreshCw className="ml-2 h-4 w-4" />تحديث</Button><Button variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => window.print()}><Printer className="ml-2 h-4 w-4" />طباعة / PDF</Button><Button variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={exportPdf}><Download className="ml-2 h-4 w-4" />PDF</Button><Button variant="outline" className="h-11 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white disabled:cursor-not-allowed disabled:opacity-50" onClick={exportTechnicianPdf} disabled={technician === "all"}><FileText className="ml-2 h-4 w-4" />كشف فني PDF</Button><Button className="h-11 rounded-xl bg-white text-teal-900 hover:bg-teal-50" onClick={exportExcel}><Download className="ml-2 h-4 w-4" />تصدير Excel</Button></div>
      </div>
    </header>
    {!query.data ? <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 print:hidden"><span className="grid h-8 w-8 place-items-center rounded-full bg-amber-100">!</span><span>يُعرض الكشف من البيانات المحلية؛ يمكنك متابعة الرواتب والتصدير دون اتصال.</span></div> : null}
    <section className="soft-card overflow-hidden print:hidden"><div className="border-b border-cyan-950/6 bg-gradient-to-l from-cyan-50 to-white p-3 sm:p-4"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-700 text-white shadow-lg shadow-cyan-700/20"><UserPlus className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-cyan-950">متابعو العملاء</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">أضف الشخص الذي يتصل بالعملاء ويتابع الصيانة أو يجلب فلاتر جديدة، ثم اختر طريقة العمولة المناسبة له.</p></div></div></div><div className="space-y-3 p-3 sm:p-4"><div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 sm:flex-row"><input className="field-input flex-1 bg-white" value={salesAgentNameDraft} onChange={event => setSalesAgentNameDraft(event.target.value)} placeholder="اكتب اسم متابع العملاء" aria-label="اسم متابع العملاء الجديد" /><Button type="button" onClick={addSalesAgent} className="h-11 rounded-xl bg-cyan-700 hover:bg-cyan-800"><UserPlus className="ml-2 h-4 w-4" />إضافة متابع</Button></div>{salesAgentRows.length ? <div className="grid gap-2 md:grid-cols-2">{salesAgentRows.map(({ name, profile, filterCount, commission }) => <article key={name} className="rounded-xl border border-cyan-200/70 bg-gradient-to-br from-white to-cyan-50/70 p-2.5 shadow-sm"><div className="mb-2 flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-bold text-muted-foreground">متابع عملاء</p><h3 className="truncate text-base font-black text-cyan-950">{name}</h3></div><Button type="button" variant="ghost" className="h-8 rounded-lg px-2 text-xs font-bold text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => removeSalesAgent(name)}>حذف</Button></div><div className="grid grid-cols-2 gap-2"><label><span className="field-label">طريقة العمولة</span><select className="field-input mt-1 h-9 text-sm" value={profile.commissionMode} onChange={event => updateSalesAgent(name, "commissionMode", event.target.value)}><option value="per_filter">عن كل فلتر</option><option value="per_group">عن كل مجموعة فلاتر</option></select></label><label><span className="field-label">قيمة العمولة</span><input type="number" min="0" step="1" className="field-input mt-1 h-9 text-sm" value={profile.commissionValue} onChange={event => updateSalesAgent(name, "commissionValue", event.target.value)} /></label></div><div className="mt-2 grid grid-cols-2 gap-2"><label><span className="field-label">عدد الفلاتر بالمجموعة</span><input type="number" min="1" step="1" disabled={profile.commissionMode !== "per_group"} className="field-input mt-1 h-9 text-sm disabled:bg-slate-100" value={profile.filtersPerGroup} onChange={event => updateSalesAgent(name, "filtersPerGroup", event.target.value)} /></label><div className="rounded-lg bg-white/80 p-2 text-center"><p className="text-[10px] font-bold text-muted-foreground">المحتسب من الزيارات</p><p className="text-sm font-black text-cyan-950">{filterCount.toLocaleString("ar-SA")} فلتر</p><p className="mt-0.5 text-xs font-bold text-emerald-700">{formatPayrollMoney(commission)} عمولة</p></div></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-cyan-200 bg-cyan-50/40 p-6 text-center text-sm font-bold text-cyan-800">لم تتم إضافة متابعين بعد.</div>}<div className="flex items-center gap-2 text-xs font-semibold text-cyan-800"><Save className="h-4 w-4" />تُحسب العمولة من الزيارات التي تحمل اسم متابع العملاء.</div></div></section>
    <section className="soft-card overflow-hidden print:hidden"><div className="border-b border-teal-950/6 bg-gradient-to-l from-teal-50 to-white p-3 sm:p-4"><div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-700 text-white shadow-lg shadow-teal-700/20"><UserPlus className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-teal-950">الفنيون وإعدادات الاستحقاق</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">أضف الفني مرة واحدة، ثم حدد راتبه ونسبة عمولة التركيبات والصيانة. هذه الإعدادات لا تعني أن المبلغ دُفع.</p></div></div></div><div className="space-y-3 p-3 sm:p-4"><div className="flex flex-col gap-2 rounded-2xl bg-slate-50 p-3 sm:flex-row"><input className="field-input flex-1 bg-white" value={technicianNameDraft} onChange={event => setTechnicianNameDraft(event.target.value)} placeholder="اكتب اسم الفني لإضافته" aria-label="اسم الفني الجديد" /><Button type="button" onClick={addTechnician} className="h-11 rounded-xl bg-teal-700 hover:bg-teal-800"><UserPlus className="ml-2 h-4 w-4" />إضافة فني</Button></div>{Object.keys(settings.technicianPayroll).length ? <div className="grid gap-2 md:grid-cols-2">{Object.entries(settings.technicianPayroll).map(([name, profile]) => <article key={name} className="rounded-xl border border-teal-200/70 bg-gradient-to-br from-white via-white to-teal-50/70 p-2.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className="mb-2 flex items-center justify-between gap-2"><div className="min-w-0"><p className="text-[11px] font-bold text-muted-foreground">بيانات الفني</p><h3 className="truncate text-base font-black text-teal-950">{name}</h3></div><Button type="button" variant="ghost" className="h-8 rounded-lg px-2 text-xs font-bold text-rose-700 hover:bg-rose-50 hover:text-rose-800" onClick={() => removeTechnician(name)}>حذف</Button></div><label className="mb-2 block"><span className="field-label">هاتف الفني</span><input type="tel" dir="ltr" className="field-input mt-1 h-9 text-sm" value={profile.phone ?? ""} placeholder="01xxxxxxxxx" onChange={event => updateTechnician(name, "phone", event.target.value)} /></label><div className="grid gap-2 sm:grid-cols-3"><label className="rounded-lg bg-indigo-50/70 p-1.5"><span className="field-label text-indigo-900">الراتب الشهري</span><input type="number" min="0" step="0.01" className="field-input mt-1 h-9 text-sm" value={profile.monthlySalary.toString()} onChange={event => updateTechnician(name, "monthlySalary", Math.round(Number(event.target.value || 0)))} /></label><label className="rounded-lg bg-cyan-50/70 p-1.5"><span className="field-label text-cyan-900">تركيبات %</span><input type="number" min="0" max="100" step="0.01" className="field-input mt-1 h-9 text-sm" value={profile.installationPercent} onChange={event => updateTechnician(name, "installationPercent", Number(event.target.value))} /></label><label className="rounded-lg bg-amber-50/80 p-1.5"><span className="field-label text-amber-900">صيانة %</span><input type="number" min="0" max="100" step="0.01" className="field-input mt-1 h-9 text-sm" value={profile.maintenancePercent} onChange={event => updateTechnician(name, "maintenancePercent", Number(event.target.value))} /></label></div></article>)}</div> : <div className="rounded-2xl border border-dashed border-teal-200 bg-teal-50/40 p-6 text-center text-sm font-bold text-teal-800">لم تتم إضافة فنيين بعد. ابدأ بإضافة أول فني من الحقل أعلاه.</div>}<div className="flex items-center gap-2 text-xs font-semibold text-teal-800"><Save className="h-4 w-4" />يتم حفظ كل تعديل تلقائيًا على هذا الجهاز.</div></div></section>
    <section className="soft-card grid gap-2 p-3 sm:grid-cols-2 sm:p-4 print:hidden"><label><span className="field-label">الشهر</span><input type="month" className="field-input mt-1" value={month} onChange={event => setMonth(event.target.value)} /></label><label><span className="field-label">الفني</span><select className="field-input mt-1" value={technician} onChange={event => setTechnician(event.target.value)}><option value="all">كل الفنيين</option>{technicians.map(name => <option key={name} value={name}>{name}</option>)}</select></label><div className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900 sm:col-span-2">الفترة: <span dir="ltr">{bounds.from} — {bounds.to}</span></div></section>
    <section className="soft-card overflow-hidden border-cyan-200/70 print:hidden"><div className="border-b border-cyan-950/6 bg-gradient-to-l from-cyan-50 via-white to-teal-50 p-3 sm:p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold text-cyan-700">لوحة متابعة شهرية</p><h2 className="mt-1 text-xl font-black text-cyan-950">إجمالي العمولات المستحقة</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">الفترة المحددة: <span dir="ltr">{bounds.from} — {bounds.to}</span></p></div><div className="rounded-2xl bg-cyan-700 px-4 py-3 text-center text-white"><p className="text-[11px] font-bold text-cyan-100">إجمالي عمولات الشهر</p><p className="mt-1 text-2xl font-black">{formatPayrollMoney(technicianCommissionTotal + salesCommissionTotal)}</p></div></div></div><div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4"><article className="rounded-2xl border border-teal-100 bg-teal-50/70 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold text-teal-800">عمولات الفنيين</p><p className="mt-1 text-2xl font-black text-teal-950">{formatPayrollMoney(technicianCommissionTotal)}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-teal-800">{selected.length.toLocaleString("ar-SA")} فني</span></div><div className="mt-3 space-y-1.5">{selected.filter(row => row.transactions.some(item => item.category.includes("عمولة"))).map(row => <div key={`commission-${row.technician}`} className="flex items-center justify-between gap-2 border-b border-teal-950/6 pb-1.5 text-sm"><span className="font-bold text-teal-900">{row.technician}</span><span className="font-black text-teal-700">{formatPayrollMoney(row.transactions.filter(item => item.category.includes("عمولة")).reduce((sum, item) => sum + item.amount, 0))}</span></div>)}{technicianCommissionTotal === 0 ? <p className="text-xs font-semibold text-muted-foreground">لا توجد عمولات فنيين مسجلة في هذا الشهر.</p> : null}</div></article><article className="rounded-2xl border border-cyan-100 bg-cyan-50/70 p-3"><div className="flex items-center justify-between gap-2"><div><p className="text-xs font-bold text-cyan-800">عمولات متابعي العملاء</p><p className="mt-1 text-2xl font-black text-cyan-950">{formatPayrollMoney(salesCommissionTotal)}</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-cyan-800">{salesAgentRows.length.toLocaleString("ar-SA")} متابع</span></div><div className="mt-3 space-y-1.5">{salesAgentRows.filter(row => row.commission > 0).map(row => <div key={`sales-commission-${row.name}`} className="flex items-center justify-between gap-2 border-b border-cyan-950/6 pb-1.5 text-sm"><span className="font-bold text-cyan-900">{row.name}</span><span className="font-black text-cyan-700">{formatPayrollMoney(row.commission)}</span></div>)}{salesCommissionTotal === 0 ? <p className="text-xs font-semibold text-muted-foreground">لا توجد عمولات متابعة مستحقة في هذا الشهر.</p> : null}</div></article></div></section>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><SummaryCard label="عدد الفنيين" value={selected.length.toLocaleString("ar-SA")} tone="text-sky-950 bg-sky-50 border-sky-100" /><SummaryCard label="إجمالي المستحق" value={formatPayrollMoney(totals.required)} tone="text-indigo-950 bg-indigo-50 border-indigo-100" /><SummaryCard label="إجمالي المدفوع" value={formatPayrollMoney(totals.paid)} tone="text-emerald-950 bg-emerald-50 border-emerald-100" /><SummaryCard label="إجمالي المتبقي" value={formatPayrollMoney(totals.remaining)} tone="text-amber-950 bg-amber-50 border-amber-100" /></section>
    <section className="soft-card overflow-hidden p-3 sm:p-4"><div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-lg font-black text-teal-950">ملخص الفنيين</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">المستحق يشمل الراتب والعمولات، والمدفوع يأتي من حركات الخزينة فقط.</p></div><WalletCards className="h-6 w-6 shrink-0 text-teal-700" /></div><div className="grid gap-3 md:hidden">{selected.length ? selected.map(row => <article key={`mobile-${row.technician}`} className="rounded-xl border border-teal-100 bg-gradient-to-br from-white to-teal-50/60 p-2.5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-black text-teal-950">{row.technician}</h3><span className={row.status === "paid" ? "mt-1 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-black text-emerald-800" : "mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800"}>{row.status === "paid" ? "تمت التسوية" : "متبقي"}</span></div><Button type="button" className="h-8 rounded-lg bg-teal-700 px-2.5 text-[11px] font-bold hover:bg-teal-800" onClick={() => { setPaymentTechnician(row.technician); setPaymentOpen(true); }}>تسجيل دفعة</Button></div><div className="mt-2 grid grid-cols-3 gap-1 text-center"><div className="rounded-lg bg-indigo-50 p-1.5"><p className="text-[10px] font-bold text-indigo-800">المستحق</p><p className="mt-0.5 text-xs font-black text-indigo-950">{formatPayrollMoney(row.required)}</p></div><div className="rounded-lg bg-emerald-50 p-1.5"><p className="text-[10px] font-bold text-emerald-800">المدفوع</p><p className="mt-0.5 text-xs font-black text-emerald-950">{formatPayrollMoney(row.paid)}</p></div><div className="rounded-lg bg-amber-50 p-1.5"><p className="text-[10px] font-bold text-amber-800">المتبقي</p><p className="mt-0.5 text-xs font-black text-amber-950">{formatPayrollMoney(row.remaining)}</p></div></div><p className="mt-2 text-[11px] font-semibold text-muted-foreground">عدد العمليات: {row.transactions.length}</p></article>) : <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-muted-foreground">لا توجد عمليات رواتب في هذا الشهر.</div>}</div><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-right text-sm"><thead className="rounded-xl bg-teal-50 text-xs font-bold text-teal-950"><tr><th className="px-3 py-3">الفني</th><th className="px-3 py-3">الحالة</th><th className="px-3 py-3">المستحق</th><th className="px-3 py-3">المدفوع</th><th className="px-3 py-3">المتبقي</th><th className="px-3 py-3">العمليات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{selected.length ? selected.map(row => <tr key={row.technician} className="transition hover:bg-teal-50/40"><td className="px-3 py-4 font-black text-teal-950">{row.technician}</td><td className="px-3 py-4"><span className={row.status === "paid" ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800" : "inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800"}>{row.status === "paid" ? "مدفوع" : "متبقي"}</span></td><td className="px-3 py-4 font-bold">{formatPayrollMoney(row.required)}</td><td className="px-3 py-4 font-black text-teal-800">{formatPayrollMoney(row.paid)}</td><td className="px-3 py-4 font-black text-amber-700">{formatPayrollMoney(row.remaining)}</td><td className="px-3 py-4"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-muted-foreground">{row.transactions.length}</span><Button type="button" className="h-8 rounded-lg bg-teal-700 px-2.5 text-xs font-bold hover:bg-teal-800" onClick={() => { setPaymentTechnician(row.technician); setPaymentOpen(true); }}>تسجيل دفعة</Button></div></td></tr>) : <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">لا توجد عمليات رواتب في هذا الشهر.</td></tr>}</tbody></table></div></section>
    {paymentOpen ? <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-labelledby="technician-payment-title"><div className="w-full max-w-lg rounded-3xl bg-white p-5 shadow-2xl sm:p-6"><div className="mb-5 flex items-start justify-between gap-3"><div><p className="text-xs font-bold text-teal-700">دفعة مالية موحدة</p><h2 id="technician-payment-title" className="mt-1 text-xl font-black text-teal-950">مبلغ مستلم للفني: {paymentTechnician}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">سيُخصم من حساب راتبه ويظهر كمصروف واحد في الخزنة. لا تسجله مرة أخرى من شاشة الخزنة.</p></div><Button type="button" variant="ghost" className="rounded-xl" onClick={() => setPaymentOpen(false)}>إغلاق</Button></div><form className="grid gap-4" onSubmit={event => { event.preventDefault(); const amount = Math.round(Number(paymentAmount)); if (!amount || amount <= 0) { toast.error("اكتب مبلغًا صحيحًا"); return; } createTechnicianPayment.mutate({ transactionType: "expense", amount, category: "دفعة راتب فني", transactionDate: new Date(paymentDate), recipientName: paymentTechnician, notes: paymentNotes || "دفعة من حساب راتب الفني" }); }}><label><span className="field-label">المبلغ</span><input autoFocus type="number" min="0" step="1" inputMode="numeric" required className="field-input mt-1" value={paymentAmount} onChange={event => setPaymentAmount(event.target.value)} placeholder="مثال: 500" /></label><label><span className="field-label">التاريخ والوقت</span><input type="datetime-local" required className="field-input mt-1" value={paymentDate} onChange={event => setPaymentDate(event.target.value)} /></label><label><span className="field-label">ملاحظات اختيارية</span><textarea className="field-textarea mt-1" value={paymentNotes} onChange={event => setPaymentNotes(event.target.value)} placeholder="مثال: دفعة أسبوعية" /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" className="rounded-xl" onClick={() => setPaymentOpen(false)}>إلغاء</Button><Button type="submit" disabled={createTechnicianPayment.isPending} className="rounded-xl bg-teal-700 font-bold hover:bg-teal-800">{createTechnicianPayment.isPending ? "جارٍ الحفظ…" : "حفظ الدفعة وخصمها"}</Button></div></form></div></div> : null}
    <section className="soft-card overflow-hidden p-3 sm:p-4"><div className="mb-3 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700"><FileText className="h-5 w-5" /></div><div><h2 className="text-lg font-black text-teal-950">تفاصيل العمليات</h2><p className="mt-1 text-xs leading-6 text-muted-foreground">كل بند مستحق أو مدفوع مسجل للفني خلال الفترة المحددة.</p></div></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-slate-50 text-xs font-bold text-slate-700"><tr><th className="px-3 py-3">التاريخ</th><th className="px-3 py-3">الفني</th><th className="px-3 py-3">التصنيف</th><th className="px-3 py-3">المبلغ</th><th className="px-3 py-3">الملاحظات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{selected.flatMap(row => row.transactions.map(item => <tr key={item.id + "-" + item.category} className="transition hover:bg-slate-50"><td className="px-3 py-3">{dateLabel(item.transactionDate)}</td><td className="px-3 py-3 font-bold">{row.technician}</td><td className="px-3 py-3">{item.category}</td><td className={item.category === dueCategory ? "px-3 py-3 font-black text-indigo-700" : "px-3 py-3 font-black text-emerald-700"}>{formatPayrollMoney(item.amount)}</td><td className="max-w-xs truncate px-3 py-3 text-muted-foreground">{item.notes || "—"}</td></tr>))}{!selected.some(row => row.transactions.length) ? <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">لا توجد تفاصيل لعرضها.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
function SummaryCard({ label, value, tone }: { label: string; value: string; tone: string }) { return <article className={`rounded-2xl border p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}><p className="text-sm font-bold opacity-80">{label}</p><p className="mt-3 text-2xl font-black tracking-tight">{value}</p></article>; }
