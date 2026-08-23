import { describe, expect, it } from "vitest";
import { buildArabicPdfDocument, buildVisitReportDocument } from "./pdfExport";

describe("Arabic PDF export", () => {
  it("ينشئ شيت PDF بالترويسة والشعار والتاريخ وبيانات الصفوف", () => {
    const html = buildArabicPdfDocument(
      "تقرير العملاء",
      [{ customerCode: "١", name: "عميل تجريبي", phone: "01000000000" }],
      [
        { key: "customerCode", label: "كود العميل" },
        { key: "name", label: "اسم العميل" },
        { key: "phone", label: "الهاتف" },
      ],
      new Date("2026-08-15T10:00:00Z"),
    );

    expect(html).toContain("نقطة نقاء");
    expect(html).toContain("تقرير العملاء");
    expect(html).toContain("١٥ أغسطس ٢٠٢٦");
    expect(html).toContain("عميل تجريبي");
    expect(html).toContain("<svg");
  });

  it("ينشئ تقرير زيارة مخصصًا ببيانات الخدمة وTDS والأصناف", () => {
    const html = buildVisitReportDocument({
      customerName: "أحمد علي",
      customerPhone: "0500000000",
      visitType: "صيانة",
      visitDate: "2026-08-23T10:00:00Z",
      tdsIn: 420,
      tdsOut: 35,
      collectedAmount: 250,
      items: [{ name: "شمعة كربون", quantity: 1, unit: "قطعة" }],
    });

    expect(html).toContain("تقرير زيارة / فاتورة خدمة");
    expect(html).toContain("أحمد علي");
    expect(html).toContain("420 ppm");
    expect(html).toContain("35 ppm");
    expect(html).toContain("شمعة كربون");
  });
});
