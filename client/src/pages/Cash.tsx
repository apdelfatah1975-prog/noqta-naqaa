import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PinVerificationDialog } from "@/components/PinVerificationDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatDate, toDateTimeLocal } from "@/lib/filterUi";
import { ArrowDownRight, ArrowUpLeft, CircleDollarSign, Plus, ReceiptText, Search, WalletCards } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { cacheOfflineCash, getOfflineCash, getOfflineSession, queueOfflineCash, queueOfflineDelete } from "@/lib/offlineSync";

type Currency = "SAR";
type IncomeFilter = "all" | "service" | "installation" | "maintenance";
type DateFilterMode = "all" | "month" | "range";
const currencyLabel = (_currency: Currency) => "ريال سعودي";
const currencyShortLabel = (_currency: Currency) => "ر.س";
const formatMoney = (amount: number, currency: Currency = "SAR") => new Intl.NumberFormat("ar-EG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);

export default function Cash() {
  const [location] = useLocation();
  const [incomeFilter, setIncomeFilter] = useState<IncomeFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [itemNameFilter, setItemNameFilter] = useState("");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [search, setSearch] = useState("");
  const cashQueryInput = useMemo(() => ({ incomeFilter, category: categoryFilter || undefined, technician: technicianFilter || undefined, itemName: itemNameFilter || undefined, month: dateFilterMode === "month" ? selectedMonth || undefined : undefined, startDate: dateFilterMode === "range" ? startDate || undefined : undefined, endDate: dateFilterMode === "range" ? endDate || undefined : undefined, search: search.trim() || undefined }), [incomeFilter, categoryFilter, technicianFilter, itemNameFilter, dateFilterMode, selectedMonth, startDate, endDate, search]);
  const owner = getOfflineSession();
  const cashQuery = trpc.filters.cash.summary.useQuery(cashQueryInput, { retry: false, staleTime: 60_000 });
  const cachedCash = getOfflineCash<typeof cashQuery.data>(owner?.id ?? 0);
  const emptyCash = {
    summaries: { SAR: { incomeTotal: 0, expenseTotal: 0, balance: 0 } },
    transactions: [],
    breakdown: { SAR: { income: [], expense: [], analytics: { installationIncome: 0, serviceIncome: 0, expenseByCategory: [], technicianExpenses: [] } } },
    purchases: { SAR: { total: 0, items: [] } },
    incomeTotal: 0,
    expenseTotal: 0,
    balance: 0,
    incomeFilter: "all",
    categoryFilter: {},
    availableCategories: [],
    availableTechnicians: [],
    availableItemNames: [],
    search: "",
  } as unknown as NonNullable<typeof cashQuery.data>;
  const data = cashQuery.data ?? cachedCash ?? emptyCash;
  const isLoading = cashQuery.isLoading && !cashQuery.data && !cachedCash;
  useEffect(() => {
    if (cashQuery.data && owner) cacheOfflineCash(owner.id, cashQuery.data);
  }, [cashQuery.data, owner]);
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
  const [deleteId, setDeleteId] = useState<number | null>(null);

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
    const input = {
      transactionType,
      currency: "SAR" as const,
      amount: Math.round(Number(amount) * 100),
      category,
      transactionDate: new Date(transactionDate),
      recipientName: recipientName || null,
      notes: notes || null,
    };
    if (!navigator.onLine && owner) {
      queueOfflineCash(owner.id, { ...input, transactionDate: input.transactionDate.toISOString() });
      const localTransaction = { ...input, id: -Date.now(), transactionDate: input.transactionDate.toISOString(), sourceVisitId: null, sourceInventoryMovementId: null, createdAt: new Date().toISOString() };
      const current = data as any;
      if (current) {
        const sign = transactionType === "income" ? 1 : -1;
        const currentSummary = current.summaries?.SAR ?? { incomeTotal: 0, expenseTotal: 0, balance: 0 };
        const nextSummary = { ...currentSummary, incomeTotal: currentSummary.incomeTotal + (transactionType === "income" ? input.amount : 0), expenseTotal: currentSummary.expenseTotal + (transactionType === "expense" ? input.amount : 0), balance: currentSummary.balance + sign * input.amount };
        cacheOfflineCash(owner.id, { ...current, transactions: [localTransaction, ...current.transactions], incomeTotal: nextSummary.incomeTotal, expenseTotal: nextSummary.expenseTotal, balance: nextSummary.balance, summaries: { ...current.summaries, SAR: nextSummary } });
      }
      toast.success("تم حفظ العملية محليًا وستتم مزامنتها عند عودة الإنترنت");
      setOpen(false); setAmount(""); setCategory(""); setRecipientName(""); setNotes("");
      return;
    }
    createTransaction.mutate(input);
  }

  const showingLocalData = Boolean(!cashQuery.data && cachedCash);


  const summaries = data.summaries ?? { SAR: { incomeTotal: data.incomeTotal ?? 0, expenseTotal: data.expenseTotal ?? 0, balance: data.balance ?? 0 } };
  const emptyAnalytics = { installationIncome: 0, serviceIncome: 0, expenseByCategory: [], technicianExpenses: [] };
  const breakdown = data.breakdown ?? { SAR: { income: [], expense: [], analytics: emptyAnalytics } };
  const purchases = data.purchases ?? { SAR: { total: 0, items: [] } };
  const summaryCards = (Object.entries(summaries) as Array<[Currency, typeof summaries.SAR]>).flatMap(([cardCurrency, summary]) => [
    { label: `إجمالي الإيرادات (${currencyLabel(cardCurrency)})`, amount: summary.incomeTotal, currency: cardCurrency, icon: ArrowDownRight, tone: "bg-teal-50 text-teal-800" },
    { label: `إجمالي المصروفات (${currencyLabel(cardCurrency)})`, amount: summary.expenseTotal, currency: cardCurrency, icon: ArrowUpLeft, tone: "bg-amber-50 text-amber-800" },
    { label: `رصيد الخزينة (${currencyLabel(cardCurrency)})`, amount: summary.balance, currency: cardCurrency, icon: WalletCards, tone: "bg-slate-950 text-white" },
  ]);

  return <div className="mx-auto max-w-7xl space-y-6">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><h1 className="page-heading">الخزينة والمصروفات</h1><p className="page-subheading">سجّل الإيرادات والمصروفات وراجع رصيد الخزينة بسهولة.</p></div>
      <Button onClick={() => setOpen(true)} className="h-11 rounded-xl bg-teal-700 px-5 font-bold hover:bg-teal-800"><Plus className="ml-2 h-5 w-5" />تسجيل عملية مالية</Button>
    </div>

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {summaryCards.map(card => <article key={`${card.currency}-${card.label}`} className={`rounded-2xl p-5 shadow-sm ${card.tone}`}><div className="flex items-center justify-between"><p className="text-sm font-bold opacity-80">{card.label}</p><card.icon className="h-5 w-5 opacity-80" /></div><p className="mt-4 text-2xl font-extrabold tracking-tight">{formatMoney(card.amount, card.currency)}</p></article>)}
    </section>

    <section className="soft-card p-5">
      <div className="mb-5 flex items-center justify-between"><div><h2 className="font-extrabold">التجميع حسب البند</h2><p className="mt-1 text-xs text-muted-foreground">اعرف إجمالي كل نوع إيراد أو مصروف، مثل التركيبات والصيانة والبنزين.</p></div><CircleDollarSign className="h-5 w-5 text-teal-700" /></div>
      <div className="grid gap-5 lg:grid-cols-2">{(["SAR"] as Currency[]).map(cardCurrency => <div key={cardCurrency} className="rounded-2xl border border-teal-950/8 bg-teal-50/30 p-4"><h3 className="font-extrabold text-teal-950">{currencyLabel(cardCurrency)}</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><BreakdownList title="الإيرادات" rows={breakdown[cardCurrency].income} currency={cardCurrency} tone="text-teal-700" empty="لا توجد إيرادات مسجلة." /><BreakdownList title="المصروفات" rows={breakdown[cardCurrency].expense} currency={cardCurrency} tone="text-amber-700" empty="لا توجد مصروفات مسجلة." /></div></div>)}</div>
    </section>

    <p className="rounded-2xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm font-bold leading-6 text-teal-900">للوصول السريع، استخدم فلاتر سجل العمليات لمعرفة إيرادات التركيبات والصيانة أو إجمالي أي بند ومبلغ ما استلمه كل فني، دون بطاقات تحليل إضافية.</p>

    <section className="soft-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-teal-950/6 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-extrabold">سجل العمليات</h2><p className="mt-1 text-xs text-muted-foreground">آخر الإيرادات والمصروفات المسجلة في الخزينة.</p></div><div className="flex flex-wrap items-center gap-2"><label className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-700/60" /><span className="sr-only">البحث في العمليات</span><input aria-label="البحث باسم العميل أو الملاحظات" className="field-input h-10 w-full min-w-56 rounded-xl pr-9" placeholder="ابحث باسم العميل أو الملاحظات" value={search} onChange={event => setSearch(event.target.value)} /></label><label><span className="sr-only">تصفية الإيرادات</span><select className="field-input h-10 min-w-48 rounded-xl" value={incomeFilter} onChange={event => setIncomeFilter(event.target.value as IncomeFilter)}><option value="all">كل العمليات</option><option value="installation">إيرادات التركيبات فقط</option><option value="maintenance">إيرادات الصيانة فقط</option><option value="service">إيرادات التركيبات والصيانة</option></select></label><label><span className="sr-only">الفئة المالية</span><select aria-label="تصفية حسب الفئة المالية" className="field-input h-10 min-w-44 rounded-xl" value={categoryFilter} onChange={event => setCategoryFilter(event.target.value)}><option value="">كل الفئات</option>{(data?.availableCategories ?? []).map(categoryOption => <option key={categoryOption} value={categoryOption}>{categoryOption}</option>)}</select></label><label><span className="sr-only">الفني</span><select aria-label="تصفية حسب الفني" className="field-input h-10 min-w-40 rounded-xl" value={technicianFilter} onChange={event => setTechnicianFilter(event.target.value)}><option value="">كل الفنيين</option>{(data?.availableTechnicians ?? []).map(technician => <option key={technician} value={technician}>{technician}</option>)}</select></label><label><span className="sr-only">الصنف المشترى</span><select aria-label="تصفية حسب الصنف المشترى" className="field-input h-10 min-w-40 rounded-xl" value={itemNameFilter} onChange={event => setItemNameFilter(event.target.value)}><option value="">كل الأصناف</option>{(data?.availableItemNames ?? []).map(itemName => <option key={itemName} value={itemName}>{itemName}</option>)}</select></label><label><span className="sr-only">الفترة الزمنية</span><select className="field-input h-10 min-w-40 rounded-xl" value={dateFilterMode} onChange={event => setDateFilterMode(event.target.value as DateFilterMode)}><option value="all">كل الفترات</option><option value="month">شهر محدد</option><option value="range">فترة مخصصة</option></select></label>{dateFilterMode === "month" ? <input aria-label="اختيار الشهر" type="month" className="field-input h-10 rounded-xl" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} /> : null}{dateFilterMode === "range" ? <><input aria-label="من تاريخ" type="date" className="field-input h-10 rounded-xl" value={startDate} onChange={event => setStartDate(event.target.value)} /><input aria-label="إلى تاريخ" type="date" className="field-input h-10 rounded-xl" value={endDate} onChange={event => setEndDate(event.target.value)} /></> : null}<ReceiptText className="h-5 w-5 text-teal-700" /></div></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-right"><thead className="bg-teal-50/45 text-xs text-teal-950/65"><tr><th className="px-5 py-3 font-bold">التاريخ</th><th className="px-5 py-3 font-bold">النوع</th><th className="px-5 py-3 font-bold">العملة</th><th className="px-5 py-3 font-bold">التصنيف</th><th className="px-5 py-3 font-bold">المبلغ</th><th className="px-5 py-3 font-bold">الفني / الجهة</th><th className="px-5 py-3 font-bold">ملاحظات</th><th className="px-5 py-3 font-bold">إجراء</th></tr></thead><tbody className="divide-y divide-teal-950/6">{data?.transactions.length ? data.transactions.map(transaction => <CashTableRow key={transaction.id} transaction={transaction} onDelete={() => setDeleteId(transaction.id)} />) : <EmptyCashRow isLoading={isLoading} />}</tbody></table></div>
      <div className="divide-y divide-teal-950/6 md:hidden">{data?.transactions.length ? data.transactions.map(transaction => <CashCard key={transaction.id} transaction={transaction} onDelete={() => setDeleteId(transaction.id)} />) : <div className="p-12 text-center text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل الخزينة…" : "لا توجد عمليات مالية حتى الآن."}</div>}</div>
    </section>

    <PinVerificationDialog open={deleteId !== null} onOpenChange={openState => { if (!openState) setDeleteId(null); }} busy={deleteTransaction.isPending} title="تأكيد حذف العملية المالية" description="سيتم حذف العملية نهائيًا من سجل الخزينة، وقد يؤثر ذلك في الملخصات." onConfirm={pin => { if (deleteId !== null && !navigator.onLine && owner) { queueOfflineDelete(owner.id, { entity: "cash", id: deleteId, pin }); const current = data as any; if (current) cacheOfflineCash(owner.id, { ...current, transactions: current.transactions.filter((item: any) => item.id !== deleteId) }); setDeleteId(null); toast.success("تم حذف العملية محليًا وستتم مزامنة الحذف عند عودة الإنترنت"); } else if (deleteId !== null) deleteTransaction.mutate({ id: deleteId, pin }); }} />
    <Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl"><DialogHeader><DialogTitle>تسجيل عملية مالية</DialogTitle></DialogHeader><form onSubmit={submit} className="grid gap-4 py-2 sm:grid-cols-2"><label><span className="field-label">نوع العملية</span><select className="field-input" value={transactionType} onChange={event => setTransactionType(event.target.value as "income" | "expense")}><option value="expense">مصروف</option><option value="income">إيراد</option></select></label><label><span className="field-label">المبلغ بالريال السعودي</span><input type="number" min="0.01" step="0.01" className="field-input" value={amount} onChange={event => setAmount(event.target.value)} required placeholder="مثال: 250" /></label><label><span className="field-label">التصنيف</span><select className="field-input" value={category} onChange={event => setCategory(event.target.value)} required><option value="">اختر التصنيف</option>{transactionType === "income" ? <><option value="تحصيل تركيب">تحصيل تركيب</option><option value="تحصيل صيانة">تحصيل صيانة</option><option value="تحصيل تغيير شمعات">تحصيل تغيير شمعات</option><option value="نقدية خارج إيرادات العمل">نقدية خارج إيرادات العمل</option></> : <><option value="راتب فني">راتب فني</option><option value="مستحق فني">مستحق فني</option><option value="سلفة فني">سلفة فني</option><option value="بنزين">بنزين</option><option value="شراء بضاعة">شراء بضاعة</option><option value="مصروف عام">مصروف عام</option></>}<option value="أخرى">أخرى</option></select></label><label><span className="field-label">التاريخ والوقت</span><input type="datetime-local" className="field-input" value={transactionDate} onChange={event => setTransactionDate(event.target.value)} required /></label><label><span className="field-label">الفني أو الجهة المستلمة</span><input className="field-input" value={recipientName} onChange={event => setRecipientName(event.target.value)} placeholder="اختياري" /></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={notes} onChange={event => setNotes(event.target.value)} placeholder="تفاصيل إضافية عن العملية" /></label><div className="flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createTransaction.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createTransaction.isPending ? "جارٍ الحفظ…" : "حفظ العملية"}</Button></div></form></DialogContent></Dialog>
  </div>;
}

