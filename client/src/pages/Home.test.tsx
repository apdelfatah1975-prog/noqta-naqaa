import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  cashSummary: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    filters: {
      dashboard: { useQuery: mocks.dashboard },
      cash: { summary: { useQuery: mocks.cashSummary } },
    },
  },
}));

vi.mock("@/components/ReminderAlertBanner", () => ({
  ReminderAlertBanner: () => null,
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", mocks.setLocation],
}));

describe("بطاقة رصيد الخزينة في لوحة التحكم", () => {
  beforeEach(() => {
    mocks.setLocation.mockReset();
    mocks.dashboard.mockReturnValue({
      isLoading: false,
      data: {
        todayVisits: [],
        upcomingVisits: [],
        upcomingFollowUps: [],
        dueReminders: [],
        inventory: { totalItems: 0, lowStockCount: 0, lowStock: [] },
      },
    });
    mocks.cashSummary.mockReturnValue({ data: { balance: 250000 } });
  });

  afterEach(() => {
    cleanup();
  });

  it("تعرض بطاقة الزيارات القادمة اسم العميل وموعده وعدد الأيام", () => {
    const upcomingDate = new Date();
    upcomingDate.setDate(upcomingDate.getDate() + 3);
    mocks.dashboard.mockReturnValue({
      isLoading: false,
      data: {
        todayVisits: [],
        upcomingVisits: [],
        upcomingFollowUps: [{ id: 21, customerId: 7, reminderDate: upcomingDate, customer: { name: "عميل متابعة", customerCode: "٧", followUp: { daysRemaining: 3 } } }],
        dueReminders: [],
        inventory: { totalItems: 0, lowStockCount: 0, lowStock: [] },
      },
    });
    render(<Home />);
    expect(screen.getByText("عميل متابعة")).toBeTruthy();
    expect(screen.getByText(/بعد 3 يوم/)).toBeTruthy();
    expect(screen.getByText("عملاء المتابعة التلقائية قبل الموعد بخمسة أيام")).toBeTruthy();
  });

  it("تظهر كبطاقة تفاعلية وتنتقل إلى صفحة الخزينة عند الضغط", () => {
    render(<Home />);

    const cashCard = screen.getByRole("button", { name: "فتح تفاصيل رصيد الخزينة (ج.م)" });
    expect(cashCard.textContent).toContain("رصيد الخزينة (ج.م)");
    expect(cashCard.textContent).toContain("2500");

    fireEvent.click(cashCard);
    expect(mocks.setLocation).toHaveBeenCalledWith("/cash");
  });
});
