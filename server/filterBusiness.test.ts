import { describe, expect, it } from "vitest";
import { calculateStockBalance, followUpDate, needsAutomaticReminder } from "../shared/filterBusiness";

describe("منطق تطبيق فلاتر المياه", () => {
  it("ينشئ موعد المتابعة بعد 120 يومًا من تاريخ الزيارة", () => {
    const visitDate = new Date("2026-01-01T00:00:00.000Z");
    expect(followUpDate(visitDate).toISOString()).toBe("2026-05-01T00:00:00.000Z");
  });

  it("يُنشئ تذكيرًا للتركيب والصيانة فقط", () => {
    expect(needsAutomaticReminder("installation")).toBe(true);
    expect(needsAutomaticReminder("maintenance")).toBe(true);
    expect(needsAutomaticReminder("cartridge_change")).toBe(false);
  });

  it("يحسب رصيد المخزنة من الرصيد الافتتاحي وحركة الوارد والمنصرف", () => {
    expect(calculateStockBalance(12, [
      { movementType: "incoming", quantity: 5 },
      { movementType: "outgoing", quantity: 4 },
    ])).toBe(13);
  });

  it("يكشف أن الرصيد لا يكفي لصرف كمية أكبر من المتاح", () => {
    const balance = calculateStockBalance(3, [{ movementType: "outgoing", quantity: 1 }]);
    expect(5 > balance).toBe(true);
  });
});
