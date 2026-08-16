import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./Home";

const mocks = vi.hoisted(() => ({
  dashboard: vi.fn(),
  cashSummary: vi.fn(),
  backupStatus: vi.fn(),
  backupCreateNow: vi.fn(),
  setLocation: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    filters: {
      dashboard: { useQuery: mocks.dashboard },
      cash: { summary: { useQuery: mocks.cashSummary } },
      backup: {
        status: { useQuery: mocks.backupStatus },
        createNow: { useMutation: mocks.backupCreateNow },
      },
    },
    useUtils: () => ({ filters: { backup: { status: { invalidate: vi.fn() } } } }),
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
    mocks.backupStatus.mockReturnValue({ data: { generatedAt: null, downloadUrl: null }, isLoading: false });
    mocks.backupCreateNow.mockReturnValue({ isPending: false, isSuccess: false, mutate: vi.fn() });
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
        upcomingVisits: [{ id: 21, customerId: 7, visitDate: upcomingDate, visitType: "maintenance", customer: { name: "عميل بموعد مسجل", customerCode: "٧" } }],
        upcomingFollowUps: [],
        dueReminders: [],
        inventory: { totalItems: 0, lowStockCount: 0, lowStock: [] },
      },
    });
    render(<Home />);
    expect(screen.getByText("عميل بموعد مسجل")).toBeTruthy();
    expect(screen.getByText(/بعد 3 يوم/)).toBeTruthy();
    expect(screen.getByText("تظهر من الغد وحتى خمسة أيام قبل الموعد")).toBeTruthy();
  });

  it("تفتح بطاقة تسجيل الزيارة من الإجراء السريع في الصفحة الرئيسية", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "تسجيل زيارة جديدة" }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/customers?visit=1");
  });

  it("تظهر كبطاقة تفاعلية وتنتقل إلى صفحة الخزينة عند الضغط", () => {
    render(<Home />);

    const cashCard = screen.getByRole("button", { name: "فتح تفاصيل رصيد الخزينة" });
    expect(cashCard.textContent).toContain("رصيد الخزينة");
    expect(cashCard.textContent).toContain("2500");

    fireEvent.click(cashCard);
    expect(mocks.setLocation).toHaveBeenCalledWith("/cash");
  });
});
