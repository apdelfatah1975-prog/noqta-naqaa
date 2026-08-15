import { describe, expect, it } from "vitest";
import { calculateCashSummaries, calculateCashSummary } from "./cashBusiness";

describe("calculateCashSummary", () => {
  it("يجمع الإيرادات والمصروفات ويحسب رصيد الخزينة", () => {
    expect(calculateCashSummary([
      { transactionType: "income", amount: 1000 },
      { transactionType: "expense", amount: 250 },
      { transactionType: "income", amount: 400 },
    ])).toEqual({ incomeTotal: 1400, expenseTotal: 250, balance: 1150 });
  });
});

describe("calculateCashSummaries", () => {
  it("يفصل إجماليات الجنيه المصري والريال السعودي دون خلط العملات", () => {
    expect(calculateCashSummaries([
      { transactionType: "income", amount: 1000 },
      { transactionType: "expense", amount: 250, currency: "EGP" },
      { transactionType: "income", amount: 400, currency: "SAR" },
      { transactionType: "expense", amount: 100, currency: "SAR" },
    ])).toEqual({
      EGP: { incomeTotal: 1000, expenseTotal: 250, balance: 750 },
      SAR: { incomeTotal: 400, expenseTotal: 100, balance: 300 },
    });
  });
});

