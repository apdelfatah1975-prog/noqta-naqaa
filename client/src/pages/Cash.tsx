import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatDate, toDateTimeLocal } from "@/lib/filterUi";
import { countActiveCashFilters } from "@/lib/cashUi";
import { ArrowDownRight, ArrowUpLeft, CircleDollarSign, Plus, ReceiptText, Search, SlidersHorizontal, WalletCards, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { moveToTrash } from "@/lib/trashBin";
import { formatAppMoney } from "@/lib/appSettings";
import { extractArray } from "@/lib/dataNormalization";

type Currency = "SAR";
type IncomeFilter = "all" | "service" | "installation" | "maintenance";
type PartyTypeFilter = "all" | "technician" | "customer" | "entity";
type DateFilterMode = "all" | "month" | "day" | "range";
// العملة موحدة داخليًا للحسابات، لكن واجهة الخزينة تعرض المبلغ كرقم فقط.
const formatMoney = (amount: number, _currency: Currency = "SAR") => formatAppMoney(amount);

function filterCashLocally(source: any, filters: { incomeFilter: IncomeFilter; category?: string; technician?: string; partyType: PartyTypeFilter; itemName?: string; month?: string; startDate?: string; endDate?: string; search?: string }) {
  if (!source) return source;
  const normalize = (value: unknown) => String(value ?? "").trim().toLocaleLowerCase("ar");
  const searchTerm = normalize(filters.search);
  const transactions = extractArray<any>(source.transactions).filter((transaction: any) => {
    const type = transaction.transactionType;
    const category = String(transaction.category ?? "");
    const recipient = String(transaction.recipientName ?? "");
    const date = new Date(transaction.transactionDate);
    const dateKey = Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
    const partyType = normalize(recipient).includes("فني") || normalize(category).includes("فني") ? "technician" : recipient ? "entity" : "customer";
    const incomeMatch = filters.incomeFilter === "all" || (filters.incomeFilter === "service" && type === "income" && (category.includes("تركيب") || category.includes("صيانة"))) || (filters.incomeFilter === "installation" && type === "income" && category.includes("تركيب")) || (filters.incomeFilter === "maintenance" && type === "income" && category.includes("صيانة"));
    const dateMatch = filters.month ? dateKey.startsWith(filters.month) : ((!filters.startDate || dateKey >= filters.startDate) && (!filters.endDate || dateKey <= filters.endDate));
    const searchMatch = !searchTerm || [category, recipient, transaction.notes].some(value => normalize(value).includes(searchTerm));
    return incomeMatch && (!filters.category || category === filters.category) && (!filters.technician || normalize(recipient) === normalize(filters.technician)) && (filters.partyType === "all" || partyType === filters.partyType) && (!filters.itemName || category.includes(filters.itemName) || normalize(transaction.notes).includes(normalize(filters.itemName))) && dateMatch && searchMatch;
  });
  const incomeTotal = transactions.filter((item: any) => item.transactionType === "income").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  const expenseTotal = transactions.filter((item: any) => item.transactionType === "expense").reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);
  return { ...source, transactions, incomeTotal, expenseTotal, balance: incomeTotal - expenseTotal, summaries: { ...source.summaries, SAR: { ...(source.summaries?.SAR ?? {}), incomeTotal, expenseTotal, balance: incomeTotal - expenseTotal } } };
}

