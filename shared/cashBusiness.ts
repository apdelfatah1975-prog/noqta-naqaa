export const cashTransactionTypes = ["income", "expense"] as const;
export type CashTransactionType = (typeof cashTransactionTypes)[number];

export type CashTransactionForSummary = {
  transactionType: CashTransactionType;
  amount: number;
};

export function calculateCashSummary(transactions: CashTransactionForSummary[]) {
  const incomeTotal = transactions
    .filter(transaction => transaction.transactionType === "income")
    .reduce((total, transaction) => total + transaction.amount, 0);
  const expenseTotal = transactions
    .filter(transaction => transaction.transactionType === "expense")
    .reduce((total, transaction) => total + transaction.amount, 0);
  return { incomeTotal, expenseTotal, balance: incomeTotal - expenseTotal };
}
