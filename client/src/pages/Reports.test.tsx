import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Reports from "./Reports";

const mocks = vi.hoisted(() => ({ monthly: vi.fn(), refetch: vi.fn() }));

vi.mock("@/lib/trpc", () => ({
  trpc: { filters: { reports: { monthly: { useQuery: mocks.monthly } } } },
}));

vi.mock("xlsx", () => ({
  utils: { book_new: vi.fn(), json_to_sheet: vi.fn(), book_append_sheet: vi.fn() },
  writeFile: vi.fn(),
}));

describe("تقارير نقطة نقاء", () => {
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
      },
    });
  });

  it("تعرض مؤشرات التقرير وتجميعات الفترة", () => {
    render(<Reports />);
    expect(screen.getByText("التقارير والتحليلات")).toBeTruthy();
    expect(screen.getByText("الزيارات المنفذة")).toBeTruthy();
    expect(screen.getByText("عميل الاختبار")).toBeTruthy();
    expect(screen.getByText("بنزين")).toBeTruthy();
  });

  it("تغيّر مدخل الفترة يعيد طلب التقرير بالحد الجديد", () => {
    render(<Reports />);
    fireEvent.change(screen.getByLabelText("من تاريخ"), { target: { value: "2026-07-01" } });
    expect(mocks.monthly).toHaveBeenLastCalledWith(expect.objectContaining({ dateFrom: "2026-07-01" }));
  });
});