export default function Cash() {
  const [location] = useLocation();
  const [incomeFilter, setIncomeFilter] = useState<IncomeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [partyTypeFilter, setPartyTypeFilter] = useState<PartyTypeFilter>("all");
  const [itemNameFilter, setItemNameFilter] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const cashQueryInput = useMemo(() => ({ incomeFilter, category: categoryFilter || undefined, technician: technicianFilter || undefined, partyType: partyTypeFilter, itemName: itemNameFilter || undefined, month: dateFilterMode === "month" ? selectedMonth || undefined : undefined, startDate: dateFilterMode === "range" ? startDate || undefined : undefined, endDate: dateFilterMode === "day" ? endDate || undefined : dateFilterMode === "range" ? endDate || undefined : undefined, search: search.trim() || undefined }), [incomeFilter, categoryFilter, technicianFilter, partyTypeFilter, itemNameFilter, dateFilterMode, selectedMonth, startDate, endDate, search]);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
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
  const cashQuery = trpc.filters.cash.summary.useQuery(cashQueryInput, { retry: false, staleTime: 5_000, refetchInterval: 8_000, refetchOnReconnect: true, refetchOnWindowFocus: false, networkMode: "online" });
  const emptyCash = {
    summaries: { SAR: { incomeTotal: 0, expenseTotal: 0, balance: 0 } },
    transactions: [],
    breakdown: { SAR: { income: [], expense: [], analytics: { installationIncome: 0, serviceIncome: 0, expenseByCategory: [], technicianExpenses: [] } } },
    purchases: { SAR: { total: 0, items: [] } },
    financialOverview: { technicianPaymentsByName: [] },
    incomeTotal: 0,
    expenseTotal: 0,
    balance: 0,
    historicalBalance: 0,
    historicalIncomeTotal: 0,
    historicalExpenseTotal: 0,
    incomeFilter: "all",
    categoryFilter: {},
    availableCategories: [],
    availableTechnicians: [],
    availablePartyTypes: ["technician", "customer", "entity"],
    availableItemNames: [],
    search: "",
  } as unknown as NonNullable<typeof cashQuery.data>;
  const data = cashQuery.data ?? emptyCash;
  const safeTransactions = extractArray<any>((data as any)?.transactions);
  const safeAvailableCategories = extractArray<string>((data as any)?.availableCategories);
  const safeAvailableTechnicians = extractArray<string>((data as any)?.availableTechnicians);
  const safeAvailableItemNames = extractArray<string>((data as any)?.availableItemNames);
  const isLoading = cashQuery.isLoading && !cashQuery.data;
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense");

  useEffect(() => {
    const entry = new URLSearchParams(location.split("?")[1] ?? "").get("entry");
    if (entry === "expense") {
      setTransactionType("expense");
      setOpen(true);
    }
  }, [location]);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [transactionDate, setTransactionDate] = useState(toDateTimeLocal());
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [cashErrors, setCashErrors] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const clearCashError = (field: string) => setCashErrors(current => {
    if (!current[field]) return current;
    const next = { ...current };
    delete next[field];
    return next;
  });
  const validateCashForm = () => {
    const next: Record<string, string> = {};
    if (!amount.trim() || Number(amount) <= 0) next.amount = "المبلغ مطلوب ويجب أن يكون أكبر من صفر.";
    if (!category.trim()) next.category = "اختر تصنيف العملية.";
    if (!transactionDate.trim()) next.transactionDate = "التاريخ والوقت مطلوبان.";
    setCashErrors(next);
    const firstInvalid = Object.keys(next)[0];
    if (firstInvalid) document.getElementById(`cash-${firstInvalid}`)?.focus();
    return Object.keys(next).length === 0;
  };

  const FieldError = ({ field }: { field: string }) => cashErrors[field] ? <p id={`cash-${field}-error`} role="alert" className="mt-1 text-sm font-semibold text-red-600">{cashErrors[field]}</p> : null;

  const createTransaction = trpc.filters.cash.create.useMutation({
    onSuccess: () => {
      utils.filters.cash.summary.invalidate();
      utils.filters.dashboard.invalidate();
      toast.success(transactionType === "income" ? "تم تسجيل الإيراد" : "تم تسجيل المصروف");
      setOpen(false); setAmount(""); setCategory(""); setRecipientName(""); setNotes("");
    },
    onError: error => toast.error(error.message || "تعذر حفظ العملية المالية. حاول مرة أخرى."),
  });

  const deleteTransaction = trpc.filters.cash.delete.useMutation({ onSuccess: () => { utils.filters.cash.summary.invalidate(); utils.filters.dashboard.invalidate(); setDeleteId(null); toast.success("تم حذف العملية المالية"); }, onError: error => toast.error(error.message || "تعذر حذف العملية المالية.") });

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!validateCashForm()) return;
    const input = {
      transactionType,
      currency: "SAR" as const,
      amount: Math.round(Number(amount) || 0),
      category,
      transactionDate: new Date(transactionDate),
      recipientName: recipientName || null,
      notes: notes || null,
    };
    if (!online) {
      toast.error("حفظ العملية المالية يحتاج اتصالًا مباشرًا بقاعدة البيانات المركزية.");
      return;
    }
    createTransaction.mutate(input);
  }

  const summaries = data.summaries ?? { SAR: { incomeTotal: data.incomeTotal ?? 0, expenseTotal: data.expenseTotal ?? 0, balance: data.balance ?? 0 } };
  const emptyAnalytics = { installationIncome: 0, serviceIncome: 0, expenseByCategory: [], technicianExpenses: [] };
  const breakdown = data.breakdown ?? { SAR: { income: [], expense: [], analytics: emptyAnalytics } };
  const purchases = data.purchases ?? { SAR: { total: 0, items: [] } };
  const summaryCards = (Object.entries(summaries) as Array<[Currency, typeof summaries.SAR]>).flatMap(([cardCurrency, summary]) => [
    { label: "إجمالي الإيرادات", amount: summary.incomeTotal, currency: cardCurrency, icon: ArrowDownRight, tone: "bg-teal-50 text-teal-800" },
    { label: "إجمالي المصروفات", amount: summary.expenseTotal, currency: cardCurrency, icon: ArrowUpLeft, tone: "bg-amber-50 text-amber-800" },
    { label: dateFilterMode === "day" && endDate ? "الرصيد حتى نهاية اليوم" : "رصيد الخزينة", amount: dateFilterMode === "day" && endDate ? (data.historicalBalance ?? summary.balance) : summary.balance, currency: cardCurrency, icon: WalletCards, tone: "bg-slate-950 text-white" },
  ]);

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><h1 className="page-heading">الخزينة</h1><p className="page-subheading">الإيرادات والمصروفات والرصيد في مكان واحد.</p></div>
      <div className="flex flex-wrap gap-2"><Button onClick={() => { setTransactionType("income"); setOpen(true); }} className="h-11 rounded-xl bg-teal-700 px-4 font-bold hover:bg-teal-800"><ArrowDownRight className="ml-2 h-5 w-5" />تسجيل إيراد</Button><Button onClick={() => { setTransactionType("expense"); setOpen(true); }} className="h-11 rounded-xl bg-amber-600 px-4 font-bold text-white hover:bg-amber-700"><ArrowUpLeft className="ml-2 h-5 w-5" />تسجيل مصروف</Button></div>
    </div>

    <section className="grid gap-2 sm:grid-cols-3">
      {summaryCards.map(card => <article key={`${card.currency}-${card.label}`} className={`rounded-xl p-3 shadow-sm ${card.tone}`}><div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70"><card.icon className="h-4 w-4 opacity-80" /></span><div className="min-w-0"><p className="truncate text-xs font-bold opacity-80">{card.label}</p><p className="mt-1 text-base font-extrabold tracking-tight">{formatMoney(card.amount, card.currency)}</p></div></div></article>)}
    </section>

    <details className="soft-card group">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 font-extrabold text-teal-950"><span>تفاصيل اختيارية</span><span className="text-sm font-bold text-muted-foreground group-open:hidden">عرض التجميع والرواتب</span><span className="hidden text-sm font-bold text-muted-foreground group-open:inline">إخفاء التفاصيل</span></summary>
      <div className="space-y-5 border-t border-teal-950/6 p-5">
        <section>
          <div className="mb-5 flex items-center justify-between"><div><h2 className="font-extrabold">التجميع حسب البند</h2><p className="mt-1 text-xs text-muted-foreground">تفاصيل اختيارية لإجمالي التركيبات والصيانة والبنزين وغيرها.</p></div><CircleDollarSign className="h-5 w-5 text-teal-700" /></div>
          <div className="grid gap-5 lg:grid-cols-2">{(["SAR"] as Currency[]).map(cardCurrency => <div key={cardCurrency} className="rounded-2xl border border-teal-950/8 bg-teal-50/30 p-4"><h3 className="font-extrabold text-teal-950">ملخص العمليات</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><BreakdownList title="الإيرادات" rows={breakdown[cardCurrency].income} currency={cardCurrency} tone="text-teal-700" empty="لا توجد إيرادات مسجلة." /><BreakdownList title="المصروفات" rows={breakdown[cardCurrency].expense} currency={cardCurrency} tone="text-amber-700" empty="لا توجد مصروفات مسجلة." /></div></div>)}</div>
        </section>
        <TechnicianPaymentsPanel rows={data.financialOverview?.technicianPaymentsByName ?? []} />
      </div>
    </details>

    <section className="soft-card overflow-hidden">
      <div className="border-b border-teal-950/6 p-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-extrabold">العمليات الأخيرة</h2><p className="mt-1 text-xs text-muted-foreground">آخر الإيرادات والمصروفات. عند اختيار يوم محدد يظهر الرصيد المتراكم حتى نهاية ذلك اليوم.</p></div><div className="flex w-full flex-wrap items-center gap-2 lg:w-auto"><label className="relative min-w-0 flex-1 lg:w-72 lg:flex-none"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-700/60" /><span className="sr-only">البحث في العمليات</span><input aria-label="البحث باسم العميل أو الملاحظات" className="field-input h-10 w-full rounded-xl pr-9" placeholder="ابحث باسم العميل أو الملاحظات" value={search} onChange={event => setSearch(event.target.value)} /></label><label className="min-w-0 flex-1 sm:flex-none"><span className="sr-only">تصفية الإيرادات</span><select className="field-input h-10 w-full rounded-xl sm:min-w-48" value={incomeFilter} onChange={event => setIncomeFilter(event.target.value as IncomeFilter)}><option value="all">كل العمليات</option><option value="installation">إيرادات التركيبات فقط</option><option value="maintenance">إيرادات الصيانة فقط</option><option value="service">إيرادات التركيبات والصيانة</option></select></label><Button type="button" variant="outline" className="h-10 shrink-0 rounded-xl border-teal-200 bg-white px-3 text-teal-900" onClick={() => setShowAdvancedFilters(current => !current)} aria-expanded={showAdvancedFilters} aria-controls="cash-advanced-filters"><SlidersHorizontal className="ml-2 h-4 w-4" />تصفية إضافية{countActiveCashFilters({ category: categoryFilter, partyType: partyTypeFilter, technician: technicianFilter, itemName: itemNameFilter, dateMode: dateFilterMode }) > 0 ? <Badge className="mr-1 h-5 min-w-5 rounded-full bg-teal-700 px-1.5 text-[11px] text-white">{countActiveCashFilters({ category: categoryFilter, partyType: partyTypeFilter, technician: technicianFilter, itemName: itemNameFilter, dateMode: dateFilterMode })}</Badge> : null}</Button><ReceiptText className="hidden h-5 w-5 text-teal-700 sm:block" /></div></div>{showAdvancedFilters ? <div id="cash-advanced-filters" className="mt-4 grid gap-3 rounded-2xl bg-teal-50/55 p-3 sm:grid-cols-2 lg:grid-cols-4"><label><span className="sr-only">الفئة المالية</span><select aria-label="تصفية حسب الفئة المالية" className="field-input h-10 w-full rounded-xl" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">كل الفئات</option>{safeAvailableCategories.map((categoryOption: string) => <option key={categoryOption} value={categoryOption}>{categoryOption}</option>)}</select></label><label><span className="sr-only">نوع الطرف</span><select aria-label="تصفية حسب نوع الطرف" className="field-input h-10 w-full rounded-xl" value={partyTypeFilter} onChange={event => setPartyTypeFilter(event.target.value as PartyTypeFilter)}><option value="all">كل الأطراف</option><option value="technician">فني</option><option value="customer">عميل</option><option value="entity">جهة</option></select></label><label><span className="sr-only">الفني</span><select aria-label="تصفية حسب الفني" className="field-input h-10 w-full rounded-xl" value={technicianFilter} onChange={event => setTechnicianFilter(event.target.value)}><option value="">كل الفنيين</option>{safeAvailableTechnicians.map((technician: string) => <option key={technician} value={technician}>{technician}</option>)}</select></label><label><span className="sr-only">الصنف المشترى</span><select aria-label="تصفية حسب الصنف المشترى" className="field-input h-10 w-full rounded-xl" value={itemNameFilter} onChange={event => setItemNameFilter(event.target.value)}><option value="">كل الأصناف</option>{safeAvailableItemNames.map((itemName: string) => <option key={itemName} value={itemName}>{itemName}</option>)}</select></label><label><span className="sr-only">الفترة الزمنية</span><select aria-label="تصفية حسب الفترة الزمنية" className="field-input h-10 w-full rounded-xl" value={dateFilterMode} onChange={event => setDateFilterMode(event.target.value as DateFilterMode)}><option value="all">كل الفترات</option><option value="month">شهر محدد</option><option value="day">يوم محدد — الرصيد حتى نهاية اليوم</option><option value="range">فترة مخصصة</option></select></label>{dateFilterMode === "month" ? <input aria-label="اختيار الشهر" type="month" className="field-input h-10 rounded-xl" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} /> : null}{dateFilterMode === "day" ? <label><span className="sr-only">اليوم المطلوب</span><input aria-label="اليوم المطلوب" type="date" className="field-input h-10 rounded-xl" value={endDate} onChange={event => setEndDate(event.target.value)} /></label> : null}{dateFilterMode === "range" ? <><input aria-label="من تاريخ" type="date" className="field-input h-10 rounded-xl" value={startDate} onChange={event => setStartDate(event.target.value)} /><input aria-label="إلى تاريخ" type="date" className="field-input h-10 rounded-xl" value={endDate} onChange={event => setEndDate(event.target.value)} /></> : null}<Button type="button" variant="ghost" className="h-10 justify-center rounded-xl text-slate-600" onClick={() => { setCategoryFilter(""); setPartyTypeFilter("all"); setTechnicianFilter(""); setItemNameFilter(""); setDateFilterMode("all"); setSelectedMonth(""); setStartDate(""); setEndDate(""); }}><X className="ml-2 h-4 w-4" />مسح الفلاتر الإضافية</Button></div> : null}</div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-right"><thead className="bg-teal-50/45 text-xs text-teal-950/65"><tr><th className="px-5 py-3 font-bold">التاريخ</th><th className="px-5 py-3 font-bold">النوع</th><th className="px-5 py-3 font-bold">التصنيف</th><th className="px-5 py-3 font-bold">المبلغ</th><th className="px-5 py-3 font-bold">الفني / الجهة</th><th className="px-5 py-3 font-bold">ملاحظات</th><th className="px-5 py-3 font-bold">إجراء</th></tr></thead><tbody className="divide-y divide-teal-950/6">{safeTransactions.length ? safeTransactions.map((transaction: CashTransaction) => <CashTableRow key={transaction.id} transaction={transaction} onDelete={() => setDeleteId(transaction.id)} />) : <EmptyCashRow isLoading={isLoading} />}</tbody></table></div>
      <div className="divide-y divide-teal-950/6 md:hidden">{safeTransactions.length ? safeTransactions.map((transaction: CashTransaction) => <CashCard key={transaction.id} transaction={transaction} onDelete={() => setDeleteId(transaction.id)} />) : <div className="p-12 text-center text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل الخزينة…" : "لا توجد عمليات مالية حتى الآن."}</div>}</div>
    </section>

    <PinVerificationDialog open={deleteId !== null} onOpenChange={openState => { if (!openState) setDeleteId(null); }} busy={deleteTransaction.isPending} title="تأكيد حذف العملية المالية" description="سيتم حذف العملية نهائيًا من سجل الخزينة، وقد يؤثر ذلك في الملخصات." onConfirm={pin => { if (deleteId === null) return; if (!online) { toast.error("حذف العملية المالية يحتاج اتصالًا مباشرًا بقاعدة البيانات المركزية."); return; } const transaction = safeTransactions.find((item: CashTransaction) => item.id === deleteId); if (transaction) moveToTrash({ entityType: "cash", entityLabel: `عملية خزينة: ${transaction.category}`, payload: transaction }); deleteTransaction.mutate({ id: deleteId, pin }); }} />
    <Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl" className="flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col overflow-hidden sm:max-w-2xl"><DialogHeader className="shrink-0"><DialogTitle>تسجيل عملية مالية</DialogTitle></DialogHeader><form onSubmit={submit} className="min-h-0 flex-1 grid gap-4 overflow-y-auto overscroll-contain py-2 pl-1 pr-1 sm:grid-cols-2"><label><span className="field-label">نوع العملية</span><select className="field-input" value={transactionType} onChange={event => setTransactionType(event.target.value as "income" | "expense")}><option value="expense">مصروف</option><option value="income">إيراد</option></select></label><label><span className="field-label">المبلغ</span><input id="cash-amount" type="number" min="0" step="1" inputMode="numeric" className="field-input" value={amount} onChange={event => { setAmount(event.target.value); clearCashError("amount"); }} aria-invalid={Boolean(cashErrors.amount)} aria-describedby={cashErrors.amount ? "cash-amount-error" : undefined} required placeholder="مثال: 250" /><FieldError field="amount" /></label><label><span className="field-label">التصنيف</span><select id="cash-category" className="field-input" value={category} onChange={event => { setCategory(event.target.value); clearCashError("category"); }} aria-invalid={Boolean(cashErrors.category)} aria-describedby={cashErrors.category ? "cash-category-error" : undefined} required><option value="">اختر التصنيف</option>{transactionType === "income" ? <><option value="تحصيل تركيب">تحصيل تركيب</option><option value="تحصيل صيانة">تحصيل صيانة</option><option value="تحصيل تغيير شمعات">تحصيل تغيير شمعات</option><option value="نقدية خارج إيرادات العمل">نقدية خارج إيرادات العمل</option></> : <><option value="راتب فني">راتب فني</option><option value="مستحق فني">مستحق فني</option><option value="سلفة فني">سلفة فني</option><option value="بنزين">بنزين</option><option value="شراء بضاعة">شراء بضاعة</option><option value="مصروف عام">مصروف عام</option></>}<option value="أخرى">أخرى</option></select><FieldError field="category" /></label><label><span className="field-label">التاريخ والوقت</span><input id="cash-transactionDate" type="datetime-local" className="field-input" value={transactionDate} onChange={event => { setTransactionDate(event.target.value); clearCashError("transactionDate"); }} aria-invalid={Boolean(cashErrors.transactionDate)} aria-describedby={cashErrors.transactionDate ? "cash-transactionDate-error" : undefined} required /><FieldError field="transactionDate" /></label><label><span className="field-label">الفني أو الجهة المستلمة</span><input className="field-input" value={recipientName} onChange={event => setRecipientName(event.target.value)} placeholder="اختياري" /></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={notes} onChange={event => setNotes(event.target.value)} placeholder="تفاصيل إضافية عن العملية" /></label><div className="sticky bottom-0 flex justify-end gap-3 bg-background/95 pt-2 backdrop-blur-sm sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createTransaction.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createTransaction.isPending ? "جارٍ الحفظ…" : "حفظ العملية"}</Button></div></form></DialogContent></Dialog>
  </div>;
}

