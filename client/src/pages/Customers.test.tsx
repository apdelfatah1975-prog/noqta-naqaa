import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Customers from "./Customers";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  createUseMutation: vi.fn(),
  updateUseMutation: vi.fn(),
  listInvalidate: vi.fn(),
  getInvalidate: vi.fn(),
  dashboardInvalidate: vi.fn(),
  remindersInvalidate: vi.fn(),
  location: vi.fn(),
  updateOptions: null as null | { onSuccess?: () => void },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    filters: {
      customers: {
        list: { useQuery: mocks.list },
        create: { useMutation: mocks.createUseMutation },
        update: { useMutation: mocks.updateUseMutation },
      },
      dashboard: { invalidate: mocks.dashboardInvalidate },
      reminders: { due: { invalidate: mocks.remindersInvalidate } },
    },
    useUtils: () => ({
      filters: {
        customers: {
          list: { invalidate: mocks.listInvalidate },
          get: { invalidate: mocks.getInvalidate },
        },
        dashboard: { invalidate: mocks.dashboardInvalidate },
        reminders: { due: { invalidate: mocks.remindersInvalidate } },
      },
    }),
  },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/customers", mocks.location] }));

describe("ترابط تعديل بيانات العميل", () => {
  beforeEach(() => {
    mocks.list.mockReturnValue({
      data: [{ id: 12, name: "عميل قديم", phone: "01000000000", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000012", followUp: null }],
      isLoading: false,
      isError: false,
    });
    mocks.createUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.updateUseMutation.mockImplementation((options: { onSuccess?: () => void }) => {
      mocks.updateOptions = options;
      return { mutate: vi.fn(), isPending: false };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.updateOptions = null;
  });

  it("يعرض شارة موعد اليوم وشارة التأخر بوضوح", () => {
    mocks.list.mockReturnValue({
      data: [
        { id: 12, name: "عميل اليوم", phone: "01000000000", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000012", followUp: { nextVisitDate: new Date("2026-08-15T09:00:00Z"), daysRemaining: 0 } },
        { id: 13, name: "عميل متأخر", phone: "01000000001", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000013", followUp: { nextVisitDate: new Date("2026-08-10T09:00:00Z"), daysRemaining: -5 } },
      ],
      isLoading: false,
      isError: false,
    });
    render(<Customers />);
    expect(screen.getByLabelText("موعد متابعة العميل اليوم")).toBeTruthy();
    expect(screen.getByLabelText("العميل متأخر عن موعد المتابعة")).toBeTruthy();
  });

  it("يرسل خيار الفرز حسب أقرب موعد إلى قائمة العملاء", () => {
    render(<Customers />);
    fireEvent.change(screen.getByLabelText("ترتيب العملاء"), { target: { value: "next_asc" } });
    const latestInput = mocks.list.mock.calls.at(-1)?.[0];
    expect(latestInput.sortBy).toBe("next_asc");
    expect(latestInput.followUpStatus).toBe("all");
  });

  it("يعيد جلب القائمة والملف واللوحة والتذكيرات بعد حفظ تعديل العميل", () => {
    render(<Customers />);
    fireEvent.click(screen.getByTitle("تعديل"));
    fireEvent.change(screen.getByDisplayValue("عميل قديم"), { target: { value: "عميل محدث" } });
    const form = screen.getByText("حفظ البيانات").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    mocks.updateOptions?.onSuccess?.();

    expect(mocks.listInvalidate).toHaveBeenCalled();
    expect(mocks.getInvalidate).toHaveBeenCalled();
    expect(mocks.dashboardInvalidate).toHaveBeenCalled();
    expect(mocks.remindersInvalidate).toHaveBeenCalled();
  });
});

export {};

