import { describe, expect, it } from "vitest";
import { countPendingReminders, countPendingWorkOrders } from "./notificationBadges";

describe("notification badge fallbacks", () => {
  it("returns zero for non-array work orders", () => {
    expect(countPendingWorkOrders(null)).toBe(0);
    expect(countPendingWorkOrders(undefined)).toBe(0);
    expect(countPendingWorkOrders({} as never)).toBe(0);
  });

  it("counts only pending work orders", () => {
    expect(countPendingWorkOrders([
      { status: "assigned" },
      { status: "completed" },
      { status: "in_progress" },
    ])).toBe(2);
  });

  it("returns zero for missing reminders", () => {
    expect(countPendingReminders(null)).toBe(0);
    expect(countPendingReminders(undefined)).toBe(0);
  });
});

export {};
