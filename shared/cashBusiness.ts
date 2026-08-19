export const cashTransactionTypes = ["income", "expense"] as const;
export type CashTransactionType = (typeof cashTransactionTypes)[number];

export const cashCurrencies = ["SAR"] as const;
export const primaryCashCurrency: CashCurrency = "SAR";
export type CashCurrency = (typeof cashCurrencies)[number];

export type CashTransactionForSummary = {
  transactionType: CashTransactionType;
  amount: number;
  category?: string | null;
  currency?: CashCurrency | null;
  recipientName?: string | null;
};

export type CashTransactionForSearch = {
  recipientName?: string | null;
  notes?: string | null;
  category?: string | null;
};

export function matchesCashTransactionSearch(transaction: CashTransactionForSearch, search?: string) {
  const query = search?.trim().toLocaleLowerCase("ar") ?? "";
  if (!query) return true;
  return [transaction.recipientName, transaction.notes, transaction.category]
    .filter(Boolean)
    .some(value => value!.toLocaleLowerCase("ar").includes(query));
}

export type CashSummary = {
  incomeTotal: number;
  expenseTotal: number;
  balance: number;
};

export function calculateCashSummary(transactions: CashTransactionForSummary[]): CashSummary {
  const incomeTotal = transactions
    .filter(transaction => transaction.transactionType === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expenseTotal = transactions
    .filter(transaction => transaction.transactionType === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);
  return { incomeTotal, expenseTotal, balance: incomeTotal - expenseTotal };
}

export function calculateCashSummaries(transactions: CashTransactionForSummary[]) {
  return {
    SAR: calculateCashSummary(transactions.filter(transaction => !transaction.currency || transaction.currency === "SAR")),
  } satisfies Record<CashCurrency, CashSummary>;
}

export function calculateCashSummaryThroughDate(
  transactions: Array<CashTransactionForSummary & { transactionDate?: Date | string | null }>,
  endDate?: string,
) {
  if (!endDate) return calculateCashSummary(transactions);
  return calculateCashSummary(
    transactions.filter(transaction => {
      if (!transaction.transactionDate) return false;
      const date = new Date(transaction.transactionDate);
      return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) <= endDate;
    }),
  );
}

export type CashBreakdownRow = { category: string; total: number };
export type CashTechnicianRow = { technician: string; total: number };
export type PurchaseBreakdownRow = { itemName: string; quantity: number; total: number; averageUnitCost: number };
export type PurchaseBreakdown = Record<CashCurrency, { total: number; items: PurchaseBreakdownRow[] }>;
export type CashAnalytics = {
  installationIncome: number;
  serviceIncome: number;
  externalIncome: number;
  expenseByCategory: CashBreakdownRow[];
  technicianExpenses: CashTechnicianRow[];
};

export type TechnicianPaymentRow = { technician: string; requiredAmount: number; totalPaid: number; salaryPaidAmount: number; remainingAmount: number; status: "paid" | "remaining"; transactionCount: number };

export type CompanyFinancialOverview = {
  serviceIncome: number;
  externalIncome: number;
  totalIncome: number;
  technicianPayments: number;
  technicianRequired: number;
  technicianRemaining: number;
  otherExpenses: number;
  gasolineExpenses: number;
  inventoryPurchaseExpenses: number;
  generalExpenses: number;
  uncategorizedExpenses: number;
  companyNet: number;
  technicianPaymentsByName: TechnicianPaymentRow[];
};

export const externalIncomeCategory = "نقدية خارج إيرادات العمل";
export const technicianPaymentCategories = ["راتب فني", "دفعة راتب فني", "مستحق فني", "سلفة فني", "مصروف فني"] as const;
export type CashBreakdown = Record<CashCurrency, { income: CashBreakdownRow[]; expense: CashBreakdownRow[]; analytics: CashAnalytics }>;

function addToRows(rows: CashBreakdownRow[], category: string, amount: number) {
  const current = rows.find(row => row.category === category);
  if (current) current.total += amount;
  else rows.push({ category, total: amount });
}

function addToTechnicians(rows: CashTechnicianRow[], technician: string, amount: number) {
  const current = rows.find(row => row.technician === technician);
  if (current) current.total += amount;
  else rows.push({ technician, total: amount });
}

export function calculatePurchaseBreakdown(movements: Array<{ itemName?: string | null; movementType: "incoming" | "outgoing"; quantity: number; unitCost?: number | null; currency?: CashCurrency | null }>): PurchaseBreakdown {
  const result: PurchaseBreakdown = {
    SAR: { total: 0, items: [] },
  };
  for (const movement of movements) {
    const unitCost = movement.unitCost ?? 0;
    if (movement.movementType !== "incoming" || unitCost <= 0) continue;
    const currency: CashCurrency = "SAR";
    const itemName = movement.itemName?.trim() || "صنف غير معروف";
    const amount = movement.quantity * unitCost;
    const current = result[currency];
    current.total += amount;
    const row = current.items.find(item => item.itemName === itemName);
    if (row) {
      row.quantity += movement.quantity;
      row.total += amount;
      row.averageUnitCost = row.total / row.quantity;
    } else {
      current.items.push({ itemName, quantity: movement.quantity, total: amount, averageUnitCost: unitCost });
    }
  }
  for (const currency of cashCurrencies) {
    result[currency].items.sort((a, b) => b.total - a.total);
  }
  return result;
}

