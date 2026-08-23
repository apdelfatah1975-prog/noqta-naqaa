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
  parseCustomerPdf,
  customerImportIssuesForExcel,
  localizeExcelRows,
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
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({ rowNumber: 2, name: "عميل جديد", phone: "0500000000", address: "الرياض", notes: "مهم" });
    expect(result.rows[1]).toMatchObject({ rowNumber: 3, name: "عميل ناقص", phone: "بدون هاتف - صف 3" });
    expect(result.issues[0]).toMatchObject({ rowNumber: 3, data: { "اسم العميل": "عميل ناقص", "الهاتف": "" } });
    expect(result.issues[0]?.reason).toContain("رقم الهاتف ناقص");
  });

  it("لا يفقد الصف الذي ينقصه الاسم ويضع اسمًا مؤقتًا قابلًا للمراجعة", async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([["اسم العميل", "الهاتف"], ["", "0500000011"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const result = await parseCustomerExcel(new File([bytes], "missing-name.xlsx"));
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ name: "عميل بدون اسم - صف 2", phone: "0500000011" });
    expect(result.issues[0]?.reason).toContain("اسم العميل ناقص");
  });

  it("يتعرف على صياغة إسم العميل مع الهمزة في ملف عربي فعلي", async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([["كود \nالعميل", "إسم العميل", "الهاتف"], ["1", "محمد", "0500000000"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const result = await parseCustomerExcel(new File([bytes], "arabic-headers.xlsx"));
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ name: "محمد", phone: "0500000000", manualCode: "1" });
  });

  it("يكتشف صف العناوين بعد صف تمهيدي ويختار الورقة المناسبة", async () => {
    const XLSX = await import("xlsx");
    const introSheet = XLSX.utils.aoa_to_sheet([["تقرير العملاء"], ["بيانات قديمة"]]);
    const dataSheet = XLSX.utils.aoa_to_sheet([["تاريخ التقرير", "2026-08-19"], ["إسم العميل", "الهاتف", "العنوان"], ["عميل بعد العنوان", "0500000002", "الرياض"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, introSheet, "ملخص");
    XLSX.utils.book_append_sheet(workbook, dataSheet, "بيانات العملاء");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const result = await parseCustomerExcel(new File([bytes], "preamble.xlsx"));
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ rowNumber: 3, name: "عميل بعد العنوان", phone: "0500000002", address: "الرياض" });
  });

  it("يختار ورقة العمل المطلوبة يدويًا في الملف متعدد الأوراق", async () => {
    const XLSX = await import("xlsx");
    const summarySheet = XLSX.utils.aoa_to_sheet([["ملخص"], ["لا توجد أعمدة استيراد"]]);
    const customersSheet = XLSX.utils.aoa_to_sheet([["اسم العميل", "الهاتف"], ["عميل من الورقة المختارة", "0500000099"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, summarySheet, "ملخص");
    XLSX.utils.book_append_sheet(workbook, customersSheet, "العملاء الفعليون");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const file = new File([bytes], "multi-sheet.xlsx");
    const result = await parseCustomerExcel(file, "العملاء الفعليون");
    expect(result.sheetNames).toEqual(["ملخص", "العملاء الفعليون"]);
    expect(result.selectedSheetName).toBe("العملاء الفعليون");
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ name: "عميل من الورقة المختارة", phone: "0500000099" });
  });

  it("يعطي رسالة واضحة عند اختيار ورقة غير موجودة", async () => {
    const XLSX = await import("xlsx");
    const worksheet = XLSX.utils.aoa_to_sheet([["اسم العميل", "الهاتف"], ["عميل", "0500000003"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "العملاء");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const result = await parseCustomerExcel(new File([bytes], "missing-sheet.xlsx"), "غير موجودة");
    expect(result.sheetNames).toEqual(["العملاء"]);
    expect(result.rows).toEqual([]);
    expect(result.issues[0]?.reason).toContain("غير موجودة");
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

  it("يقرأ جدول PDF النصي ويحوّله إلى صف عميل", async () => {
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    pdf.text("Name", 30, 30);
    pdf.text("Phone", 110, 30);
    pdf.text("Ali", 30, 45);
    pdf.text("0500000000", 110, 45);
    const bytes = pdf.output("arraybuffer");
    const result = await parseCustomerPdf(new File([bytes], "customers.pdf", { type: "application/pdf" }));
    expect(result.issues).toEqual([]);
    expect(result.rows[0]).toMatchObject({ name: "Ali", phone: "0500000000" });
  });

  it("يعطي رسالة واضحة عند PDF لا يحتوي على نص قابل للاستخراج", async () => {
    const { jsPDF } = await import("jspdf");
    const bytes = new jsPDF().output("arraybuffer");
    const result = await parseCustomerPdf(new File([bytes], "scanned.pdf", { type: "application/pdf" }));
    expect(result.rows).toEqual([]);
    expect(result.issues[0]?.reason).toContain("PDF");
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
    const rows = visitRowsForExcel([{ customer: { manualCode: "ع-1", name: "عميل", phone: "0500", address: "العنوان" }, visitType: "maintenance", visitDate: "2026-08-17T10:00:00.000Z", technicianName: "فني", collectedAmount: 125, visitResult: "تمت الصيانة" }]);
    expect(rows[0]).toMatchObject({ customerCode: "ع-1", customerName: "عميل", visitType: "صيانة", technicianName: "فني", collectedAmount: 125, visitResult: "تمت الصيانة" });
    expect(withArabicHeaders(rows, visitExcelHeaders)[0]["نتيجة الزيارة"]).toBe("تمت الصيانة");
  });

  it("يبني تقرير أخطاء عربيًا مع رقم الصف والسبب والبيانات الأصلية", () => {
    const rows = customerImportIssuesForExcel([{ rowNumber: 7, reason: "رقم الهاتف ناقص", data: { "اسم العميل": "عميل ناقص", "الهاتف": "" } }]);
    expect(rows).toEqual([{ "رقم الصف": 7, "سبب الرفض": "رقم الهاتف ناقص", "اسم العميل": "عميل ناقص", "الهاتف": "" }]);
  });

  it("يعرب عناوين Excel والقيم الداخلية مع الحفاظ على النصوص الحرة", () => {
    const rows = localizeExcelRows([
      { customerName: "عميل إنجليزي الاسم", visitType: "maintenance", status: "pending", transactionType: "income", notes: "ملاحظة خاصة" },
    ]);
    expect(rows[0]).toEqual({ "اسم العميل": "عميل إنجليزي الاسم", "نوع الزيارة": "صيانة", الحالة: "معلق", "نوع الحركة": "إيراد", ملاحظات: "ملاحظة خاصة" });
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