type CashTransaction = { id: number; transactionType: "income" | "expense"; currency?: Currency | null; amount: number; category: string; transactionDate: Date; recipientName: string | null; notes: string | null };
function TransactionBadge({ type }: { type: CashTransaction["transactionType"] }) { return <Badge className={type === "income" ? "bg-teal-100 text-teal-800 hover:bg-teal-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>{type === "income" ? "إيراد" : "مصروف"}</Badge>; }
function CashTableRow({ transaction, onDelete }: { transaction: CashTransaction; onDelete: () => void }) { const transactionCurrency: Currency = "SAR"; return <tr><td className="px-5 py-4 text-sm">{formatDate(transaction.transactionDate)}</td><td className="px-5 py-4"><TransactionBadge type={transaction.transactionType} /></td><td className="px-5 py-4 text-sm font-bold text-teal-800">{currencyShortLabel(transactionCurrency)}</td><td className="px-5 py-4 font-bold">{transaction.category}</td><td className={`px-5 py-4 font-extrabold ${transaction.transactionType === "income" ? "text-teal-700" : "text-amber-700"}`}>{transaction.transactionType === "income" ? "+" : "−"}{formatMoney(transaction.amount, transactionCurrency)}</td><td className="px-5 py-4 text-sm">{transaction.recipientName || "—"}</td><td className="max-w-64 truncate px-5 py-4 text-sm text-muted-foreground">{transaction.notes || "—"}</td><td className="px-5 py-4"><Button size="sm" variant="outline" onClick={onDelete} className="rounded-lg border-rose-200 text-rose-700 hover:bg-rose-50">حذف</Button></td></tr>; }
function CashCard({ transaction, onDelete }: { transaction: CashTransaction; onDelete: () => void }) { const transactionCurrency: Currency = "SAR"; return <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{transaction.category}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(transaction.transactionDate)} · {currencyLabel(transactionCurrency)}</p></div><TransactionBadge type={transaction.transactionType} /></div><p className={`mt-4 text-xl font-extrabold ${transaction.transactionType === "income" ? "text-teal-700" : "text-amber-700"}`}>{transaction.transactionType === "income" ? "+" : "−"}{formatMoney(transaction.amount, transactionCurrency)}</p><div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-muted-foreground"><p>الفني / الجهة</p><p className="text-left text-teal-950">{transaction.recipientName || "—"}</p>{transaction.notes ? <><p>ملاحظات</p><p className="text-left text-teal-950">{transaction.notes}</p></> : null}</div><Button size="sm" variant="outline" onClick={onDelete} className="mt-4 w-full rounded-xl border-rose-200 text-rose-700 hover:bg-rose-50">حذف العملية</Button></div>; }
function BreakdownList({ title, rows, currency, tone, empty }: { title: string; rows: Array<{ category: string; total: number }>; currency: Currency; tone: string; empty: string }) { return <div><h4 className={`text-sm font-extrabold ${tone}`}>{title}</h4><div className="mt-2 space-y-2">{rows.length ? rows.map(row => <div key={row.category} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"><span className="font-bold text-teal-950">{row.category}</span><span className={`font-extrabold ${tone}`}>{formatMoney(row.total, currency)}</span></div>) : <p className="rounded-xl bg-white/70 px-3 py-3 text-xs text-muted-foreground">{empty}</p>}</div></div>; }

type CashAnalytics = { installationIncome: number; serviceIncome: number; expenseByCategory: Array<{ category: string; total: number }>; technicianExpenses: Array<{ technician: string; total: number }> };
type PurchaseSummary = { total: number; items: Array<{ itemName: string; quantity: number; total: number; averageUnitCost: number }> };
function PurchasePanel({ currency, purchase }: { currency: Currency; purchase: PurchaseSummary }) {
  return <div className="rounded-2xl border border-indigo-950/8 bg-indigo-50/30 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-extrabold text-indigo-950">{currencyLabel(currency)}</h3><p className="mt-1 text-xs text-muted-foreground">إجمالي المشتريات</p></div><p className="text-xl font-extrabold text-indigo-700">{formatMoney(purchase.total, currency)}</p></div><div className="mt-4 overflow-x-auto"><table className="w-full min-w-[520px] text-right text-sm"><thead className="text-xs text-indigo-950/60"><tr><th className="px-2 py-2 font-bold">الصنف</th><th className="px-2 py-2 font-bold">الكمية</th><th className="px-2 py-2 font-bold">القيمة</th><th className="px-2 py-2 font-bold">متوسط الوحدة</th></tr></thead><tbody className="divide-y divide-indigo-950/8">{purchase.items.length ? purchase.items.map(item => <tr key={item.itemName}><td className="px-2 py-2 font-bold text-indigo-950">{item.itemName}</td><td className="px-2 py-2">{item.quantity}</td><td className="px-2 py-2 font-extrabold text-indigo-700">{formatMoney(item.total, currency)}</td><td className="px-2 py-2 text-indigo-950/75">{formatMoney(item.averageUnitCost, currency)}</td></tr>) : <tr><td colSpan={4} className="px-2 py-4 text-center text-xs text-muted-foreground">لا توجد مشتريات مسجلة.</td></tr>}</tbody></table></div></div>;
}
function AnalyticsPanel({ currency, analytics }: { currency: Currency; analytics: CashAnalytics }) {
  const chartData = [
    { name: "التركيبات", الإيرادات: analytics.installationIncome, المصروفات: 0 },
    { name: "الصيانة", الإيرادات: analytics.serviceIncome, المصروفات: 0 },
    ...analytics.expenseByCategory.slice(0, 6).map(row => ({ name: row.category, الإيرادات: 0, المصروفات: row.total })),
  ];
  return <div className="rounded-2xl border border-teal-950/8 bg-teal-50/30 p-4"><h3 className="font-extrabold text-teal-950">{currencyLabel(currency)}</h3><div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white p-3"><p className="text-xs text-muted-foreground">وارد التركيبات</p><p className="mt-1 font-extrabold text-teal-700">{formatMoney(analytics.installationIncome, currency)}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-muted-foreground">وارد الصيانة</p><p className="mt-1 font-extrabold text-teal-700">{formatMoney(analytics.serviceIncome, currency)}</p></div></div><div className="mt-4 h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}><CartesianGrid strokeDasharray="3 3" opacity={0.25} /><XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={55} /><YAxis tick={{ fontSize: 11 }} tickFormatter={value => `${Math.round(value / 100)}`} /><Tooltip formatter={(value: number, name: string) => [formatMoney(value, currency), name]} /><Legend /><Bar dataKey="الإيرادات" fill="#0f766e" radius={[6, 6, 0, 0]} /><Bar dataKey="المصروفات" fill="#d97706" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div><div className="mt-4 grid gap-4 md:grid-cols-2"><BreakdownList title="مصروفات حسب الفئة" rows={analytics.expenseByCategory} currency={currency} tone="text-amber-700" empty="لا توجد مصروفات." /><TechnicianList rows={analytics.technicianExpenses} currency={currency} /></div></div>;
}
function TechnicianList({ rows, currency }: { rows: Array<{ technician: string; total: number }>; currency: Currency }) { return <div><h4 className="text-sm font-extrabold text-indigo-700">مصروفات الفنيين</h4><div className="mt-2 space-y-2">{rows.length ? rows.map(row => <div key={row.technician} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"><span className="font-bold text-teal-950">{row.technician}</span><span className="font-extrabold text-indigo-700">{formatMoney(row.total, currency)}</span></div>) : <p className="rounded-xl bg-white/70 px-3 py-3 text-xs text-muted-foreground">لا توجد مصروفات مرتبطة بفني.</p>}</div></div>; }
function EmptyCashRow({ isLoading }: { isLoading: boolean }) { return <tr><td colSpan={8} className="p-14 text-center"><CircleDollarSign className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل الخزينة…" : "لا توجد عمليات مالية حتى الآن."}</p></td></tr>; }
