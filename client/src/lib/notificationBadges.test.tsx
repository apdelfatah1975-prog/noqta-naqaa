import { describe, expect, it } from "vitest";
import { countPendingReminders, countPendingWorkOrders } from "./notificationBadges";

describe("notification badges", () => {
  it("يحسب عدد التذكيرات المعلقة ويعيد صفرًا عند عدم وجود بيانات", () => {
    expect(countPendingReminders([{ id: 1 }, { id: 2 }])).toBe(2);
    expect(countPendingReminders(undefined)).toBe(0);
  });

  it("يحسب أوامر العمل غير المنتهية فقط", () => {
    expect(countPendingWorkOrders([
      { status: "assigned" },
      { status: "in_progress" },
      { status: "completed" },
      { status: "cancelled" },
    ])).toBe(2);
    expect(countPendingWorkOrders([])).toBe(0);
  });
});
