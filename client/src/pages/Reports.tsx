import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  CalendarDays,
  Download,
  FileBarChart,
  PackageSearch,
  Printer,
  RefreshCw,
  WalletCards,
  SlidersHorizontal,
} from "lucide-react";
import { labelVisitType } from "@/lib/filterUi";
import { formatAppMoney } from "@/lib/appSettings";
import { printArabicPdf } from "@/lib/pdfExport";
import { localizeExcelRows } from "@/lib/excelExport";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const money = (amount: number) => formatAppMoney(Number(amount) || 0);
const number = (value: number) => new Intl.NumberFormat("ar-SA").format(value);
const dateLabel = (value: string | Date) =>
  new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium" }).format(
    new Date(value)
  );
const isoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const firstOfMonth = () => {
  const date = new Date();
  return isoDate(new Date(date.getFullYear(), date.getMonth(), 1));
};
const today = () => isoDate(new Date());

export default function Reports() {
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [reportSection, setReportSection] = useState<
    "overview" | "financial" | "visits" | "inventory" | "treasury" | "all"
  >("overview");
  const [treasuryTechnician, setTreasuryTechnician] = useState("");
  const [treasuryType, setTreasuryType] = useState<
    "all" | "income" | "expense"
  >("all");
  const [treasuryCategory, setTreasuryCategory] = useState("");
  const [showTreasuryFilters, setShowTreasuryFilters] = useState(true);
  const reportInput = useMemo(
    () => ({
      dateFrom,
      dateTo,
      technician: treasuryTechnician || undefined,
      transactionType: treasuryType,
      category: treasuryCategory || undefined,
    }),
    [dateFrom, dateTo, treasuryTechnician, treasuryType, treasuryCategory]
  );
  const query = trpc.filters.reports.monthly.useQuery(reportInput, {
    retry: false,
    staleTime: 5_000,
    refetchInterval: 8_000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: false,
    networkMode: "online",
  });
  const emptyReport = {
    period: { dateFrom, dateTo },
    summary: {
      visits: 0,
      customers: 0,
      income: 0,
      expense: 0,
      balance: 0,
      pendingReminders: 0,
      lowStock: 0,
    },
    incomeByCategory: [],
    expenseByCategory: [],
    visitsByType: [],
    visitsByTechnician: [],
    inventory: {
      incomingQuantity: 0,
      outgoingQuantity: 0,
      purchaseCost: 0,
      items: [],
    },
    recentVisits: [],
  } as unknown as NonNullable<typeof query.data>;
  const data = query.data ?? emptyReport;
  const financial = data.financial ?? {
    serviceIncome: 0,
    externalIncome: 0,
    totalIncome: 0,
    technicianPayments: 0,
    technicianRequired: 0,
    technicianRemaining: 0,
    otherExpenses: 0,
    gasolineExpenses: 0,
    inventoryPurchaseExpenses: 0,
    generalExpenses: 0,
    uncategorizedExpenses: 0,
    companyNet: 0,
    technicianPaymentsByName: [],
  };
  const treasury = (data as any).treasury ?? {
    transactions: [],
    incomeTotal: data.summary.income,
    expenseTotal: data.summary.expense,
    balance: data.summary.balance,
    availableTechnicians: [],
    availableCategories: [],
  };
  const incomeByCategory = Array.isArray(data.incomeByCategory) ? data.incomeByCategory : [];
  const expenseByCategory = Array.isArray(data.expenseByCategory) ? data.expenseByCategory : [];
  const treasuryTransactions = Array.isArray(treasury.transactions) ? treasury.transactions : [];
  const inventoryItems = Array.isArray(data.inventory?.items) ? data.inventory.items : [];
  const safeVisitsByType = Array.isArray(data.visitsByType) ? data.visitsByType : [];
  const safeVisitsByTechnician = Array.isArray(data.visitsByTechnician) ? data.visitsByTechnician : [];
  const safeRecentVisits = Array.isArray(data.recentVisits) ? data.recentVisits : [];
  const safeTechnicianPayments = Array.isArray(financial.technicianPaymentsByName) ? financial.technicianPaymentsByName : [];
  const exportExcel = () => {
    if (!data) return;
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows([
        { البيان: "الفترة من", القيمة: data.period.dateFrom },
        { البيان: "الفترة إلى", القيمة: data.period.dateTo },
        { البيان: "عدد الزيارات", القيمة: data.summary.visits },
        {
          البيان: "عدد العملاء الذين تمت زيارتهم",
          القيمة: data.summary.customers,
        },
        { البيان: "الإيرادات", القيمة: data.summary.income },
        { البيان: "المصروفات", القيمة: data.summary.expense },
        { البيان: "صافي الحركة", القيمة: data.summary.balance },
        { البيان: "المتابعات المعلقة", القيمة: data.summary.pendingReminders },
        { البيان: "الأصناف منخفضة الرصيد", القيمة: data.summary.lowStock },
      ])),
      "الملخص"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(
        incomeByCategory.map(row => ({
          البند: row.label,
          الإجمالي: row.total,
        }))
      )),
      "الإيرادات"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(
        treasuryTransactions.map((row: any) => ({
          التاريخ: dateLabel(row.transactionDate),
          النوع: row.transactionType === "income" ? "إيراد" : "مصروف",
          التصنيف: row.category || "غير مصنف",
          الفني: row.recipientName || "غير محدد",
          المبلغ: row.amount,
          الملاحظات: row.notes || "",
        }))
      )),
      "حركات الخزينة"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows([
        { البيان: "إيرادات الخدمات", الإجمالي: financial.serviceIncome },
        {
          البيان: "نقدية خارج إيرادات العمل",
          الإجمالي: financial.externalIncome,
        },
        { البيان: "إجمالي الداخل", الإجمالي: financial.totalIncome },
        {
          البيان: "إجمالي مستحقات الفنيين",
          الإجمالي: financial.technicianRequired,
        },
        {
          البيان: "إجمالي المدفوع للفنيين",
          الإجمالي: financial.technicianPayments,
        },
        {
          البيان: "إجمالي المتبقي للفنيين",
          الإجمالي: financial.technicianRemaining,
        },
        {
          البيان: "البنزين — مصروف تشغيل",
          الإجمالي: financial.gasolineExpenses,
        },
        {
          البيان: "مشتريات المخزن",
          الإجمالي: financial.inventoryPurchaseExpenses,
        },
        { البيان: "المصروفات العامة", الإجمالي: financial.generalExpenses },
        {
          البيان: "مصروفات أخرى أو غير مصنفة",
          الإجمالي: financial.uncategorizedExpenses,
        },
        {
          البيان: "إجمالي المصروفات غير رواتب الفنيين",
          الإجمالي: financial.otherExpenses,
        },
        {
          البيان: "صافي إيراد الشركة بعد المصروفات",
          الإجمالي: financial.companyNet,
        },
      ])),
      "مالية الشركة"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(
        safeTechnicianPayments.map(row => ({
          الفني: row.technician,
          الحالة: row.status === "paid" ? "مدفوع" : "متبقي",
          "إجمالي المستحق": row.requiredAmount,
          "إجمالي المدفوع": row.totalPaid,
          المتبقي: row.remainingAmount,
          "عدد العمليات": row.transactionCount,
        }))
      )),
      "مستحقات الفنيين"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(
        expenseByCategory.map(row => ({
          البند: row.label,
          الإجمالي: row.total,
        }))
      )),
      "المصروفات"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(
        safeVisitsByType.map(row => ({
          النوع: labelVisitType(row.label),
          العدد: row.total,
        }))
      )),
      "أنواع الزيارات"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(
        safeVisitsByTechnician.map(row => ({
          الفني: row.label,
          "عدد الزيارات": row.total,
        }))
      )),
      "الفنيون"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(
        safeRecentVisits.map(row => ({
          التاريخ: dateLabel(row.date),
          العميل: row.customer,
          النوع: labelVisitType(row.type),
          الفني: row.technician,
        }))
      )),
      "آخر الزيارات"
    );
    XLSX.writeFile(workbook, `تقرير-نقطة-نقاء-${dateFrom}-${dateTo}.xlsx`);
  };

  const exportTechnicianPdf = (
    row: (typeof financial.technicianPaymentsByName)[number]
  ) => {
    const rows = [
      { البيان: "الفترة", القيمة: `${dateFrom} إلى ${dateTo}` },
      { البيان: "الفني", القيمة: row.technician },
      { البيان: "الحالة", القيمة: row.status === "paid" ? "مدفوع" : "متبقي" },
      { البيان: "إجمالي المستحق", القيمة: money(row.requiredAmount) },
      { البيان: "إجمالي المدفوع", القيمة: money(row.totalPaid) },
      { البيان: "المتبقي", القيمة: money(row.remainingAmount) },
      { البيان: "عدد العمليات", القيمة: number(row.transactionCount) },
      {
        البيان: "ملاحظة",
        القيمة:
          row.remainingAmount > 0
            ? "يوجد مبلغ متبقٍ للمراجعة أو التسليم"
            : "لا يوجد مبلغ متبقٍ حسب الحركات المسجلة",
      },
    ];
    const opened = printArabicPdf(
      `كشف حساب الفني - ${row.technician} - ${dateFrom} إلى ${dateTo}`,
      rows,
      [
        { key: "البيان", label: "البيان" },
        { key: "القيمة", label: "القيمة" },
      ]
    );
    if (opened) toast.success(`تم تجهيز كشف ${row.technician}`);
    else
      toast.error(
        "تعذر فتح نافذة PDF؛ اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى"
      );
  };

  const exportPdf = () => {
    const rows = [
      { البيان: "الفترة من", القيمة: data.period.dateFrom },
      { البيان: "الفترة إلى", القيمة: data.period.dateTo },
      { البيان: "عدد الزيارات", القيمة: number(data.summary.visits) },
      {
        البيان: "عدد العملاء الذين تمت زيارتهم",
        القيمة: number(data.summary.customers),
      },
      { البيان: "الإيرادات", القيمة: money(data.summary.income) },
      { البيان: "المصروفات", القيمة: money(data.summary.expense) },
      { البيان: "صافي الفترة", القيمة: money(data.summary.balance) },
      {
        البيان: "رصيد الخزنة الفعلي",
        القيمة: money(data.summary.treasuryBalance ?? 0),
      },
      {
        البيان: "إجمالي حركات الخزينة بعد الفلاتر",
        القيمة: `${money(treasury.balance)} — إيراد ${money(treasury.incomeTotal)} — مصروف ${money(treasury.expenseTotal)}`,
      },
      {
        البيان: "فلاتر الخزينة",
        القيمة: `الفني: ${treasuryTechnician || "الكل"} — النوع: ${treasuryType === "all" ? "الكل" : treasuryType === "income" ? "إيراد" : "مصروف"} — التصنيف: ${treasuryCategory || "الكل"}`,
      },
      {
        البيان: "المتابعات المعلقة",
        القيمة: number(data.summary.pendingReminders),
      },
      { البيان: "أصناف منخفضة الرصيد", القيمة: number(data.summary.lowStock) },
      {
        البيان: "البنزين — مصروف تشغيل",
        القيمة: money(financial.gasolineExpenses),
      },
      {
        البيان: "مشتريات المخزن",
        القيمة: money(financial.inventoryPurchaseExpenses),
      },
      { البيان: "المصروفات العامة", القيمة: money(financial.generalExpenses) },
      {
        البيان: "مصروفات أخرى أو غير مصنفة",
        القيمة: money(financial.uncategorizedExpenses),
      },
      {
        البيان: "إجمالي المصروفات غير رواتب الفنيين",
        القيمة: money(financial.otherExpenses),
      },
      {
        البيان: "صافي إيراد الشركة بعد المصروفات",
        القيمة: money(financial.companyNet),
      },
      ...safeTechnicianPayments.map(row => ({
        البيان: `الفني: ${row.technician}`,
        القيمة: `${row.status === "paid" ? "مدفوع" : "متبقي"} — المستحق ${money(row.requiredAmount)} — المدفوع ${money(row.totalPaid)} — المتبقي ${money(row.remainingAmount)}`,
      })),
    ];
    const opened = printArabicPdf(
      `تقرير نقطة نقاء - ${dateFrom} إلى ${dateTo}`,
      rows,
      [
        { key: "البيان", label: "البيان" },
        { key: "القيمة", label: "القيمة" },
      ]
    );
    if (opened) toast.success("تم تجهيز PDF للتقرير");
    else
      toast.error(
        "تعذر فتح نافذة PDF؛ اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى"
      );
  };

  const printManagerSummary = () => {
    const rows = [
      { البيان: "الفترة", القيمة: `${dateFrom} إلى ${dateTo}` },
      { البيان: "الإيرادات", القيمة: money(data.summary.income) },
      { البيان: "المصروفات", القيمة: money(data.summary.expense) },
      { البيان: "صافي الفترة", القيمة: money(data.summary.balance) },
      { البيان: "عدد الزيارات المنفذة", القيمة: number(data.summary.visits) },
      {
        البيان: "العملاء الذين تمت زيارتهم",
        القيمة: number(data.summary.customers),
      },
      {
        البيان: "المتابعات المعلقة",
        القيمة: number(data.summary.pendingReminders),
      },
      { البيان: "الأصناف منخفضة الرصيد", القيمة: number(data.summary.lowStock) },
      {
        البيان: "المتبقي للفنيين",
        القيمة: money(financial.technicianRemaining),
      },
      { البيان: "مصروف البنزين", القيمة: money(financial.gasolineExpenses) },
      {
        البيان: "مشتريات المخزن",
        القيمة: money(financial.inventoryPurchaseExpenses),
      },
      {
        البيان: "خلاصة المتابعة",
        القيمة: actionItems.length
          ? actionItems.map(item => item.title).join(" — ")
          : "لا توجد بنود عاجلة",
      },
    ];
    const opened = printArabicPdf(
      `ملخص المدير - ${dateFrom} إلى ${dateTo}`,
      rows,
      [
        { key: "البيان", label: "البيان" },
        { key: "القيمة", label: "القيمة" },
      ]
    );
    if (opened) toast.success("تم تجهيز ملخص المدير للطباعة");
    else
      toast.error(
        "تعذر فتح نافذة الملخص؛ اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى"
      );
  };

  const exportTreasuryExcel = () => {
    const workbook = XLSX.utils.book_new();
    const filterRows = [
      { البيان: "الفترة من", القيمة: dateFrom },
      { البيان: "الفترة إلى", القيمة: dateTo },
      { البيان: "الفني", القيمة: treasuryTechnician || "الكل" },
      {
        البيان: "نوع الحركة",
        القيمة:
          treasuryType === "all"
            ? "الكل"
            : treasuryType === "income"
              ? "إيراد"
              : "مصروف",
      },
      { البيان: "التصنيف", القيمة: treasuryCategory || "الكل" },
      { البيان: "إجمالي الإيرادات", القيمة: treasury.incomeTotal },
      { البيان: "إجمالي المصروفات", القيمة: treasury.expenseTotal },
      { البيان: "الصافي", القيمة: treasury.balance },
      { البيان: "عدد الحركات", القيمة: treasuryTransactions.length },
    ];
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(filterRows)),
      "ملخص الخزينة"
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(localizeExcelRows(
        treasuryTransactions.map((row: any) => ({
          التاريخ: dateLabel(row.transactionDate),
          النوع: row.transactionType === "income" ? "إيراد" : "مصروف",
          التصنيف: row.category || "غير مصنف",
          الفني_المستلم: row.recipientName || "غير محدد",
          المبلغ: Number(row.amount || 0),
          الملاحظات: row.notes || "",
        }))
      )),
      "المعاملات المالية"
    );
    XLSX.writeFile(workbook, `حركات-الخزينة-${dateFrom}-${dateTo}.xlsx`);
    toast.success("تم تصدير حركات الخزينة إلى Excel");
  };

  const exportTreasuryPdf = () => {
    const rows = [
      { البيان: "الفترة", القيمة: `${dateFrom} إلى ${dateTo}` },
      { البيان: "الفني", القيمة: treasuryTechnician || "الكل" },
      {
        البيان: "نوع الحركة",
        القيمة:
          treasuryType === "all"
            ? "الكل"
            : treasuryType === "income"
              ? "إيراد"
              : "مصروف",
      },
      { البيان: "التصنيف", القيمة: treasuryCategory || "الكل" },
      { البيان: "إجمالي الإيرادات", القيمة: money(treasury.incomeTotal) },
      { البيان: "إجمالي المصروفات", القيمة: money(treasury.expenseTotal) },
      { البيان: "الصافي", القيمة: money(treasury.balance) },
      { البيان: "عدد الحركات", القيمة: number(treasuryTransactions.length) },
      ...treasuryTransactions.map((row: any) => ({
        البيان: `${dateLabel(row.transactionDate)} — ${row.transactionType === "income" ? "إيراد" : "مصروف"} — ${row.category || "غير مصنف"} — ${row.recipientName || "غير محدد"}`,
        القيمة: `${money(row.amount)} — ${row.notes || "بدون ملاحظات"}`,
      })),
    ];
    const opened = printArabicPdf(
      `حركات الخزينة - ${dateFrom} إلى ${dateTo}`,
      rows,
      [
        { key: "البيان", label: "البيان" },
        { key: "القيمة", label: "القيمة" },
      ]
    );
    if (opened) toast.success("تم تجهيز حركات الخزينة بصيغة PDF");
    else
      toast.error(
        "تعذر فتح نافذة PDF؛ اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى"
      );
  };

  const cards = useMemo(
    () =>
      data
        ? [
            {
              label: "الزيارات المنفذة",
              description: "عدد الزيارات المسجلة خلال الفترة",
              value: number(data.summary.visits),
              unit: "زيارة",
              tone: "bg-teal-50 text-teal-900",
              icon: CalendarDays,
            },
            {
              label: "الإيرادات",
              description: "إجمالي الأموال الداخلة من الزيارات",
              value: money(data.summary.income),
              unit: "",
              tone: "bg-emerald-50 text-emerald-900",
              icon: WalletCards,
            },
            {
              label: "المصروفات",
              description: "إجمالي الأموال الخارجة خلال الفترة",
              value: money(data.summary.expense),
              unit: "",
              tone: "bg-amber-50 text-amber-950",
              icon: WalletCards,
            },
            {
              label: "صافي الفترة",
              description: "إيرادات الفترة ناقص مصروفات الفترة",
              value: money(data.summary.balance),
              unit: "",
              tone: "bg-slate-950 text-white",
              icon: FileBarChart,
            },
            {
              label: "رصيد الخزنة الفعلي",
              description: "الرصيد من جميع حركات الخزنة حتى الآن",
              value: money(data.summary.treasuryBalance ?? 0),
              unit: "",
              tone: "bg-cyan-50 text-cyan-950",
              icon: WalletCards,
            },
            {
              label: "المتابعات المعلقة",
              description: "عملاء موعد متابعتهم مستحق أو متأخر",
              value: number(data.summary.pendingReminders),
              unit: "عميل",
              tone: "bg-indigo-50 text-indigo-900",
              icon: CalendarDays,
            },
            {
              label: "أصناف منخفضة الرصيد",
              description: "أصناف وصلت إلى حد التنبيه المحدد",
              value: number(data.summary.lowStock),
              unit: "صنف",
              tone: "bg-rose-50 text-rose-900",
              icon: PackageSearch,
            },
          ]
        : [],
    [data]
  );

  const overviewCards = cards.slice(0, 5);
  const show = (section: Exclude<typeof reportSection, "all">) =>
    reportSection === "all" || reportSection === section;
  const showAllDetails = reportSection === "all";
  const setPreset = (preset: "today" | "week" | "month") => {
    const end = new Date();
    const start = new Date(end);
    if (preset === "today") start.setHours(0, 0, 0, 0);
    if (preset === "week") start.setDate(end.getDate() - 6);
    if (preset === "month") start.setDate(1);
    setDateFrom(isoDate(start));
    setDateTo(isoDate(end));
  };

  const expenseTotal = Math.max(data.summary.expense, 1);
  const incomeTotal = Math.max(data.summary.income, 1);
  const actionItems = [
    data.summary.pendingReminders > 0
      ? {
          tone: "warning",
          title: `${number(data.summary.pendingReminders)} متابعة مستحقة`,
          text: "راجع العملاء المستحقين وأرسل رسائل المتابعة.",
        }
      : null,
    data.summary.lowStock > 0
      ? {
          tone: "danger",
          title: `${number(data.summary.lowStock)} أصناف منخفضة`,
          text: "راجع المشتريات قبل نفاد قطع الغيار.",
        }
      : null,
    financial.technicianRemaining > 0
      ? {
          tone: "info",
          title: `${money(financial.technicianRemaining)} متبقي للفنيين`,
          text: "راجع كشف الرواتب والسلف قبل إغلاق الفترة.",
        }
      : null,
    financial.gasolineExpenses > 0
      ? {
          tone: "neutral",
          title: `${money(financial.gasolineExpenses)} بنزين`,
          text: "قارن مصروف التنقل بعدد الزيارات المنفذة.",
        }
      : null,
  ].filter(Boolean) as Array<{ tone: string; title: string; text: string }>;
  const incomeBars = incomeByCategory.slice(0, 5);
  const expenseBars = expenseByCategory.slice(0, 5);
  const periodReconciliation = data.summary.income - data.summary.expense;
  const treasuryBalance = data.summary.treasuryBalance ?? 0;
  const reconciliationMatches = periodReconciliation === data.summary.balance;

  return (
    <div className="mx-auto max-w-7xl space-y-6 print:bg-white">
      <div className="flex flex-col gap-4 rounded-3xl bg-gradient-to-l from-violet-950 via-violet-900 to-teal-800 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div>
          <p className="text-sm font-bold text-violet-200">مركز الإدارة</p>
          <h1 className="mt-1 text-3xl font-black">التقارير</h1>
          <p className="mt-2 text-sm text-white/75">
            ملخص واضح للزيارات والماليات والمخزون في الفترة المحددة.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="h-10 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={() => query.refetch()}
          >
            <RefreshCw className="ml-2 h-4 w-4" />
            تحديث
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={printManagerSummary}
            disabled={!data}
          >
            <FileBarChart className="ml-2 h-4 w-4" />
            ملخص المدير
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={() => window.print()}
            disabled={!data}
          >
            <Printer className="ml-2 h-4 w-4" />
            طباعة كاملة
          </Button>
          <Button
            variant="outline"
            className="h-10 rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20"
            onClick={exportPdf}
            disabled={!data}
          >
            <Download className="ml-2 h-4 w-4" />
            PDF
          </Button>
          <Button
            className="h-10 rounded-xl bg-white text-violet-900 hover:bg-violet-50"
            onClick={exportExcel}
            disabled={!data}
          >
            <Download className="ml-2 h-4 w-4" />
            Excel
          </Button>
        </div>
      </div>

      <section className="soft-card space-y-4 p-4 print:hidden">
        <div className="flex items-center gap-2 text-sm font-black text-violet-950">
          <SlidersHorizontal className="h-4 w-4 text-violet-700" />
          تحديد فترة التقرير
        </div>
        <div className="flex flex-wrap gap-2">
          <SectionButton active={false} onClick={() => setPreset("today")} description="عرض حركات اليوم فقط">
            اليوم
          </SectionButton>
          <SectionButton active={false} onClick={() => setPreset("week")} description="من اليوم حتى آخر أسبوع">
            آخر 7 أيام
          </SectionButton>
          <SectionButton active={false} onClick={() => setPreset("month")} description="من أول الشهر الحالي حتى اليوم">
            هذا الشهر
          </SectionButton>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <label className="field-label" htmlFor="report-from">
              من تاريخ
            </label>
            <input
              id="report-from"
              type="date"
              className="field-input mt-1"
              value={dateFrom}
              onChange={event => setDateFrom(event.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="report-to">
              إلى تاريخ
            </label>
            <input
              id="report-to"
              type="date"
              className="field-input mt-1"
              value={dateTo}
              onChange={event => setDateTo(event.target.value)}
            />
          </div>
          <div className="rounded-xl bg-teal-50 px-4 py-3 text-sm font-bold text-teal-900">
            {dateFrom && dateTo
              ? `من ${dateFrom} إلى ${dateTo}`
              : "اختر الفترة"}
          </div>
        </div>
      </section>

      {query.isLoading && !data ? (
        <div className="soft-card p-12 text-center text-sm text-muted-foreground">
          جارٍ إعداد التقرير…
        </div>
      ) : data ? (
        <>
          {!query.data ? (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900 print:hidden">
              تعذر الاتصال بالخادم؛ يُعرض قالب التقرير فارغًا دون بيانات محلية. أعد المحاولة قبل التصدير أو الطباعة.
            </div>
          ) : null}
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {overviewCards.map(card => (
              <article
                key={card.label}
                className={`rounded-xl px-3 py-3 shadow-sm ${card.tone}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-black">{card.label}</p>
                  <card.icon className="h-4 w-4 shrink-0 opacity-70" />
                </div>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <p className="text-xl font-black leading-none">
                    {card.value}
                  </p>
                  <span className="text-[11px] font-bold opacity-70">
                    {card.unit}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-4 opacity-75">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
          <section className="grid gap-4 lg:grid-cols-[1.05fr_1fr] print:hidden">
            <article className="soft-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-teal-950">
                    ملخص المدير
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    أهم ما يحتاج إلى متابعة الآن، بدل قراءة كل الأرقام يدويًا.
                  </p>
                </div>
                <FileBarChart className="h-5 w-5 text-teal-700" />
              </div>
              <div className="mt-4 space-y-2">
                {actionItems.length ? (
                  actionItems.map(item => (
                    <div
                      key={item.title}
                      className={`rounded-xl px-3 py-3 ${item.tone === "warning" ? "bg-amber-50 text-amber-950" : item.tone === "danger" ? "bg-rose-50 text-rose-950" : item.tone === "info" ? "bg-cyan-50 text-cyan-950" : "bg-slate-50 text-slate-900"}`}
                    >
                      <p className="text-sm font-black">{item.title}</p>
                      <p className="mt-1 text-xs opacity-75">{item.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl bg-emerald-50 px-3 py-4 text-sm font-bold text-emerald-900">
                    لا توجد بنود عاجلة في البيانات الحالية.
                  </div>
                )}
              </div>
            </article>
            <article className="soft-card p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-teal-950">
                    أين تتحرك الأموال؟
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    أعلى مصادر الدخل والمصروفات خلال الفترة المختارة.
                  </p>
                </div>
                <WalletCards className="h-5 w-5 text-teal-700" />
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 text-xs font-black text-emerald-800">
                    مصادر الدخل
                  </p>
                  {incomeBars.length ? (
                    incomeBars.map(row => (
                      <div key={`income-${row.label}`} className="mb-2">
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="max-w-[65%] truncate font-bold">
                            {row.label}
                          </span>
                          <span className="font-black text-emerald-800">
                            {money(row.total)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-emerald-100">
                          <div
                            className="h-2 rounded-full bg-emerald-500"
                            style={{
                              width: `${Math.max(5, Math.min(100, (row.total / incomeTotal) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      لا توجد إيرادات.
                    </p>
                  )}
                </div>
                <div>
                  <p className="mb-2 text-xs font-black text-amber-800">
                    أعلى المصروفات
                  </p>
                  {expenseBars.length ? (
                    expenseBars.map(row => (
                      <div key={`expense-${row.label}`} className="mb-2">
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="max-w-[65%] truncate font-bold">
                            {row.label}
                          </span>
                          <span className="font-black text-amber-800">
                            {money(row.total)}
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-amber-100">
                          <div
                            className="h-2 rounded-full bg-amber-500"
                            style={{
                              width: `${Math.max(5, Math.min(100, (row.total / expenseTotal) * 100))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      لا توجد مصروفات.
                    </p>
                  )}
                </div>
              </div>
            </article>
          </section>
          <section className="soft-card border border-cyan-200 bg-cyan-50/70 p-4 print:hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-black text-cyan-950">
                  مطابقة التقرير مع الخزنة
                </h2>
                <p className="mt-1 text-xs leading-5 text-cyan-900/80">
                  صافي الفترة = الإيرادات − المصروفات. رصيد الخزنة الفعلي يتأثر
                  بكل الحركات حتى الآن، لذلك قد يختلف عند اختيار فترة جزئية.
                </p>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-xs font-black ${reconciliationMatches ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}
              >
                {reconciliationMatches
                  ? "المعادلة متطابقة"
                  : "راجع الفترة المحددة"}
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <div className="rounded-lg bg-white/80 p-3">
                <p className="text-[11px] font-bold text-muted-foreground">
                  الإيرادات
                </p>
                <p className="mt-1 text-base font-black text-emerald-800">
                  {money(data.summary.income)}
                </p>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <p className="text-[11px] font-bold text-muted-foreground">
                  المصروفات
                </p>
                <p className="mt-1 text-base font-black text-amber-800">
                  {money(data.summary.expense)}
                </p>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <p className="text-[11px] font-bold text-muted-foreground">
                  صافي الفترة
                </p>
                <p className="mt-1 text-base font-black text-slate-900">
                  {money(periodReconciliation)}
                </p>
              </div>
              <div className="rounded-lg bg-white/80 p-3">
                <p className="text-[11px] font-bold text-muted-foreground">
                  رصيد الخزنة الحالي
                </p>
                <p className="mt-1 text-base font-black text-cyan-900">
                  {money(treasuryBalance)}
                </p>
              </div>
            </div>
          </section>
          <section className="soft-card p-4 print:hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-teal-950">ماذا تريد أن تعرف؟</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  اختر إجابة واحدة، وستظهر التفاصيل المرتبطة بها فقط.
                </p>
              </div>
              <span className="w-fit rounded-full bg-violet-50 px-3 py-1.5 text-xs font-black text-violet-900">
                {dateFrom && dateTo ? `الفترة: ${dateFrom} — ${dateTo}` : "حدد الفترة أولًا"}
              </span>
            </div>
            <nav aria-label="أقسام التقرير" className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <SectionButton active={reportSection === "overview"} onClick={() => setReportSection("overview")} description="أهم الأرقام والتنبيهات">
                ملخص الإدارة
              </SectionButton>
              <SectionButton active={reportSection === "treasury"} onClick={() => setReportSection("treasury")} description="ما دخل وخرج والصافي">
                الخزينة
              </SectionButton>
              <SectionButton active={reportSection === "financial"} onClick={() => setReportSection("financial")} description="المستحق والمدفوع لكل فني">
                الفنيون والرواتب
              </SectionButton>
              <SectionButton active={reportSection === "visits"} onClick={() => setReportSection("visits")} description="العملاء والزيارات والخدمات">
                العملاء والخدمات
              </SectionButton>
              <SectionButton active={reportSection === "inventory"} onClick={() => setReportSection("inventory")} description="الوارد والمنصرف والرصيد">
                المخزون
              </SectionButton>
              <SectionButton active={reportSection === "all"} onClick={() => setReportSection("all")} description="عرض كل الأقسام معًا">
                كل التفاصيل
              </SectionButton>
            </nav>
          </section>
          <div className="hidden border-b pb-4 print:block">
            <h1 className="text-2xl font-black">تقرير نقطة نقاء</h1>
            <p className="mt-2 text-sm">
              الفترة: {dateLabel(`${data.period.dateFrom}T00:00:00`)} —{" "}
              {dateLabel(`${data.period.dateTo}T00:00:00`)}
            </p>
          </div>
          {show("treasury") ? (
            <section className="soft-card overflow-hidden p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-black text-teal-950">
                    تقرير حركات الخزينة
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    تُطبّق الفترة العامة للتقرير مع الفلاتر التالية، وتُعاد حساب
                    الإيرادات والمصروفات والصافي والحركات الظاهرة.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg text-xs"
                    onClick={() => setShowTreasuryFilters(value => !value)}
                  >
                    {showTreasuryFilters ? "إخفاء الفلاتر" : "فلاتر متقدمة"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 rounded-lg text-xs"
                    onClick={() => {
                      setTreasuryTechnician("");
                      setTreasuryType("all");
                      setTreasuryCategory("");
                    }}
                  >
                    إعادة ضبط
                  </Button>
                </div>
              </div>
              {showTreasuryFilters ? <div className="grid gap-3 rounded-2xl bg-teal-50/60 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="field-label" htmlFor="treasury-technician">
                    الفني
                  </label>
                  <select
                    id="treasury-technician"
                    className="field-input mt-1"
                    value={treasuryTechnician}
                    onChange={event =>
                      setTreasuryTechnician(event.target.value)
                    }
                  >
                    <option value="">كل الفنيين</option>
                    {treasury.availableTechnicians.map((name: string) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="treasury-type">
                    نوع الحركة
                  </label>
                  <select
                    id="treasury-type"
                    className="field-input mt-1"
                    value={treasuryType}
                    onChange={event =>
                      setTreasuryType(
                        event.target.value as "all" | "income" | "expense"
                      )
                    }
                  >
                    <option value="all">كل الحركات</option>
                    <option value="income">إيرادات فقط</option>
                    <option value="expense">مصروفات فقط</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="treasury-category">
                    التصنيف
                  </label>
                  <select
                    id="treasury-category"
                    className="field-input mt-1"
                    value={treasuryCategory}
                    onChange={event => setTreasuryCategory(event.target.value)}
                  >
                    <option value="">كل التصنيفات</option>
                    {treasury.availableCategories.map((category: string) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <div className="w-full rounded-xl bg-white px-3 py-2.5 text-sm font-bold text-teal-950">
                    الفترة: {dateFrom} — {dateTo}
                  </div>
                </div>
              </div> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 rounded-lg text-xs"
                  onClick={exportTreasuryPdf}
                >
                  <Download className="ml-2 h-4 w-4" />
                  تصدير معاملات PDF
                </Button>
                <Button
                  type="button"
                  className="h-9 rounded-lg bg-teal-700 text-xs hover:bg-teal-800"
                  onClick={exportTreasuryExcel}
                >
                  <Download className="ml-2 h-4 w-4" />
                  تصدير معاملات Excel
                </Button>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                <Metric
                  label="إيرادات الحركات"
                  value={money(treasury.incomeTotal)}
                />
                <Metric
                  label="مصروفات الحركات"
                  value={money(treasury.expenseTotal)}
                />
                <Metric
                  label="صافي الحركات"
                  helper={`${number(treasuryTransactions.length)} حركة بعد الفلترة`}
                  value={money(treasury.balance)}
                />
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-[760px] text-right text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3">التاريخ</th>
                      <th className="px-3 py-3">النوع</th>
                      <th className="px-3 py-3">التصنيف</th>
                      <th className="px-3 py-3">الفني / المستلم</th>
                      <th className="px-3 py-3">المبلغ</th>
                      <th className="px-3 py-3">الملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {treasuryTransactions.length ? (
                      treasuryTransactions.map((row: any) => (
                        <tr key={row.id}>
                          <td className="px-3 py-3">
                            {dateLabel(row.transactionDate)}
                          </td>
                          <td
                            className={`px-3 py-3 font-bold ${row.transactionType === "income" ? "text-emerald-700" : "text-amber-700"}`}
                          >
                            {row.transactionType === "income"
                              ? "إيراد"
                              : "مصروف"}
                          </td>
                          <td className="px-3 py-3">
                            {row.category || "غير مصنف"}
                          </td>
                          <td className="px-3 py-3 font-bold">
                            {row.recipientName || "غير محدد"}
                          </td>
                          <td className="px-3 py-3 font-black">
                            {money(row.amount)}
                          </td>
                          <td className="max-w-[260px] truncate px-3 py-3 text-muted-foreground">
                            {row.notes || "—"}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-muted-foreground"
                        >
                          لا توجد حركات مطابقة للفلاتر الحالية.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
          {show("financial") ? (
            <>
              <section className="soft-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-black">الملخص المالي للشركة</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      يعرض التقرير الافتراضي كل السجل حتى اليوم، ويمكنك تغيير
                      الفترة للمقارنة مع يوم أو شهر محدد.
                    </p>
                  </div>
                  <WalletCards className="h-5 w-5 text-teal-700" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Metric
                    label="إيرادات الخدمات"
                    value={money(financial.serviceIncome)}
                  />
                  <Metric
                    label="نقدية خارج إيرادات العمل"
                    value={money(financial.externalIncome)}
                  />
                  <Metric
                    label="إجمالي الداخل"
                    value={money(financial.totalIncome)}
                  />
                  <Metric
                    label="إجمالي المستحق للفنيين"
                    value={money(financial.technicianRequired)}
                  />
                  <Metric
                    label="إجمالي ما استلمه الفنيون"
                    value={money(financial.technicianPayments)}
                  />
                  <Metric
                    label="إجمالي المتبقي للفنيين"
                    value={money(financial.technicianRemaining)}
                  />
                  <Metric
                    label="البنزين"
                    helper="مصروف تشغيل وتنقل"
                    value={money(financial.gasolineExpenses)}
                  />
                  <Metric
                    label="مشتريات المخزن"
                    helper="تكلفة شراء الأصناف"
                    value={money(financial.inventoryPurchaseExpenses)}
                  />
                  <Metric
                    label="المصروفات العامة"
                    helper="مصروفات تشغيل غير مصنفة كراتب"
                    value={money(financial.generalExpenses)}
                  />
                  <Metric
                    label="مصروفات أخرى"
                    helper="أخرى أو غير مصنفة"
                    value={money(financial.uncategorizedExpenses)}
                  />
                  <Metric
                    label="إجمالي غير الرواتب"
                    helper="بنزين ومشتريات ومصروفات أخرى"
                    value={money(financial.otherExpenses)}
                  />
                  <Metric
                    label="صافي الشركة للفترة"
                    helper="إجمالي الداخل ناقص كل مصروفات الفترة"
                    value={money(financial.companyNet)}
                  />
                  <Metric
                    label="رصيد الخزنة الفعلي"
                    helper="من جميع الحركات المسجلة حتى الآن"
                    value={money(data.summary.treasuryBalance ?? 0)}
                  />
                </div>
              </section>
              <section className="soft-card overflow-hidden p-5">
                <div className="mb-4">
                  <h2 className="font-black">كشف راتب الفنيين</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    المستحق والمدفوع والمتبقي لكل فني خلال الفترة المحددة.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-right text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">الفني</th>
                        <th className="px-3 py-3">الحالة</th>
                        <th className="px-3 py-3">المستحق</th>
                        <th className="px-3 py-3">المدفوع</th>
                        <th className="px-3 py-3">المتبقي</th>
                        <th className="px-3 py-3">العمليات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {safeTechnicianPayments.length ? (
                        safeTechnicianPayments.map(row => (
                          <tr key={row.technician}>
                            <td className="px-3 py-3 font-bold">
                              {row.technician}
                            </td>
                            <td
                              className={`px-3 py-3 font-bold ${row.status === "paid" ? "text-emerald-700" : "text-amber-700"}`}
                            >
                              {row.status === "paid" ? "مدفوع" : "متبقي"}
                            </td>
                            <td className="px-3 py-3">
                              {money(row.requiredAmount)}
                            </td>
                            <td className="px-3 py-3 font-black text-teal-800">
                              {money(row.totalPaid)}
                            </td>
                            <td className="px-3 py-3 font-black text-amber-700">
                              {money(row.remainingAmount)}
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span>{number(row.transactionCount)}</span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  className="h-8 rounded-lg px-2 text-xs"
                                  onClick={() => exportTechnicianPdf(row)}
                                >
                                  <Download className="ml-1 h-3.5 w-3.5" />
                                  PDF الفني
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="p-8 text-center text-muted-foreground"
                          >
                            لا توجد مستحقات أو مدفوعات فنيين في هذه الفترة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
          {show("visits") ? (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <ReportList
                  title="الإيرادات حسب البند"
                  rows={incomeByCategory}
                  moneyRows
                />
                <ReportList
                  title="المصروفات حسب البند"
                  rows={data.expenseByCategory}
                  moneyRows
                />
                <ReportList
                  title="الزيارات حسب النوع"
                  rows={safeVisitsByType.map(row => ({
                    ...row,
                    label: labelVisitType(row.label),
                  }))}
                />
                <ReportList
                  title="الزيارات حسب الفني"
                  rows={data.visitsByTechnician}
                />
              </div>
              <section className="soft-card overflow-hidden p-5">
                <h2 className="font-black">آخر الزيارات في الفترة</h2>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[620px] text-right text-sm">
                    <thead className="border-b text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-3">التاريخ</th>
                        <th className="px-3 py-3">العميل</th>
                        <th className="px-3 py-3">نوع الزيارة</th>
                        <th className="px-3 py-3">الفني</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {safeRecentVisits.length ? (
                        safeRecentVisits.map((visit, index) => (
                          <tr key={`${visit.customer}-${index}`}>
                            <td className="px-3 py-3">
                              {dateLabel(visit.date)}
                            </td>
                            <td className="px-3 py-3 font-bold">
                              {visit.customer}
                            </td>
                            <td className="px-3 py-3">
                              {labelVisitType(visit.type)}
                            </td>
                            <td className="px-3 py-3">{visit.technician}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-8 text-center text-muted-foreground"
                          >
                            لا توجد زيارات في هذه الفترة.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          ) : null}
          {show("inventory") ? (
            <section className="soft-card p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-black">ملخص المخزون</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    الحركة خلال الفترة والرصيد الحالي.
                  </p>
                </div>
                <PackageSearch className="h-5 w-5 text-teal-700" />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <InventoryMetric
                  label="إجمالي الوارد"
                  hint="الكميات التي دخلت المخزن خلال الفترة"
                  value={number(data.inventory.incomingQuantity)}
                  tone="incoming"
                />
                <InventoryMetric
                  label="إجمالي المنصرف"
                  hint="الكميات التي خرجت من المخزن خلال الفترة"
                  value={number(data.inventory.outgoingQuantity)}
                  tone="outgoing"
                />
                <InventoryMetric
                  label="قيمة المشتريات"
                  hint="إجمالي تكلفة الأصناف المشتراة"
                  value={money(data.inventory.purchaseCost)}
                  tone="cost"
                />
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {inventoryItems.map(item => (
                  <div
                    key={item.name}
                    className="rounded-xl bg-teal-50/60 p-3 text-sm"
                  >
                    <span className="font-bold">{item.name}</span>
                    <span className="mr-2 text-muted-foreground">
                      {number(item.currentBalance)}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section
            className={`soft-card p-5 ${showAllDetails ? "" : "print:hidden"}`}
          >
            <h2 className="font-black">ملاحظات التقرير</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              استخدم تبويبات الأقسام لعرض التفاصيل المطلوبة بسرعة، أو اختر «كل
              التفاصيل» لعرض التقرير الكامل.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function SectionButton({
  active,
  onClick,
  children,
  description,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-[76px] rounded-xl px-4 py-3 text-right transition-colors ${active ? "bg-teal-700 text-white shadow-sm" : "bg-teal-50 text-teal-900 hover:bg-teal-100"}`}
    >
      <span className="block text-sm font-black">{children}</span>
      <span className={`mt-1 block text-[11px] leading-4 ${active ? "text-white/75" : "text-teal-900/65"}`}>
        {description}
      </span>
    </button>
  );
}
function Metric({
  label,
  helper,
  value,
}: {
  label: string;
  helper?: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-teal-950/8 bg-white px-3 py-2.5">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-black text-teal-950">{value} </p>
      <p className="mt-1 text-[10px] leading-4 text-muted-foreground">
        {helper ?? "إجمالي خلال الفترة المحددة"}
      </p>
    </div>
  );
}
function InventoryMetric({
  label,
  hint,
  value,
  tone,
}: {
  label: string;
  hint: string;
  value: string;
  tone: "incoming" | "outgoing" | "cost";
}) {
  const styles = {
    incoming: "border-teal-200 bg-teal-50 text-teal-950",
    outgoing: "border-amber-200 bg-amber-50 text-amber-950",
    cost: "border-violet-200 bg-violet-50 text-violet-950",
  }[tone];
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-xs font-bold opacity-75">{label}</p>
      <p className="mt-2 text-lg font-black">{value}</p>
      <p className="mt-1 text-[11px] leading-5 opacity-70">{hint}</p>
    </div>
  );
}
function ReportList({
  title,
  rows,
  moneyRows = false,
}: {
  title: string;
  rows: Array<{ label: string; total: number }>;
  moneyRows?: boolean;
}) {
  return (
    <section className="soft-card p-5">
      <h2 className="font-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length ? (
          rows.map(row => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-xl bg-teal-50/55 px-4 py-3 text-sm"
            >
              <span className="font-bold">{row.label}</span>
              <span className="font-black text-teal-800">
                {moneyRows ? money(row.total) : number(row.total)}
              </span>
            </div>
          ))
        ) : (
          <p className="py-5 text-sm text-muted-foreground">
            لا توجد بيانات في هذه الفترة.
          </p>
        )}
      </div>
    </section>
  );
}
