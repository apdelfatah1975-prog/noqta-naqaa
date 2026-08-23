import { describe, expect, it } from "vitest";
import { buildArabicPdfDocument, buildCustomerProfileDocument, buildVisitReportDocument, buildWorkOrderReceiptDocument } from "./pdfExport";

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
    expect(html).toContain("counter(page)");
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

describe("تقارير العميل وأمر العمل", () => {
  it("ينشئ ملف عميل RTL مع سجل الزيارات وترقيم الصفحات ويترك الحقول المفقودة فارغة", () => {
    const html = buildCustomerProfileDocument({
      customerName: "سارة حسن",
      phone: "0500000000",
      visits: [{ visitType: "صيانة", visitDate: "2026-08-23T10:00:00Z", tdsIn: 420, tdsOut: null, notes: null }],
    });
    expect(html).toContain('dir="rtl"');
    expect(html).toContain("سجل الزيارات السابقة");
    expect(html).toContain("420 ppm");
    expect(html).toContain("counter(page)");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });

  it("ينشئ إيصال أمر عمل مع مبلغ وTDS وخانات توقيع", () => {
    const html = buildWorkOrderReceiptDocument({
      workOrderId: 77,
      customerName: "أحمد علي",
      visitType: "صيانة",
      visitDate: "2026-08-23T10:00:00Z",
      technicianName: "محمد",
      tdsIn: 500,
      tdsOut: 40,
      collectedAmount: 250,
      items: [{ name: "شمعة كربون", quantity: 1, unit: "قطعة" }],
    });
    expect(html).toContain("أمر عمل رقم 77");
    expect(html).toContain("توقيع الفني");
    expect(html).toContain("توقيع العميل");
    expect(html).toContain("٢٥٠");
  });
});
