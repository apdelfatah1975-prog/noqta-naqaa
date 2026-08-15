export const cashTransactionTypes = ["income", "expense"] as const;
export type CashTransactionType = (typeof cashTransactionTypes)[number];

export const cashCurrencies = ["EGP", "SAR"] as const;
export type CashCurrency = (typeof cashCurrencies)[number];

export type CashTransactionForSummary = {
  transactionType: CashTransactionType;
  amount: number;
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

export function currencyLabel(currency: CashCurrency | null | undefined) {
  return currency === "SAR" ? "ريال سعودي" : "جنيه مصري";
}

export function currencySymbol(currency: CashCurrency | null | undefined) {
  return currency === "SAR" ? "ر.س" : "ج.م";
}
