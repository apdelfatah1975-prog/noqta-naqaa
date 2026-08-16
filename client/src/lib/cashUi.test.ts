import { describe, expect, it } from "vitest";
import { countActiveCashFilters, hasActiveCashFilters } from "./cashUi";

describe("cash filter UI helpers", () => {
  it("does not show an active-filter count for the default state", () => {
    expect(countActiveCashFilters({ category: "", partyType: "all", technician: "", itemName: "", dateMode: "all" })).toBe(0);
    expect(hasActiveCashFilters({ category: "", partyType: "all", technician: "", itemName: "", dateMode: "all" })).toBe(false);
  });

  it("counts each selected advanced filter once", () => {
    expect(countActiveCashFilters({ category: "بنزين", partyType: "technician", technician: "أحمد", itemName: "فلتر", dateMode: "range" })).toBe(5);
    expect(hasActiveCashFilters({ category: "", partyType: "customer", technician: "", itemName: "", dateMode: "all" })).toBe(true);
  });
});
