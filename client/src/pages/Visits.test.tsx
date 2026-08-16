import { describe, expect, it } from "vitest";
import { filterVisitRows } from "./Visits";

describe("filterVisitRows", () => {
  const rows = [
    { visitDate: "2026-08-01T09:00:00.000Z", visitType: "maintenance", technicianName: "أحمد", customer: { name: "عميل ألف", manualCode: "12", phone: "01000000000" } },
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

  it("returns all rows when filters are empty", () => {
    expect(filterVisitRows(rows, { type: "all" })).toHaveLength(2);
  });
});
