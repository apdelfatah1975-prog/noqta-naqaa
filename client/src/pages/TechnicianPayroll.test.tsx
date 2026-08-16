import { describe, expect, it } from "vitest";
import { calculateTechnicianCommission, monthBounds } from "./TechnicianPayroll";

describe("TechnicianPayroll", () => {
  it("يحسب بداية ونهاية الشهر المحدد", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("يحسب عمولة التركيب والصيانة تلقائيًا ولا يحسب للخدمات الأخرى", () => {
    expect(calculateTechnicianCommission(10000, "installation", 10, 5)).toBe(1000);
    expect(calculateTechnicianCommission(10000, "maintenance", 10, 5)).toBe(500);
    expect(calculateTechnicianCommission(10000, "follow_up", 10, 5)).toBe(0);
    expect(calculateTechnicianCommission(10000, "installation", 0, 5)).toBe(0);
  });
});
