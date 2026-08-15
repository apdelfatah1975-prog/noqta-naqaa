export const cashTransactionTypes = ["income", "expense"] as const;
export type CashTransactionType = (typeof cashTransactionTypes)[number];

export const cashCurrencies = ["EGP", "SAR"] as const;
export type CashCurrency = (typeof cashCurrencies)[number];

export type CashTransactionForSummary = {
  transactionType: CashTransactionType;
  amount: number;
  category?: string | null;
  currency?: CashCurrency | null;
};

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
    EGP: calculateCashSummary(transactions.filter(transaction => !transaction.currency || transaction.currency === "EGP")),
    SAR: calculateCashSummary(transactions.filter(transaction => transaction.currency === "SAR")),
  } satisfies Record<CashCurrency, CashSummary>;
}

export type CashBreakdownRow = { category: string; total: number };
export type CashBreakdown = Record<CashCurrency, { income: CashBreakdownRow[]; expense: CashBreakdownRow[] }>;

export function calculateCashBreakdown(transactions: CashTransactionForSummary[]): CashBreakdown {
  const result: CashBreakdown = { EGP: { income: [], expense: [] }, SAR: { income: [], expense: [] } };
  for (const transaction of transactions) {
    const currency: CashCurrency = transaction.currency === "SAR" ? "SAR" : "EGP";
    const type = transaction.transactionType === "income" ? "income" : "expense";
    const category = transaction.category?.trim() || "غير مصنف";
    const current = result[currency][type].find(row => row.category === category);
    if (current) current.total += transaction.amount;
    else result[currency][type].push({ category, total: transaction.amount });
  }
  for (const currency of cashCurrencies) {
    result[currency].income.sort((a, b) => b.total - a.total);
    result[currency].expense.sort((a, b) => b.total - a.total);
  }
  return result;
}

export function currencyLabel(currency: CashCurrency | null | undefined) {
  return currency === "SAR" ? "ريال سعودي" : "جنيه مصري";
}

export function currencySymbol(currency: CashCurrency | null | undefined) {
  return currency === "SAR" ? "ر.س" : "ج.م";
}
