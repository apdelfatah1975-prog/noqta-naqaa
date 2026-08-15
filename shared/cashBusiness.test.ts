import { describe, expect, it } from "vitest";
import { calculateCashSummary } from "./cashBusiness";

describe("calculateCashSummary", () => {
  it("يجمع الإيرادات والمصروفات ويحسب رصيد الخزينة", () => {
    expect(calculateCashSummary([
      { transactionType: "income", amount: 1000 },
      { transactionType: "expense", amount: 250 },
      { transactionType: "income", amount: 400 },
    ])).toEqual({ incomeTotal: 1400, expenseTotal: 250, balance: 1150 });
  });
});

