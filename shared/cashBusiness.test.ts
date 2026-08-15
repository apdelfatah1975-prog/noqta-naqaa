import { describe, expect, it } from "vitest";
import { calculateCashBreakdown, calculateCashSummaries, calculateCashSummary, matchesCashTransactionSearch, primaryCashCurrency } from "./cashBusiness";

describe("matchesCashTransactionSearch", () => {
  it("يبحث باسم العميل أو الملاحظات مع تجاهل حالة الأحرف والمسافات", () => {
    const transaction = { recipientName: "محمد أحمد", notes: "صيانة دورية للمطبخ", category: "تحصيل صيانة" };
    expect(matchesCashTransactionSearch(transaction, "محمد")).toBe(true);
    expect(matchesCashTransactionSearch(transaction, "دورية")).toBe(true);
    expect(matchesCashTransactionSearch(transaction, "تركيب")).toBe(false);
    expect(matchesCashTransactionSearch(transaction, "   ")).toBe(true);
  });
});

describe("primaryCashCurrency", () => {
  it("يعتمد الريال السعودي كعملة أساسية", () => {
    expect(primaryCashCurrency).toBe("SAR");
  });
});

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

describe("calculateCashBreakdown", () => {
  it("يجمع كل بند إيراد ومصروف بشكل مستقل مع فصل العملات", () => {
    expect(calculateCashBreakdown([
      { transactionType: "income", amount: 150000, category: "تحصيل تركيب", currency: "EGP" },
      { transactionType: "income", amount: 50000, category: "تحصيل تركيب", currency: "EGP" },
      { transactionType: "income", amount: 80000, category: "تحصيل صيانة", currency: "EGP" },
      { transactionType: "expense", amount: 20000, category: "بنزين", currency: "EGP" },
      { transactionType: "expense", amount: 10000, category: "بنزين", currency: "EGP" },
      { transactionType: "expense", amount: 1000, category: "بنزين", currency: "SAR", recipientName: "الفني أحمد" },
    ])).toEqual({
      EGP: { income: [{ category: "تحصيل تركيب", total: 200000 }, { category: "تحصيل صيانة", total: 80000 }], expense: [{ category: "بنزين", total: 30000 }], analytics: { installationIncome: 200000, serviceIncome: 80000, expenseByCategory: [{ category: "بنزين", total: 30000 }], technicianExpenses: [] } },
      SAR: { income: [], expense: [{ category: "بنزين", total: 1000 }], analytics: { installationIncome: 0, serviceIncome: 0, expenseByCategory: [{ category: "بنزين", total: 1000 }], technicianExpenses: [{ technician: "الفني أحمد", total: 1000 }] } },
    });
  });
});

