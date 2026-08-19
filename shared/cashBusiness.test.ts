import { describe, expect, it } from "vitest";
import { calculateCashBreakdown, calculateCashSummaries, calculateCashSummary, calculateCashSummaryThroughDate, calculateCompanyFinancialOverview, matchesCashTransactionSearch, primaryCashCurrency } from "./cashBusiness";

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

describe("calculateCashSummaryThroughDate", () => {
  it("يحسب الرصيد التراكمي حتى نهاية اليوم المحدد دون حركات الأيام اللاحقة", () => {
    expect(calculateCashSummaryThroughDate([
      { transactionType: "income", amount: 15230, transactionDate: "2026-08-10T10:00:00.000Z" },
      { transactionType: "expense", amount: 4437, transactionDate: "2026-08-10T12:00:00.000Z" },
      { transactionType: "income", amount: 9000, transactionDate: "2026-08-11T09:00:00.000Z" },
    ], "2026-08-10")).toEqual({ incomeTotal: 15230, expenseTotal: 4437, balance: 10793 });
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
      gasolineExpenses: 10000,
      inventoryPurchaseExpenses: 0,
      generalExpenses: 0,
      uncategorizedExpenses: 0,
      companyNet: 85000,
      technicianPaymentsByName: [{ technician: "أحمد", requiredAmount: 50000, totalPaid: 30000, salaryPaidAmount: 30000, remainingAmount: 20000, status: "remaining", transactionCount: 2 }],
    });
  });
});

describe("تفصيل تكاليف التشغيل", () => {
  it("يفصل البنزين ومشتريات المخزن والمصروفات العامة دون تكرار", () => {
    const result = calculateCompanyFinancialOverview([
      { transactionType: "income", amount: 200000, category: "تحصيل صيانة" },
      { transactionType: "expense", amount: 12000, category: "بنزين" },
      { transactionType: "expense", amount: 35000, category: "شراء بضاعة" },
      { transactionType: "expense", amount: 8000, category: "مصروف عام" },
      { transactionType: "expense", amount: 5000, category: "أخرى" },
    ]);
    expect(result).toMatchObject({ gasolineExpenses: 12000, inventoryPurchaseExpenses: 35000, generalExpenses: 8000, uncategorizedExpenses: 5000, otherExpenses: 60000, companyNet: 140000 });
  });
});

describe("الدفعة الموحدة وسلفة الفني", () => {
  it("تدخلان معًا في مدفوعات الفني وتؤثران في المتبقي مرة واحدة", () => {
    const result = calculateCompanyFinancialOverview([
      { transactionType: "expense", amount: 100000, category: "مستحق فني", recipientName: "سعيد" },
      { transactionType: "expense", amount: 25000, category: "دفعة راتب فني", recipientName: "سعيد" },
      { transactionType: "expense", amount: 15000, category: "سلفة فني", recipientName: "سعيد" },
    ]);
    expect(result.technicianPaymentsByName[0]).toMatchObject({ technician: "سعيد", requiredAmount: 100000, totalPaid: 40000, salaryPaidAmount: 40000, remainingAmount: 60000, status: "remaining", transactionCount: 3 });
    expect(result.technicianPayments).toBe(40000);
  });
});

describe("حالة راتب الفني", () => {
  it("يعرض مدفوعًا عندما يساوي المدفوع أو يتجاوز المستحق", () => {
    const result = calculateCompanyFinancialOverview([
      { transactionType: "expense", amount: 40000, category: "مستحق فني", recipientName: "محمود" },
      { transactionType: "expense", amount: 40000, category: "راتب فني", recipientName: "محمود" },
    ]);
    expect(result.technicianPaymentsByName[0]).toMatchObject({ technician: "محمود", requiredAmount: 40000, totalPaid: 40000, salaryPaidAmount: 40000, remainingAmount: 0, status: "paid" });
  });
});


describe("بطاقة إجمالي مدفوعات الفني", () => {
  it("تجمع الراتب والسلفة في المدفوع والمتبقي", () => {
    const result = calculateCompanyFinancialOverview([
      { transactionType: "expense", amount: 100000, category: "مستحق فني", recipientName: "أحمد" },
      { transactionType: "expense", amount: 30000, category: "راتب فني", recipientName: "أحمد" },
      { transactionType: "expense", amount: 20000, category: "سلفة فني", recipientName: "أحمد" },
    ]);
    expect(result.technicianPaymentsByName[0]).toMatchObject({ technician: "أحمد", requiredAmount: 100000, totalPaid: 50000, salaryPaidAmount: 50000, remainingAmount: 50000, status: "remaining" });
  });
});

describe("مطابقة التقرير مع الخزنة", () => {
  it("يحسب كل الإيرادات والمصروفات المسجلة ويطابق الرصيد الفعلي", () => {
    const result = calculateCompanyFinancialOverview([
      { transactionType: "income", amount: 15230, category: "تحصيل صيانة" },
      { transactionType: "expense", amount: 4437, category: "مصروف غير مصنف" },
      { transactionType: "income", amount: 0, category: "إيراد إضافي" },
    ]);
    expect(result.totalIncome).toBe(15230);
    expect(result.otherExpenses).toBe(4437);
    expect(result.companyNet).toBe(10793);
  });

  it("لا يسقط الإيراد ذي التصنيف الجديد من إجمالي التقرير", () => {
    const result = calculateCompanyFinancialOverview([
      { transactionType: "income", amount: 15000, category: "تحصيل تركيب" },
      { transactionType: "income", amount: 230, category: "إيراد جديد" },
      { transactionType: "expense", amount: 4437, category: "أخرى" },
    ]);
    expect(result.totalIncome).toBe(15230);
    expect(result.companyNet).toBe(10793);
  });
});
