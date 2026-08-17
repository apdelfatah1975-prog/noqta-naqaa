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
  toastWarning: vi.fn(),
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

vi.mock("sonner", () => ({
  toast: { warning: mocks.toastWarning },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", mocks.setLocation],
}));

describe("بطاقة رصيد الخزينة في لوحة التحكم", () => {
  beforeEach(() => {
    mocks.setLocation.mockReset();
    mocks.toastWarning.mockReset();
    localStorage.removeItem("purepoint-low-stock-alert");
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

  it("تعرض قسم الزيارات القادمة وقسم المتابعة المستحقة في التخطيط السابق", () => {
    mocks.dashboard.mockReturnValue({
      isLoading: false,
      data: {
        todayVisits: [],
        upcomingVisits: [{ id: 21, customerId: 7, visitDate: new Date(), visitType: "maintenance", customer: { name: "عميل قادم", customerCode: "٧" } }],
        upcomingFollowUps: [],
        dueReminders: [{ id: 22, customerId: 8, reminderDate: new Date(), daysOverdue: 2, customer: { name: "عميل مستحق", customerCode: "٨" } }],
        customerCount: 4,
        inventory: { totalItems: 0, lowStockCount: 0, lowStock: [] },
      },
    });
    render(<Home />);
    expect(screen.getByText("الزيارات القادمة")).toBeTruthy();
    expect(screen.getByText("المتابعة المستحقة")).toBeTruthy();
    expect(screen.queryByText("تواصل الآن")).toBeNull();
    expect(screen.queryByText("تمت المتابعة")).toBeNull();
  });

  it("تفتح بطاقة تسجيل الزيارة من الإجراء السريع في الصفحة الرئيسية", () => {
    render(<Home />);
    fireEvent.click(screen.getByRole("button", { name: "تسجيل زيارة جديدة" }));
    expect(mocks.setLocation).toHaveBeenCalledWith("/customers?visit=1");
  });

  it("تنبه المستخدم تلقائيًا عند وصول صنف إلى الحد الأدنى", () => {
    mocks.dashboard.mockReturnValue({
      isLoading: false,
      data: {
        todayVisits: [],
        upcomingVisits: [],
        upcomingFollowUps: [],
        dueReminders: [],
        inventory: {
          totalItems: 1,
          lowStockCount: 1,
          lowStock: [{ id: 27, name: "فلتر جامبو", currentBalance: 2, reorderLevel: 2 }],
          items: [{ id: 27, name: "فلتر جامبو", currentBalance: 2, reorderLevel: 2 }],
        },
      },
    });
    render(<Home />);
    expect(mocks.toastWarning).toHaveBeenCalledWith(expect.stringContaining("فلتر جامبو"), expect.objectContaining({ description: expect.stringContaining("الحد الأدنى") }));
  });

  it("تنتقل بطاقة صنف المخزن إلى تفاصيل الصنف المحدد", () => {
    mocks.dashboard.mockReturnValue({
      isLoading: false,
      data: {
        todayVisits: [],
        upcomingVisits: [],
        upcomingFollowUps: [],
        dueReminders: [],
        inventory: {
          totalItems: 1,
          lowStockCount: 0,
          lowStock: [],
          items: [{ id: 27, name: "فلتر جامبو", currentBalance: 4, reorderLevel: 2 }],
        },
      },
    });
    render(<Home />);
    const itemCard = screen.getByRole("button", { name: "فتح تفاصيل فلتر جامبو" });
    fireEvent.click(itemCard);
    expect(mocks.setLocation).toHaveBeenCalledWith("/inventory?item=27");
  });

  it("تظهر كبطاقة تفاعلية وتنتقل إلى صفحة الخزينة عند الضغط", () => {
    render(<Home />);

    const cashCard = screen.getByRole("button", { name: "فتح تفاصيل رصيد الخزينة" });
    expect(cashCard.textContent).toContain("رصيد الخزينة");
    expect(cashCard.textContent).toContain("2500");

    fireEvent.click(cashCard);
    expect(mocks.setLocation).toHaveBeenCalledWith("/cash");
  });

  it("تعرض زر سلة المحذوفات وعدد العناصر وتفتح الإعدادات", () => {
    localStorage.setItem("purepoint-trash-bin", JSON.stringify([
      { id: "customer-1", entityType: "customer", entityLabel: "عميل تجريبي", payload: {}, deletedAt: new Date().toISOString() },
      { id: "cash-2", entityType: "cash", entityLabel: "عملية خزينة", payload: {}, deletedAt: new Date().toISOString() },
    ]));
    render(<Home />);
    const trashButton = screen.getByRole("button", { name: "فتح سلة المحذوفات" });
    expect(trashButton.textContent).toContain("سلة المحذوفات");
    expect(trashButton.textContent).toContain("٢");
    fireEvent.click(trashButton);
    expect(mocks.setLocation).toHaveBeenCalledWith("/settings?section=trash");
  });
});
