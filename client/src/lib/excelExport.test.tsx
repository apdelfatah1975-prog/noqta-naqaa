import { describe, expect, it } from "vitest";
import {
  customerExcelHeaders,
  customerRowsForExcel,
  reminderExcelHeaders,
  reminderRowsForExcel,
  visitExcelHeaders,
  visitRowsForExcel,
  withArabicHeaders,
  parseCustomerExcel,
} from "./excelExport";

describe("Excel export rows", () => {
  it("يقرأ ملف العملاء بعناوين عربية ويكشف الصفوف الناقصة", async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([
      ["اسم العميل", "الهاتف", "العنوان", "ملاحظات"],
      ["عميل جديد", "0500000000", "الرياض", "مهم"],
      ["عميل ناقص", "", "الرياض", ""],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const result = await parseCustomerExcel(new File([bytes], "customers.xlsx"));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ rowNumber: 2, name: "عميل جديد", phone: "0500000000", address: "الرياض", notes: "مهم" });
    expect(result.issues).toEqual([{ rowNumber: 3, reason: "رقم الهاتف ناقص" }]);
  });

  it("يقرأ الزيارة التاريخية والفني والمبلغ ويحسِب موعد المتابعة", async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([["اسم العميل", "الهاتف", "الموقع", "الفني", "تاريخ الزيارة", "نوع الزيارة", "المبلغ"], ["عميل خدمة", "0500000001", "رابط الخريطة", "أحمد", "2026-01-15", "صيانة", 250]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const result = await parseCustomerExcel(new File([bytes], "historical.xlsx"));
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ technicianName: "أحمد", visitType: "maintenance", collectedAmount: 250 });
    expect(new Date(result.rows[0].nextVisitDate!).toISOString().slice(0, 10)).toBe("2026-05-15");
  });

  it("يرفض ملف العملاء الذي يفتقد الأعمدة الأساسية", async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([["العنوان"], ["الرياض"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const result = await parseCustomerExcel(new File([bytes], "invalid.xlsx"));
    expect(result.rows).toHaveLength(0);
    expect(result.issues[0]?.reason).toContain("اسم العميل والهاتف");
  });

  it("يبني صفوف العملاء مع الكود وموعد المتابعة", () => {
    const rows = customerRowsForExcel([
      {
        customerCode: "C-000001",
        name: "عميل تجريبي",
        phone: "01000000000",
        address: "العنوان",
        followUp: { nextVisitDate: "2026-08-20T00:00:00.000Z", daysRemaining: 5, lastServiceVisitType: "maintenance" },
        latestTechnicianName: "أحمد",
      },
    ]);
    expect(rows[0]).toMatchObject({ customerCode: "C-000001", name: "عميل تجريبي", followUpDays: "5 يوم", lastServiceType: "صيانة", latestTechnicianName: "أحمد" });
    expect(withArabicHeaders(rows, customerExcelHeaders)[0]["كود العميل"]).toBe("C-000001");
    expect(withArabicHeaders(rows, customerExcelHeaders)[0]["اسم الفني لآخر زيارة"]).toBe("أحمد");
  });

  it("يحوّل الزيارات الحالية إلى صفوف عربية قابلة للتصدير", () => {
    const rows = visitRowsForExcel([{ customer: { manualCode: "ع-1", name: "عميل", phone: "0500", address: "العنوان" }, visitType: "maintenance", visitDate: "2026-08-17T10:00:00.000Z", technicianName: "فني", collectedAmount: 12500, visitResult: "تمت الصيانة" }]);
    expect(rows[0]).toMatchObject({ customerCode: "ع-1", customerName: "عميل", visitType: "صيانة", technicianName: "فني", collectedAmount: 125, visitResult: "تمت الصيانة" });
    expect(withArabicHeaders(rows, visitExcelHeaders)[0]["نتيجة الزيارة"]).toBe("تمت الصيانة");
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