export function calculateCashBreakdown(transactions: CashTransactionForSummary[]): CashBreakdown {
  const result: CashBreakdown = {
    SAR: { income: [], expense: [], analytics: { installationIncome: 0, serviceIncome: 0, externalIncome: 0, expenseByCategory: [], technicianExpenses: [] } },
  };
  for (const transaction of transactions) {
    const currency: CashCurrency = "SAR";
    const category = transaction.category?.trim() || "غير مصنف";
    const current = result[currency];
    if (transaction.transactionType === "income") {
      addToRows(current.income, category, transaction.amount);
      if (category === "تحصيل تركيب") current.analytics.installationIncome += transaction.amount;
      if (category === "تحصيل صيانة") current.analytics.serviceIncome += transaction.amount;
      if (category === externalIncomeCategory) current.analytics.externalIncome += transaction.amount;
    } else {
      addToRows(current.expense, category, transaction.amount);
      addToRows(current.analytics.expenseByCategory, category, transaction.amount);
      const technician = transaction.recipientName?.trim();
      if (technician) addToTechnicians(current.analytics.technicianExpenses, technician, transaction.amount);
    }
  }
  for (const currency of cashCurrencies) {
    result[currency].income.sort((a, b) => b.total - a.total);
    result[currency].expense.sort((a, b) => b.total - a.total);
    result[currency].analytics.expenseByCategory.sort((a, b) => b.total - a.total);
    result[currency].analytics.technicianExpenses.sort((a, b) => b.total - a.total);
  }
  return result;
}

export function calculateCompanyFinancialOverview(transactions: Array<CashTransactionForSummary & { transactionDate?: string | Date | null }>): CompanyFinancialOverview {
  const serviceCategories = new Set(["تحصيل تركيب", "تحصيل صيانة", "تحصيل تغيير شمعات", "تحصيل زيارة"]);
  const technicianCategories = new Set<string>(technicianPaymentCategories);
  let serviceIncome = 0;
  let externalIncome = 0;
  let totalIncome = 0;
  let technicianPayments = 0;
  let technicianRequired = 0;
  let otherExpenses = 0;
  let gasolineExpenses = 0;
  let inventoryPurchaseExpenses = 0;
  let generalExpenses = 0;
  let uncategorizedExpenses = 0;
  const technicianMap = new Map<string, TechnicianPaymentRow>();
  for (const transaction of transactions) {
    const category = transaction.category?.trim() || "غير مصنف";
    if (transaction.transactionType === "income") {
      totalIncome += transaction.amount;
      if (category === externalIncomeCategory) externalIncome += transaction.amount;
      else if (serviceCategories.has(category)) serviceIncome += transaction.amount;
    } else if (technicianCategories.has(category) || Boolean(transaction.recipientName?.trim() && category.includes("فني"))) {
      const technician = transaction.recipientName?.trim() || "فني غير محدد";
      const current = technicianMap.get(technician) ?? { technician, requiredAmount: 0, totalPaid: 0, salaryPaidAmount: 0, remainingAmount: 0, status: "paid" as const, transactionCount: 0 };
      if (category === "مستحق فني") {
        technicianRequired += transaction.amount;
        current.requiredAmount += transaction.amount;
      } else {
        technicianPayments += transaction.amount;
        current.totalPaid += transaction.amount;
      }
      current.remainingAmount = Math.max(current.requiredAmount - current.totalPaid, 0);
      current.status = current.remainingAmount > 0 ? "remaining" : "paid";
      current.transactionCount += 1;
      if (category === "راتب فني" || category === "دفعة راتب فني" || category === "سلفة فني") current.salaryPaidAmount += transaction.amount;
      technicianMap.set(technician, current);
    } else {
      otherExpenses += transaction.amount;
      if (category === "بنزين") gasolineExpenses += transaction.amount;
      else if (category === "شراء بضاعة" || category.startsWith("شراء مخزون -")) inventoryPurchaseExpenses += transaction.amount;
      else if (category === "مصروف عام") generalExpenses += transaction.amount;
      else if (category === "أخرى" || category === "غير مصنف") uncategorizedExpenses += transaction.amount;
    }
  }
  const technicianPaymentsByName = Array.from(technicianMap.values()).sort((a, b) => b.remainingAmount - a.remainingAmount || b.requiredAmount - a.requiredAmount || b.totalPaid - a.totalPaid);
  const technicianRemaining = technicianPaymentsByName.reduce((total, row) => total + row.remainingAmount, 0);
  const totalExpenses = technicianPayments + otherExpenses;
  return { serviceIncome, externalIncome, totalIncome, technicianPayments, technicianRequired, technicianRemaining, otherExpenses, gasolineExpenses, inventoryPurchaseExpenses, generalExpenses, uncategorizedExpenses, companyNet: totalIncome - totalExpenses, technicianPaymentsByName };
}

export function currencyLabel(currency: CashCurrency | null | undefined) {
  return "ريال سعودي";
}

export function currencySymbol(currency: CashCurrency | null | undefined) {
  return "ر.س";
}
