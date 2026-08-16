import { describe, expect, it } from "vitest";
import { monthBounds } from "./TechnicianPayroll";

describe("TechnicianPayroll", () => {
  it("يحسب بداية ونهاية الشهر المحدد", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });
});
