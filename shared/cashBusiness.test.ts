import { describe, expect, it } from "vitest";
import { calculateCashBreakdown, calculateCashSummaries, calculateCashSummary, calculateCompanyFinancialOverview, matchesCashTransactionSearch, primaryCashCurrency } from "./cashBusiness";

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
  it("يجمع إجماليات الريال السعودي فقط دون خلط العملات", () => {
    expect(calculateCashSummaries([
      { transactionType: "income", amount: 1000, currency: "SAR" },
      { transactionType: "expense", amount: 250, currency: "SAR" },
      { transactionType: "income", amount: 400, currency: "SAR" },
      { transactionType: "expense", amount: 100, currency: "SAR" },
    ])).toEqual({
      SAR: { incomeTotal: 1400, expenseTotal: 350, balance: 1050 },
    });
  });
});

describe("calculateCashBreakdown", () => {
  it("يجمع كل بند إيراد ومصروف بشكل مستقل بالريال السعودي", () => {
    expect(calculateCashBreakdown([
      { transactionType: "income", amount: 150000, category: "تحصيل تركيب", currency: "SAR" },
      { transactionType: "income", amount: 50000, category: "تحصيل تركيب", currency: "SAR" },
      { transactionType: "income", amount: 80000, category: "تحصيل صيانة", currency: "SAR" },
      { transactionType: "expense", amount: 20000, category: "بنزين", currency: "SAR" },
      { transactionType: "expense", amount: 10000, category: "بنزين", currency: "SAR" },
      { transactionType: "expense", amount: 1000, category: "بنزين", currency: "SAR", recipientName: "الفني أحمد" },
    ])).toEqual({
      SAR: { income: [{ category: "تحصيل تركيب", total: 200000 }, { category: "تحصيل صيانة", total: 80000 }], expense: [{ category: "بنزين", total: 31000 }], analytics: { installationIncome: 200000, serviceIncome: 80000, externalIncome: 0, expenseByCategory: [{ category: "بنزين", total: 31000 }], technicianExpenses: [{ technician: "الفني أحمد", total: 1000 }] } },
    });
  });
});


describe("calculateCompanyFinancialOverview", () => {
  it("يفصل إيراد الخدمات عن النقدية الخارجية ويجمع مدفوعات الفنيين وصافي الشركة", () => {
    expect(calculateCompanyFinancialOverview([
      { transactionType: "income", amount: 100000, category: "تحصيل صيانة" },
      { transactionType: "income", amount: 25000, category: "نقدية خارج إيرادات العمل" },
      { transactionType: "expense", amount: 50000, category: "مستحق فني", recipientName: "أحمد" },
      { transactionType: "expense", amount: 30000, category: "راتب فني", recipientName: "أحمد" },
      { transactionType: "expense", amount: 10000, category: "بنزين" },
    ])).toEqual({
      serviceIncome: 100000,
      externalIncome: 25000,
      totalIncome: 125000,
      technicianPayments: 30000,
      technicianRequired: 50000,
      technicianRemaining: 20000,
      otherExpenses: 10000,
      companyNet: 85000,
      technicianPaymentsByName: [{ technician: "أحمد", requiredAmount: 50000, totalPaid: 30000, remainingAmount: 20000, status: "remaining", transactionCount: 2 }],
    });
  });
});

describe("حالة راتب الفني", () => {
  it("يعرض مدفوعًا عندما يساوي المدفوع أو يتجاوز المستحق", () => {
    const result = calculateCompanyFinancialOverview([
      { transactionType: "expense", amount: 40000, category: "مستحق فني", recipientName: "محمود" },
      { transactionType: "expense", amount: 40000, category: "راتب فني", recipientName: "محمود" },
    ]);
    expect(result.technicianPaymentsByName[0]).toMatchObject({ technician: "محمود", requiredAmount: 40000, totalPaid: 40000, remainingAmount: 0, status: "paid" });
  });
});
