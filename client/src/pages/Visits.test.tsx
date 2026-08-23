import { describe, expect, it } from "vitest";
import { filterVisitRows, normalizeVisitRows } from "./Visits";

describe("filterVisitRows", () => {
  const rows = [
    { visitDate: "2026-08-01T09:00:00.000Z", visitType: "maintenance", technicianName: "أحمد", notes: "تم تغيير الشمعات وتنظيف الجهاز", tdsIn: 240, tdsOut: 35, customer: { name: "عميل ألف", manualCode: "12", phone: "01000000000" } },
    { visitDate: "2026-08-10T09:00:00.000Z", visitType: "installation", technicianName: "محمود", customer: { name: "عميل باء", manualCode: "13", phone: "01100000000" } },
  ];

  it("filters by customer code or name", () => {
    expect(filterVisitRows(rows, { search: "13" })).toHaveLength(1);
    expect(filterVisitRows(rows, { search: "ألف" })[0]?.customer.name).toBe("عميل ألف");
  });

  it("filters by visit type and inclusive date range", () => {
    expect(filterVisitRows(rows, { type: "maintenance", dateFrom: "2026-08-01", dateTo: "2026-08-01" })).toHaveLength(1);
    expect(filterVisitRows(rows, { dateFrom: "2026-08-02", dateTo: "2026-08-09" })).toHaveLength(0);
  });

  it("searches the recorded result/details of a completed visit", () => {
    expect(filterVisitRows(rows, { search: "تغيير الشمعات" })).toHaveLength(1);
  });

  it("returns all rows when filters are empty", () => {
    expect(filterVisitRows(rows, { type: "all" })).toHaveLength(2);
  });

  it("keeps the before and after TDS readings attached to the visit row", () => {
    const result = filterVisitRows(rows, { search: "ألف" })[0] as { tdsIn?: number; tdsOut?: number };
    expect(result.tdsIn).toBe(240);
    expect(result.tdsOut).toBe(35);
  });

  it("does not crash when visits data is null or a non-array object", () => {
    expect(normalizeVisitRows(null)).toEqual([]);
    expect(normalizeVisitRows({ unexpected: rows })).toEqual([]);
    expect(filterVisitRows(null as unknown as any[], {})).toEqual([]);
    expect(filterVisitRows({ items: rows } as unknown as any[], {})).toEqual([]);
  });
});
