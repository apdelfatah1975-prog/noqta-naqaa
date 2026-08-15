import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ReminderAlertBanner } from "./ReminderAlertBanner";

const queryMocks = vi.hoisted(() => ({
  due: vi.fn(),
  alerts: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    filters: {
      reminders: {
        due: { useQuery: queryMocks.due },
        alerts: { useQuery: queryMocks.alerts },
      },
    },
  },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/", vi.fn()],
}));

describe("بانر تنبيهات لوحة التحكم", () => {
	beforeEach(() => {
		queryMocks.due.mockReset();
		queryMocks.alerts.mockReset();
	});

	afterEach(() => {
		cleanup();
	});

  it("يعرض التذكير المستحق والقريب معًا بصياغة واضحة وزر الوصول للتذكيرات", () => {
    queryMocks.due.mockReturnValue({
      data: [{ id: 81, reminderDate: new Date("2026-08-14T12:00:00.000Z"), customer: { name: "أحمد" } }],
    });
    queryMocks.alerts.mockReturnValue({
      data: [{ id: 82, reminderDate: new Date("2026-08-16T15:00:00.000Z"), customer: { name: "سارة" } }],
    });

    render(<ReminderAlertBanner />);

    expect(screen.getByRole("status").textContent).toContain("لديك 2 تنبيهات للمتابعة");
    expect(screen.getByRole("status").textContent).toContain("1 مستحق الآن، و1 قريب");
    expect(screen.getByRole("button", { name: "عرض التنبيهات" })).toBeTruthy();
  });

  it("لا يعرض البانر عندما لا توجد تذكيرات مستحقة أو قريبة", () => {
    queryMocks.due.mockReturnValue({ data: [] });
    queryMocks.alerts.mockReturnValue({ data: [] });

    render(<ReminderAlertBanner />);

    expect(screen.queryByRole("status")).toBeNull();
  });
});
