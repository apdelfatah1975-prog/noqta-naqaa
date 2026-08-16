import { describe, expect, it } from "vitest";
import {
  customerExcelHeaders,
  customerRowsForExcel,
  reminderExcelHeaders,
  reminderRowsForExcel,
  withArabicHeaders,
} from "./excelExport";

describe("Excel export rows", () => {
  it("يبني صفوف العملاء مع الكود وموعد المتابعة", () => {
    const rows = customerRowsForExcel([
      {
        customerCode: "C-000001",
        name: "عميل تجريبي",
        phone: "01000000000",
        address: "العنوان",
        followUp: { nextVisitDate: "2026-08-20T00:00:00.000Z", daysRemaining: 5, lastServiceVisitType: "maintenance" },
      },
    ]);
    expect(rows[0]).toMatchObject({ customerCode: "C-000001", name: "عميل تجريبي", followUpDays: "5 يوم", lastServiceType: "صيانة" });
    expect(withArabicHeaders(rows, customerExcelHeaders)[0]["كود العميل"]).toBe("C-000001");
  });

  it("يبني صفوف التذكيرات باسم العميل وأيام التأخر", () => {
    const rows = reminderRowsForExcel([
      {
        reminderDate: "2026-08-15T00:00:00.000Z",
        daysOverdue: 2,
        status: "pending",
        lastServiceVisitType: "installation",
        customer: { customerCode: "C-000002", name: "عميل آخر", phone: "01100000000" },
      },
    ]);
    const arabicRows = withArabicHeaders(rows, reminderExcelHeaders);
    expect(arabicRows[0]).toMatchObject({ "اسم العميل": "عميل آخر", "أيام التأخر": 2, "نوع آخر خدمة": "تركيب فلتر", الحالة: "معلق" });
  });
});