type CashTransaction = { id: number; transactionType: "income" | "expense"; currency?: Currency | null; amount: number; category: string; transactionDate: Date; recipientName: string | null; notes: string | null };
function TransactionBadge({ type }: { type: CashTransaction["transactionType"] }) { return <Badge className={type === "income" ? "bg-teal-100 text-teal-800 hover:bg-teal-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>{type === "income" ? "إيراد" : "مصروف"}</Badge>; }
function CashTableRow({ transaction, onDelete }: { transaction: CashTransaction; onDelete: () => void }) { const transactionCurrency: Currency = "SAR"; return <tr><td className="px-5 py-4 text-sm">{formatDate(transaction.transactionDate)}</td><td className="px-5 py-4"><TransactionBadge type={transaction.transactionType} /></td><td className="px-5 py-4 font-bold">{transaction.category}</td><td className={`px-5 py-4 font-extrabold ${transaction.transactionType === "income" ? "text-teal-700" : "text-amber-700"}`}>{transaction.transactionType === "income" ? "" : "−"}{formatMoney(transaction.amount, transactionCurrency)}</td><td className="px-5 py-4 text-sm">{transaction.recipientName || "—"}</td><td className="max-w-64 truncate px-5 py-4 text-sm text-muted-foreground">{transaction.notes || "—"}</td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={onDelete} className="rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50">حذف</Button></td></tr>; }
function CashCard({ transaction, onDelete }: { transaction: CashTransaction; onDelete: () => void }) { const transactionCurrency: Currency = "SAR"; return <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{transaction.category}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(transaction.transactionDate)}</p></div><TransactionBadge type={transaction.transactionType} /></div><p className={`mt-4 text-xl font-extrabold ${transaction.transactionType === "income" ? "text-teal-700" : "text-amber-700"}`}>{transaction.transactionType === "income" ? "" : "−"}{formatMoney(transaction.amount, transactionCurrency)}</p><div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-muted-foreground"><p>الفني / الجهة</p><p className="text-left text-teal-950">{transaction.recipientName || "—"}</p>{transaction.notes ? <><p>ملاحظات</p><p className="text-left text-teal-950">{transaction.notes}</p></> : null}</div><Button size="sm" variant="outline" onClick={onDelete} className="mt-4 w-full rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50">حذف العملية</Button></div>; }
function BreakdownList({ title, rows, currency, tone, empty }: { title: string; rows: Array<{ category: string; total: number }>; currency: Currency; tone: string; empty: string }) { return <div><h4 className={`text-sm font-extrabold ${tone}`}>{title}</h4><div className="mt-2 space-y-2">{rows.length ? rows.map(row => <div key={row.category} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"><span className="font-bold text-teal-950">{row.category}</span><span className={`font-extrabold ${tone}`}>{formatMoney(row.total, currency)}</span></div>) : <p className="rounded-xl bg-white/70 px-3 py-3 text-xs text-muted-foreground">{empty}</p>}</div></div>; }

type TechnicianPaymentRow = { technician: string; requiredAmount: number; totalPaid: number; salaryPaidAmount: number; remainingAmount: number; status: "paid" | "remaining"; transactionCount: number };
function TechnicianPaymentsPanel({ rows }: { rows: TechnicianPaymentRow[] }) {
  return <section className="soft-card p-5" aria-label="الراتب المدفوع لكل فني"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-extrabold">الراتب المدفوع لكل فني</h2><p className="mt-1 text-xs text-muted-foreground">يعرض راتب الفني المدفوع فعليًا فقط، ويتغير حسب الفترة والفلاتر المحددة في سجل العمليات.</p></div><Badge className="w-fit bg-teal-100 text-teal-800 hover:bg-teal-100">{rows.length} فني</Badge></div>{rows.length ? <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(row => <article key={row.technician} className="rounded-2xl border border-teal-950/8 bg-teal-50/35 p-4"><div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words font-extrabold leading-6 text-teal-950">{row.technician}</h3><Badge className={row.status === "paid" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>{row.status === "paid" ? "مدفوع" : "متبقي"}</Badge></div><div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-muted-foreground">المستحق</p><p className="mt-1 font-extrabold">{formatMoney(row.requiredAmount)}</p></div><div><p className="text-xs text-muted-foreground">إجمالي المدفوع فعليًا</p><p className="mt-1 font-extrabold text-teal-700">{formatMoney(row.totalPaid)}</p><p className="mt-1 text-[11px] text-teal-900/60">يشمل الراتب والسلف ومصروفات الفني</p></div><div className="col-span-2 border-t border-teal-950/8 pt-3"><p className="text-xs text-muted-foreground">المتبقي</p><p className={`mt-1 font-extrabold ${row.remainingAmount > 0 ? "text-amber-700" : "text-emerald-700"}`}>{formatMoney(row.remainingAmount)}</p></div></div></article>)}</div> : <div className="mt-4 rounded-xl bg-slate-50 px-4 py-5 text-center text-sm text-muted-foreground">لا توجد دفعات فنيين ضمن الفلاتر الحالية.</div>}</section>;
}

type CashAnalytics = { installationIncome: number; serviceIncome: number; expenseByCategory: Array<{ category: string; total: number }>; technicianExpenses: Array<{ technician: string; total: number }> };
type PurchaseSummary = { total: number; items: Array<{ itemName: string; quantity: number; total: number; averageUnitCost: number }> };
function PurchasePanel({ currency, purchase }: { currency: Currency; purchase: PurchaseSummary }) {
  return <div className="rounded-2xl border border-indigo-950/8 bg-indigo-50/30 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-indigo-950">المشتريات</h3><p className="mt-1 text-xs text-muted-foreground">إجمالي المشتريات</p></div><p className="text-xl font-extrabold text-indigo-700">{formatMoney(purchase.total, currency)}</p></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-right text-sm"><thead className="text-xs text-indigo-950/60"><tr><th className="px-2 py-2 font-bold">الصنف</th><th className="px-2 py-2 font-bold">الكمية</th><th className="px-2 py-2 font-bold">القيمة</th><th className="px-2 py-2 font-bold">متوسط الوحدة</th></tr></thead><tbody className="divide-y divide-indigo-950/8">{purchase.items.length ? purchase.items.map(item => <tr key={item.itemName}><td className="px-2 py-2 font-bold text-indigo-950">{item.itemName}</td><td className="px-2 py-2">{item.quantity}</td><td className="px-2 py-2 font-extrabold text-indigo-700">{formatMoney(item.total, currency)}</td><td className="px-2 py-2 text-indigo-950/75">{formatMoney(item.averageUnitCost, currency)}</td></tr>) : <tr><td colSpan={4} className="px-2 py-4 text-center text-xs text-muted-foreground">لا توجد مشتريات مسجلة.</td></tr>}</tbody></table></div></div>;
}
function AnalyticsPanel({ currency, analytics }: { currency: Currency; analytics: CashAnalytics }) {
  const chartData = [
    { name: "التركيبات", الإيرادات: analytics.installationIncome, المصروفات: 0 },
    { name: "الصيانة", الإيرادات: analytics.serviceIncome, المصروفات: 0 },
    ...analytics.expenseByCategory.slice(0, 6).map(row => ({ name: row.category, الإيرادات: 0, المصروفات: row.total })),
  ];
  return <div className="rounded-2xl border border-teal-950/8 bg-teal-50/30 p-4"><h3 className="font-extrabold text-teal-950">تحليل الإيرادات والمصروفات</h3><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white p-3"><p className="text-xs text-muted-foreground">وارد التركيبات</p><p className="mt-1 font-extrabold text-teal-700">{formatMoney(analytics.installationIncome, currency)}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-muted-foreground">وارد الصيانة</p><p className="mt-1 font-extrabold text-teal-700">{formatMoney(analytics.serviceIncome, currency)}</p></div></div><div className="mt-4 h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" opacity={0.25} /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={55} /><YAxis tick={{ fontSize: 11 }} tickFormatter={value => `${Math.round(value)}`} /><Tooltip formatter={(value: number, name: string) => [formatMoney(value, currency), name]} /><Legend /><Bar dataKey="الإيرادات" fill="#0f766e" radius={[6, 6, 0, 0]} /><Bar dataKey="المصروفات" fill="#d97706" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="mt-4 grid gap-4 md:grid-cols-2"><BreakdownList title="مصروفات حسب الفئة" rows={analytics.expenseByCategory} currency={currency} tone="text-amber-700" empty="لا توجد مصروفات." /><TechnicianList rows={analytics.technicianExpenses} currency={currency} /></div></div>;
}
function TechnicianList({ rows, currency }: { rows: Array<{ technician: string; total: number }>; currency: Currency }) { return <div><h4 className="text-sm font-extrabold text-indigo-700">مصروفات الفنيين</h4><div className="mt-2 space-y-2">{rows.length ? rows.map(row => <div key={row.technician} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"><span className="font-bold text-teal-950">{row.technician}</span><span className="font-extrabold text-indigo-700">{formatMoney(row.total, currency)}</span></div>) : <p className="rounded-xl bg-white/70 px-3 py-3 text-xs text-muted-foreground">لا توجد مصروفات مرتبطة بفني.</p>}</div></div>; }
function EmptyCashRow({ isLoading }: { isLoading: boolean }) { return <tr><td colSpan={8} className="p-14 text-center"><CircleDollarSign className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل الخزينة…" : "لا توجد عمليات مالية حتى الآن."}</p></td></tr>; }
