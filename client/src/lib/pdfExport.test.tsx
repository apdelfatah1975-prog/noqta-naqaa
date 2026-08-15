import { describe, expect, it } from "vitest";
import { buildArabicPdfDocument } from "./pdfExport";

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
});
