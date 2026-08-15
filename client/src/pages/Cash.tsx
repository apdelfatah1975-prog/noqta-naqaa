import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { formatDate, toDateTimeLocal } from "@/lib/filterUi";
import { ArrowDownRight, ArrowUpLeft, CircleDollarSign, Plus, ReceiptText, WalletCards } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

type Currency = "EGP" | "SAR";
type IncomeFilter = "all" | "service";
type DateFilterMode = "all" | "month" | "range";
const currencyLabel = (currency: Currency) => currency === "SAR" ? "ريال سعودي" : "جنيه مصري";
const currencyShortLabel = (currency: Currency) => currency === "SAR" ? "ر.س" : "ج.م";
const formatMoney = (amount: number, currency: Currency = "EGP") => new Intl.NumberFormat("ar-EG", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);

export default function Cash() {
  const [incomeFilter, setIncomeFilter] = useState<IncomeFilter>("all");
  const [dateFilterMode, setDateFilterMode] = useState<DateFilterMode>("all");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const cashQueryInput = useMemo(() => ({ incomeFilter, month: dateFilterMode === "month" ? selectedMonth || undefined : undefined, startDate: dateFilterMode === "range" ? startDate || undefined : undefined, endDate: dateFilterMode === "range" ? endDate || undefined : undefined }), [incomeFilter, dateFilterMode, selectedMonth, startDate, endDate]);
  const { data, isLoading, isError } = trpc.filters.cash.summary.useQuery(cashQueryInput);
  const utils = trpc.useUtils();
  const [open, setOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense");
  const [currency, setCurrency] = useState<Currency>("EGP");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [transactionDate, setTransactionDate] = useState(toDateTimeLocal());
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");

  const createTransaction = trpc.filters.cash.create.useMutation({
    onSuccess: () => {
      utils.filters.cash.summary.invalidate();
      utils.filters.dashboard.invalidate();
      toast.success(transactionType === "income" ? "تم تسجيل الإيراد" : "تم تسجيل المصروف");
      setOpen(false); setAmount(""); setCategory(""); setRecipientName(""); setNotes(""); setCurrency("EGP");
    },
    onError: error => toast.error(error.message || "تعذر حفظ العملية المالية. حاول مرة أخرى."),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    createTransaction.mutate({
      transactionType,
      currency,
      amount: Math.round(Number(amount) * 100),
      category,
      transactionDate: new Date(transactionDate),
      recipientName: recipientName || null,
      notes: notes || null,
    });
  }

  if (isError) return <div className="soft-card p-8 text-center"><p className="font-bold text-teal-950">تعذر تحميل بيانات الخزينة.</p><p className="mt-2 text-sm text-muted-foreground">تحقق من الاتصال ثم أعد المحاولة.</p><Button onClick={() => window.location.reload()} variant="outline" className="mt-4 rounded-xl">إعادة المحاولة</Button></div>;

  const summaries = data?.summaries ?? { EGP: { incomeTotal: data?.incomeTotal ?? 0, expenseTotal: data?.expenseTotal ?? 0, balance: data?.balance ?? 0 }, SAR: { incomeTotal: 0, expenseTotal: 0, balance: 0 } };
  const breakdown = data?.breakdown ?? { EGP: { income: [], expense: [] }, SAR: { income: [], expense: [] } };
  const summaryCards = (Object.entries(summaries) as Array<[Currency, typeof summaries.EGP]>).flatMap(([cardCurrency, summary]) => [
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
      <div className="grid gap-5 lg:grid-cols-2">{(["EGP", "SAR"] as Currency[]).map(cardCurrency => <div key={cardCurrency} className="rounded-2xl border border-teal-950/8 bg-teal-50/30 p-4"><h3 className="font-extrabold text-teal-950">{currencyLabel(cardCurrency)}</h3><div className="mt-4 grid gap-4 md:grid-cols-2"><BreakdownList title="الإيرادات" rows={breakdown[cardCurrency].income} currency={cardCurrency} tone="text-teal-700" empty="لا توجد إيرادات مسجلة." /><BreakdownList title="المصروفات" rows={breakdown[cardCurrency].expense} currency={cardCurrency} tone="text-amber-700" empty="لا توجد مصروفات مسجلة." /></div></div>)}</div>
    </section>

    <section className="soft-card overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-teal-950/6 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-extrabold">سجل العمليات</h2><p className="mt-1 text-xs text-muted-foreground">آخر الإيرادات والمصروفات المسجلة في الخزينة.</p></div><div className="flex flex-wrap items-center gap-2"><label><span className="sr-only">تصفية الإيرادات</span><select className="field-input h-10 min-w-48 rounded-xl" value={incomeFilter} onChange={event => setIncomeFilter(event.target.value as IncomeFilter)}><option value="all">كل العمليات</option><option value="service">إيرادات الصيانة والتركيب</option></select></label><label><span className="sr-only">الفترة الزمنية</span><select className="field-input h-10 min-w-40 rounded-xl" value={dateFilterMode} onChange={event => setDateFilterMode(event.target.value as DateFilterMode)}><option value="all">كل الفترات</option><option value="month">شهر محدد</option><option value="range">فترة مخصصة</option></select></label>{dateFilterMode === "month" ? <input aria-label="اختيار الشهر" type="month" className="field-input h-10 rounded-xl" value={selectedMonth} onChange={event => setSelectedMonth(event.target.value)} /> : null}{dateFilterMode === "range" ? <><input aria-label="من تاريخ" type="date" className="field-input h-10 rounded-xl" value={startDate} onChange={event => setStartDate(event.target.value)} /><input aria-label="إلى تاريخ" type="date" className="field-input h-10 rounded-xl" value={endDate} onChange={event => setEndDate(event.target.value)} /></> : null}<ReceiptText className="h-5 w-5 text-teal-700" /></div></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[820px] text-right"><thead className="bg-teal-50/45 text-xs text-teal-950/65"><tr><th className="px-5 py-3 font-bold">التاريخ</th><th className="px-5 py-3 font-bold">النوع</th><th className="px-5 py-3 font-bold">العملة</th><th className="px-5 py-3 font-bold">التصنيف</th><th className="px-5 py-3 font-bold">المبلغ</th><th className="px-5 py-3 font-bold">الفني / الجهة</th><th className="px-5 py-3 font-bold">ملاحظات</th></tr></thead><tbody className="divide-y divide-teal-950/6">{data?.transactions.length ? data.transactions.map(transaction => <CashTableRow key={transaction.id} transaction={transaction} />) : <EmptyCashRow isLoading={isLoading} />}</tbody></table></div>
      <div className="divide-y divide-teal-950/6 md:hidden">{data?.transactions.length ? data.transactions.map(transaction => <CashCard key={transaction.id} transaction={transaction} />) : <div className="p-12 text-center text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل الخزينة…" : "لا توجد عمليات مالية حتى الآن."}</div>}</div>
    </section>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent dir="rtl"><DialogHeader><DialogTitle>تسجيل عملية مالية</DialogTitle></DialogHeader><form onSubmit={submit} className="grid gap-4 py-2 sm:grid-cols-2"><label><span className="field-label">نوع العملية</span><select className="field-input" value={transactionType} onChange={event => setTransactionType(event.target.value as "income" | "expense")}><option value="expense">مصروف</option><option value="income">إيراد</option></select></label><label><span className="field-label">العملة</span><select className="field-input" value={currency} onChange={event => setCurrency(event.target.value as Currency)}><option value="EGP">جنيه مصري (ج.م)</option><option value="SAR">ريال سعودي (ر.س)</option></select></label><label><span className="field-label">المبلغ بـ {currencyShortLabel(currency)}</span><input type="number" min="0.01" step="0.01" className="field-input" value={amount} onChange={event => setAmount(event.target.value)} required placeholder="مثال: 250" /></label><label><span className="field-label">التصنيف</span><input className="field-input" value={category} onChange={event => setCategory(event.target.value)} required placeholder={transactionType === "expense" ? "مثال: مواصلات أو شراء مستلزمات" : "مثال: تحصيل صيانة"} /></label><label><span className="field-label">التاريخ والوقت</span><input type="datetime-local" className="field-input" value={transactionDate} onChange={event => setTransactionDate(event.target.value)} required /></label><label><span className="field-label">الفني أو الجهة المستلمة</span><input className="field-input" value={recipientName} onChange={event => setRecipientName(event.target.value)} placeholder="اختياري" /></label><label className="sm:col-span-2"><span className="field-label">ملاحظات</span><textarea className="field-textarea" value={notes} onChange={event => setNotes(event.target.value)} placeholder="تفاصيل إضافية عن العملية" /></label><div className="flex justify-end gap-3 sm:col-span-2"><Button type="button" variant="outline" onClick={() => setOpen(false)} className="rounded-xl">إلغاء</Button><Button type="submit" disabled={createTransaction.isPending} className="rounded-xl bg-teal-700 hover:bg-teal-800">{createTransaction.isPending ? "جارٍ الحفظ…" : "حفظ العملية"}</Button></div></form></DialogContent></Dialog>
  </div>;
}

type CashTransaction = { id: number; transactionType: "income" | "expense"; currency?: Currency | null; amount: number; category: string; transactionDate: Date; recipientName: string | null; notes: string | null };
function TransactionBadge({ type }: { type: CashTransaction["transactionType"] }) { return <Badge className={type === "income" ? "bg-teal-100 text-teal-800 hover:bg-teal-100" : "bg-amber-100 text-amber-800 hover:bg-amber-100"}>{type === "income" ? "إيراد" : "مصروف"}</Badge>; }
function CashTableRow({ transaction }: { transaction: CashTransaction }) { const transactionCurrency = transaction.currency ?? "EGP"; return <tr><td className="px-5 py-4 text-sm">{formatDate(transaction.transactionDate)}</td><td className="px-5 py-4"><TransactionBadge type={transaction.transactionType} /></td><td className="px-5 py-4 text-sm font-bold text-teal-800">{currencyShortLabel(transactionCurrency)}</td><td className="px-5 py-4 font-bold">{transaction.category}</td><td className={`px-5 py-4 font-extrabold ${transaction.transactionType === "income" ? "text-teal-700" : "text-amber-700"}`}>{transaction.transactionType === "income" ? "+" : "−"}{formatMoney(transaction.amount, transactionCurrency)}</td><td className="px-5 py-4 text-sm">{transaction.recipientName || "—"}</td><td className="max-w-64 truncate px-5 py-4 text-sm text-muted-foreground">{transaction.notes || "—"}</td></tr>; }
function CashCard({ transaction }: { transaction: CashTransaction }) { const transactionCurrency = transaction.currency ?? "EGP"; return <div className="p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-extrabold">{transaction.category}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(transaction.transactionDate)} · {currencyLabel(transactionCurrency)}</p></div><TransactionBadge type={transaction.transactionType} /></div><p className={`mt-4 text-xl font-extrabold ${transaction.transactionType === "income" ? "text-teal-700" : "text-amber-700"}`}>{transaction.transactionType === "income" ? "+" : "−"}{formatMoney(transaction.amount, transactionCurrency)}</p><div className="mt-3 grid grid-cols-2 gap-y-2 text-xs text-muted-foreground"><p>الفني / الجهة</p><p className="text-left text-teal-950">{transaction.recipientName || "—"}</p>{transaction.notes ? <><p>ملاحظات</p><p className="text-left text-teal-950">{transaction.notes}</p></> : null}</div></div>; }
function BreakdownList({ title, rows, currency, tone, empty }: { title: string; rows: Array<{ category: string; total: number }>; currency: Currency; tone: string; empty: string }) { return <div><h4 className={`text-sm font-extrabold ${tone}`}>{title}</h4><div className="mt-2 space-y-2">{rows.length ? rows.map(row => <div key={row.category} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm shadow-sm"><span className="font-bold text-teal-950">{row.category}</span><span className={`font-extrabold ${tone}`}>{formatMoney(row.total, currency)}</span></div>) : <p className="rounded-xl bg-white/70 px-3 py-3 text-xs text-muted-foreground">{empty}</p>}</div></div>; }
function EmptyCashRow({ isLoading }: { isLoading: boolean }) { return <tr><td colSpan={7} className="p-14 text-center"><CircleDollarSign className="mx-auto h-8 w-8 text-teal-200" /><p className="mt-3 text-sm text-muted-foreground">{isLoading ? "جارٍ تحميل الخزينة…" : "لا توجد عمليات مالية حتى الآن."}</p></td></tr>; }
