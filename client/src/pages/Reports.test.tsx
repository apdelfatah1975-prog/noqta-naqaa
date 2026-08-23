import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Reports from "./Reports";

const mocks = vi.hoisted(() => ({ monthly: vi.fn(), refetch: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: { filters: { reports: { monthly: { useQuery: mocks.monthly } } } },
}));

vi.mock("xlsx", () => ({
  utils: { book_new: vi.fn(), json_to_sheet: vi.fn(), book_append_sheet: vi.fn() },
  writeFile: vi.fn(),
}));

vi.mock("@/lib/pdfExport", () => ({
  printArabicPdf: vi.fn(() => true),
}));

describe("تقارير نقطة نقاء", () => {
  afterEach(cleanup);

  beforeEach(() => {
    mocks.monthly.mockReset();
    mocks.refetch.mockReset();
    mocks.monthly.mockReturnValue({
      isLoading: false,
      isError: false,
      refetch: mocks.refetch,
      data: {
        period: { dateFrom: "2026-08-01", dateTo: "2026-08-16" },
        summary: { visits: 4, customers: 3, income: 125000, expense: 40000, balance: 85000, pendingReminders: 2, lowStock: 1 },
        incomeByCategory: [{ label: "صيانة", total: 125000 }],
        expenseByCategory: [{ label: "بنزين", total: 40000 }],
        visitsByType: [{ label: "maintenance", total: 4 }],
        visitsByTechnician: [{ label: "فني أحمد", total: 4 }],
        inventory: { incomingQuantity: 8, outgoingQuantity: 2, purchaseCost: 30000, items: [{ name: "شمعة", currentBalance: 6 }] },
        recentVisits: [{ date: new Date("2026-08-15T10:00:00"), customer: "عميل الاختبار", type: "maintenance", technician: "فني أحمد" }],
        treasury: {
          transactions: [{ id: 1, transactionDate: new Date("2026-08-15T10:00:00"), transactionType: "income", category: "تحصيل صيانة", recipientName: "فني أحمد", amount: 125000, notes: "عميل الاختبار" }, { id: 2, transactionDate: new Date("2026-08-14T10:00:00"), transactionType: "expense", category: "بنزين", recipientName: "فني أحمد", amount: 40000, notes: "رحلة" }],
          incomeTotal: 125000, expenseTotal: 40000, balance: 85000,
          availableTechnicians: ["فني أحمد", "فني محمود"], availableCategories: ["تحصيل صيانة", "بنزين"],
        },
        financial: {
          serviceIncome: 125000, externalIncome: 0, totalIncome: 125000,
          technicianPayments: 30000, technicianRequired: 35000, technicianRemaining: 5000,
          otherExpenses: 10000, gasolineExpenses: 4000, inventoryPurchaseExpenses: 3000,
          generalExpenses: 2000, uncategorizedExpenses: 1000, companyNet: 85000,
          technicianPaymentsByName: [{ technician: "فني أحمد", status: "partial", requiredAmount: 35000, totalPaid: 30000, remainingAmount: 5000, transactionCount: 4 }],
        },
      },
    });
  });

  it("تعرض زر ملخص المدير وتجهز الملخص المختصر للطباعة", () => {
    render(<Reports />);
    const button = screen.getByRole("button", { name: /ملخص المدير/ });
    expect(button).toBeTruthy();
    fireEvent.click(button);
  });

  it("تعرض مؤشرات التقرير وتجميعات الفترة", () => {
    render(<Reports />);
    expect(screen.getByText("التقارير")).toBeTruthy();
    expect(screen.getByText("الزيارات المنفذة")).toBeTruthy();
    expect(screen.getByRole("button", { name: /العملاء والخدمات/ })).toBeTruthy();
    expect(screen.queryByText("عميل الاختبار")).toBeNull();
    expect(screen.queryByText("maintenance")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /العملاء والخدمات/ }));
    expect(screen.getByText("عميل الاختبار")).toBeTruthy();
    expect(screen.getAllByText("بنزين").length).toBeGreaterThan(0);
    expect(screen.getAllByText("صيانة").length).toBeGreaterThan(0);
  });

  it("تعرض بطاقات المخزون أسماء وشرحًا عربيًا واضحًا", () => {
    render(<Reports />);
    fireEvent.click(screen.getByRole("button", { name: /المخزون/ }));
    expect(screen.getByText("إجمالي الوارد")).toBeTruthy();
    expect(screen.getByText("إجمالي المنصرف")).toBeTruthy();
    expect(screen.getByText("قيمة المشتريات")).toBeTruthy();
    expect(screen.getByText("الكميات التي دخلت المخزن خلال الفترة")).toBeTruthy();
    expect(screen.getByText("إجمالي تكلفة الأصناف المشتراة")).toBeTruthy();
    expect(screen.queryByText("تكلفة المشتريات")).toBeNull();
  });

  it("تعرض كشف PDF مستقلًا للفني من قسم المالية", () => {
    render(<Reports />);
    fireEvent.click(screen.getByRole("button", { name: /الفنيون والرواتب/ }));
    expect(screen.getByText("فني أحمد")).toBeTruthy();
    expect(screen.getByRole("button", { name: /PDF الفني/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /PDF الفني/ }));
  });

  it("تبدأ الفترة الافتراضية من أول يوم في الشهر الحالي", () => {
    render(<Reports />);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const dateInput = screen.getByLabelText("من تاريخ") as HTMLInputElement;
    expect(dateInput.value).toBe(expected);
    expect(dateInput.value).not.toBe("2000-01-01");
  });

  it("تغيّر مدخل الفترة يعيد طلب التقرير بالحد الجديد", () => {
    render(<Reports />);
    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-07-01" } });
    expect(mocks.monthly.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ dateFrom: "2026-07-01" }));
  });

  it("تطبق فلاتر الخزينة حسب الفني والنوع والتصنيف وتعرض الحركات", () => {
    render(<Reports />);
    fireEvent.click(screen.getByRole("button", { name: /الخزينة/ }));
    expect(screen.getByText("تقرير حركات الخزينة")).toBeTruthy();
    expect(screen.getByText("عميل الاختبار")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("الفني"), { target: { value: "فني أحمد" } });
    fireEvent.change(screen.getByLabelText("نوع الحركة"), { target: { value: "income" } });
    fireEvent.change(screen.getByLabelText("التصنيف"), { target: { value: "تحصيل صيانة" } });
    expect(mocks.monthly.mock.calls.at(-1)?.[0]).toEqual(expect.objectContaining({ technician: "فني أحمد", transactionType: "income", category: "تحصيل صيانة" }));
  });

  it("تعرض أزرار تصدير معاملات الخزينة إلى Excel وPDF", () => {
    render(<Reports />);
    fireEvent.click(screen.getByRole("button", { name: /الخزينة/ }));
    expect(screen.getByRole("button", { name: "تصدير معاملات PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "تصدير معاملات Excel" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "تصدير معاملات Excel" }));
    fireEvent.click(screen.getByRole("button", { name: "تصدير معاملات PDF" }));
  });
});


it("تعرض تقريرًا هيكليًا فارغًا من المصدر المركزي عند فشل الشبكة دون شاشة تعذر", () => {
  mocks.monthly.mockReturnValue({ isLoading: false, isError: true, refetch: mocks.refetch, data: undefined });
  render(<Reports />);
  expect(screen.getAllByText("التقارير").length).toBeGreaterThan(0);
  expect(screen.getByText("الزيارات المنفذة")).toBeTruthy();
  expect(screen.getByText("ملخص الإدارة")).toBeTruthy();
  expect(screen.queryByText("تعذر تحميل التقرير")).toBeNull();
});
