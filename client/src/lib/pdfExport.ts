import { formatDate } from "./filterUi";

export type PdfColumn = { key: string; label: string };

const escapeHtml = (value: unknown) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

export function buildArabicPdfDocument(
  title: string,
  rows: Array<Record<string, unknown>>,
  columns: PdfColumn[],
  date = new Date(),
) {
  const header = columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(row[column.key])}</td>`).join("")}</tr>`).join("");
  const reportDate = escapeHtml(formatDate(date));

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)} - نقطة نقاء</title>
<style>
  @page { size: A4; margin: 16mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #123c39; font-family: Tahoma, Arial, sans-serif; direction: rtl; background: #fff; }
  .report { width: 100%; }
  .header { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 14px; border-bottom: 3px solid #0f766e; }
  .brand { display: flex; align-items: center; gap: 12px; }
  .mark { width: 48px; height: 48px; border-radius: 15px; background: #0f766e; display: grid; place-items: center; }
  .mark svg { width: 29px; height: 29px; fill: none; stroke: #fff; stroke-width: 2.5; }
  h1 { margin: 0; font-size: 20px; color: #064e4a; }
  .company { margin: 3px 0 0; color: #4b706c; font-size: 12px; }
  .meta { text-align: left; color: #52716e; font-size: 12px; line-height: 1.8; }
  .meta strong { display: block; color: #123c39; font-size: 13px; }
  .intro { margin: 20px 0 12px; display: flex; justify-content: space-between; align-items: end; gap: 12px; }
  .intro h2 { margin: 0; font-size: 18px; }
  .intro p { margin: 0; color: #64817e; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #e6f5f2; color: #064e4a; font-weight: 700; }
  th, td { padding: 9px 8px; border: 1px solid #c9dfdc; text-align: right; vertical-align: top; }
  tbody tr:nth-child(even) { background: #f8fcfb; }
  .footer { margin-top: 18px; padding-top: 9px; border-top: 1px solid #c9dfdc; color: #6a8582; font-size: 10px; }
  .page-number::after { content: "صفحة " counter(page) " من " counter(pages); }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<main class="report">
  <header class="header">
    <div class="brand">
      <div class="mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3.5c-2.7 3.1-5.8 6.4-5.8 10.1a5.8 5.8 0 0 0 11.6 0C17.8 9.9 14.7 6.6 12 3.5Z"/><path d="M9.2 14.2c.4 1.4 1.3 2.2 2.8 2.5"/></svg></div>
      <div><h1>نقطة نقاء</h1><p class="company">إدارة فلاتر مياه الشرب</p></div>
    </div>
    <div class="meta"><strong>تاريخ التقرير</strong>${reportDate}</div>
  </header>
  <section class="intro"><div><h2>${escapeHtml(title)}</h2><p>تقرير صادر من نظام نقطة نقاء</p></div><p>عدد السجلات: ${escapeHtml(rows.length)}</p></section>
  <table><thead><tr>${header}</tr></thead><tbody>${body || `<tr><td colspan="${columns.length}">لا توجد بيانات لعرضها</td></tr>`}</tbody></table>
  <footer class="footer"><span>هذا التقرير تم إنشاؤه من نظام نقطة نقاء لإدارة تركيب وصيانة فلاتر مياه الشرب.</span><span class="page-number" style="float:left"></span></footer>
</main>
</body>
</html>`;
}

export function openArabicPdfPrintWindow(html: string) {
  if (typeof window === "undefined") return false;
  const reportWindow = window.open("", "_blank", "width=960,height=720");
  if (!reportWindow) return false;
  reportWindow.document.open();
  reportWindow.document.write(html);
  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.onload = () => reportWindow.print();
  return true;
}

export function printArabicPdf(title: string, rows: Array<Record<string, unknown>>, columns: PdfColumn[]) {
  const opened = openArabicPdfPrintWindow(buildArabicPdfDocument(title, rows, columns));
  return opened;
}

export type VisitReportInput = {
  companyName?: string | null;
  workOrderId?: number | string | null;
  customerName: string;
  customerPhone?: string | null;
  customerAddress?: string | null;
  visitType: string;
  visitDate: Date | string;
  technicianName?: string | null;
  tdsIn?: number | null;
  tdsOut?: number | null;
  collectedAmount?: number | null;
  currency?: string | null;
  visitResult?: string | null;
  notes?: string | null;
  items?: Array<{ name: string; quantity: number; unit?: string | null }>;
  includeSignatures?: boolean;
};

export function buildVisitReportDocument(visit: VisitReportInput) {
  const text = (value: unknown) => escapeHtml(value ?? "");
  const date = new Date(visit.visitDate);
  const items = visit.items ?? [];
  const documentTitle = visit.includeSignatures ? `أمر عمل رقم ${visit.workOrderId ?? ""}` : "تقرير زيارة / فاتورة خدمة";
  const companyName = visit.companyName?.trim() || "نقطة نقاء";
  const signatures = visit.includeSignatures ? `<section class="section"><h2>التوقيعات</h2><div class="signatures"><div class="signature">توقيع الفني</div><div class="signature">توقيع العميل</div></div></section>` : "";
  const itemRows = items.length
    ? items.map(item => `<tr><td>${text(item.name)}</td><td>${text(item.quantity)}</td><td>${text(item.unit || "قطعة")}</td></tr>`).join("")
    : `<tr><td colspan="3">لم تُسجل أصناف مستبدلة</td></tr>`;
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>${text(documentTitle)} - ${text(visit.customerName)}</title>
<style>
@page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;color:#173f3b;font-family:Cairo,Tahoma,Arial,sans-serif;background:#fff}.sheet{border:1px solid #c9dfdc;padding:24px}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #0f766e;padding-bottom:16px}.brand h1{margin:0;color:#064e4a;font-size:24px}.brand p{margin:5px 0 0;color:#5b7773;font-size:12px}.badge{background:#e6f5f2;color:#064e4a;padding:9px 13px;border-radius:9px;font-size:12px;font-weight:bold}.section{margin-top:20px}.section h2{margin:0 0 10px;color:#0f766e;font-size:15px;border-bottom:1px solid #c9dfdc;padding-bottom:7px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{background:#f7fbfa;padding:10px;border-right:3px solid #8bcfc5}.field span{display:block;color:#6b8581;font-size:10px;margin-bottom:4px}.field strong{font-size:13px}.result{white-space:pre-wrap;line-height:1.9;background:#f7fbfa;padding:12px;min-height:45px}table{width:100%;border-collapse:collapse;font-size:11px}th,td{border:1px solid #c9dfdc;padding:8px;text-align:right}th{background:#e6f5f2;color:#064e4a}.total{margin-top:14px;text-align:left;font-size:18px;font-weight:bold;color:#0f766e}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:30px}.signature{height:70px;border-top:1px solid #7b9d98;padding-top:8px;color:#52716e;font-size:11px}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #c9dfdc;color:#6b8581;font-size:10px}.page-number::after{content:"صفحة " counter(page) " من " counter(pages)}@media print{.no-print{display:none}}
</style></head><body><main class="sheet"><header class="top"><div class="brand"><h1>${text(companyName)}</h1><p>إدارة فلاتر مياه الشرب</p></div><div class="badge">تقرير زيارة / فاتورة خدمة<br>${text(formatDate(date))}</div></header>
<section class="section"><h2>بيانات العميل</h2><div class="grid"><div class="field"><span>اسم العميل</span><strong>${text(visit.customerName)}</strong></div><div class="field"><span>الهاتف</span><strong dir="ltr">${text(visit.customerPhone)}</strong></div><div class="field"><span>العنوان</span><strong>${text(visit.customerAddress)}</strong></div><div class="field"><span>نوع الزيارة والفني</span><strong>${text(visit.visitType)} — ${text(visit.technicianName)}</strong></div></div></section>
<section class="section"><h2>تفاصيل القياس والتحصيل</h2><div class="grid"><div class="field"><span>TDS In — قبل الفلتر</span><strong>${text(visit.tdsIn == null ? "" : `${visit.tdsIn} ppm`)}</strong></div><div class="field"><span>TDS Out — بعد الفلتر</span><strong>${text(visit.tdsOut == null ? "" : `${visit.tdsOut} ppm`)}</strong></div></div><p class="total">المبلغ المحصل: ${text(Number(visit.collectedAmount || 0).toLocaleString("ar-SA"))} ${text(visit.currency || "SAR")}</p></section>
<section class="section"><h2>الأصناف المستبدلة</h2><table><thead><tr><th>الصنف</th><th>الكمية</th><th>الوحدة</th></tr></thead><tbody>${itemRows}</tbody></table></section>
<section class="section"><h2>نتيجة الزيارة والملاحظات</h2><div class="result">${text(visit.visitResult || visit.notes || "")}</div></section>${signatures}<footer class="footer"><span>تم إنشاء هذا التقرير من نظام نقطة نقاء. يمكن طباعته أو حفظه بصيغة PDF من نافذة الطباعة.</span><span class="page-number" style="float:left"></span></footer></main></body></html>`;
}

export function printVisitReport(visit: VisitReportInput) {
  return openArabicPdfPrintWindow(buildVisitReportDocument(visit));
}

export type CustomerProfileReportInput = {
  customerName: string;
  customerCode?: string | number | null;
  phone?: string | null;
  address?: string | null;
  location?: string | null;
  filterType?: string | null;
  installationDate?: Date | string | null;
  notes?: string | null;
  nextFollowUpDate?: Date | string | null;
  companyName?: string | null;
  visits: Array<{ visitType?: string | null; visitDate?: Date | string | null; technicianName?: string | null; tdsIn?: number | null; tdsOut?: number | null; collectedAmount?: number | null; notes?: string | null }>;
};

const formatOptionalDate = (value: Date | string | null | undefined) => value ? escapeHtml(formatDate(new Date(value))) : "";
const formatOptionalMoney = (value: number | null | undefined) => value == null ? "" : escapeHtml(value.toLocaleString("ar-SA"));

export function buildCustomerProfileDocument(report: CustomerProfileReportInput) {
  const companyName = report.companyName?.trim() || "نقطة نقاء";
  const field = (label: string, value: unknown, direction = "") => `<div class="field"><span>${escapeHtml(label)}</span><strong${direction ? ` dir="${direction}"` : ""}>${escapeHtml(value)}</strong></div>`;
  const visits = report.visits.map(visit => `<tr><td>${escapeHtml(visit.visitType)}</td><td>${formatOptionalDate(visit.visitDate)}</td><td>${escapeHtml(visit.technicianName)}</td><td>${escapeHtml(visit.tdsIn == null ? "" : `${visit.tdsIn} ppm`)}</td><td>${escapeHtml(visit.tdsOut == null ? "" : `${visit.tdsOut} ppm`)}</td><td>${formatOptionalMoney(visit.collectedAmount)}</td><td>${escapeHtml(visit.notes)}</td></tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/><title>ملف العميل - ${escapeHtml(report.customerName)}</title><style>
  @page{size:A4;margin:15mm}*{box-sizing:border-box}body{margin:0;color:#173f3b;font-family:Cairo,Tahoma,Arial,sans-serif;background:#fff}.sheet{width:100%}.top{display:flex;justify-content:space-between;gap:20px;border-bottom:4px solid #0f766e;padding-bottom:16px}.brand h1{margin:0;color:#064e4a;font-size:24px}.brand p{margin:5px 0 0;color:#5b7773;font-size:12px}.badge{background:#e6f5f2;color:#064e4a;padding:9px 13px;border-radius:9px;font-size:12px;font-weight:bold}.section{margin-top:20px}.section h2{margin:0 0 10px;color:#0f766e;font-size:15px;border-bottom:1px solid #c9dfdc;padding-bottom:7px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.field{background:#f7fbfa;padding:10px;border-right:3px solid #8bcfc5;min-height:48px}.field span{display:block;color:#6b8581;font-size:10px;margin-bottom:4px}.field strong{font-size:13px;white-space:pre-wrap}.result{white-space:pre-wrap;line-height:1.9;background:#f7fbfa;padding:12px;min-height:40px}table{width:100%;border-collapse:collapse;font-size:9px;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #c9dfdc;padding:6px;text-align:right;vertical-align:top}th{background:#e6f5f2;color:#064e4a}.footer{margin-top:24px;padding-top:10px;border-top:1px solid #c9dfdc;color:#6b8581;font-size:10px}.page-number::after{content:"صفحة " counter(page) " من " counter(pages)}@media print{.no-print{display:none}}
  </style></head><body><main class="sheet"><header class="top"><div class="brand"><h1>${escapeHtml(companyName)}</h1><p>ملف العميل وسجل الخدمات</p></div><div class="badge">تاريخ التقرير<br>${escapeHtml(formatDate(new Date()))}</div></header><section class="section"><h2>بيانات العميل</h2><div class="grid">${field("اسم العميل", report.customerName)}${field("كود العميل", report.customerCode)}${field("الهاتف", report.phone, "ltr")}${field("العنوان", report.address)}${field("نوع الفلتر", report.filterType)}${field("تاريخ التركيب", formatOptionalDate(report.installationDate))}${field("الموقع GPS", report.location, "ltr")}${field("موعد الشمعات القادم", formatOptionalDate(report.nextFollowUpDate))}</div></section>${report.notes ? `<section class="section"><h2>ملاحظات العميل</h2><div class="result">${escapeHtml(report.notes)}</div></section>` : ""}<section class="section"><h2>سجل الزيارات السابقة</h2><table><thead><tr><th>نوع الزيارة</th><th>التاريخ</th><th>الفني</th><th>TDS قبل</th><th>TDS بعد</th><th>المبلغ</th><th>ملاحظات</th></tr></thead><tbody>${visits || `<tr><td colspan="7">لا توجد زيارات مسجلة</td></tr>`}</tbody></table></section><footer class="footer"><span>تقرير صادر من نظام ${escapeHtml(companyName)} لإدارة فلاتر مياه الشرب.</span><span class="page-number" style="float:left"></span></footer></main></body></html>`;
}

export function printCustomerProfile(report: CustomerProfileReportInput) {
  return openArabicPdfPrintWindow(buildCustomerProfileDocument(report));
}

export function printCustomerSummary(report: CustomerProfileReportInput) {
  const rows = [
    { field: "اسم العميل", value: report.customerName },
    { field: "كود العميل", value: report.customerCode },
    { field: "الهاتف", value: report.phone },
    { field: "العنوان", value: report.address },
    { field: "نوع الفلتر", value: report.filterType },
    { field: "تاريخ التركيب", value: formatOptionalDate(report.installationDate) },
    { field: "الموقع GPS", value: report.location },
    { field: "موعد الشمعات القادم", value: formatOptionalDate(report.nextFollowUpDate) },
    { field: "ملاحظات العميل", value: report.notes },
  ];
  return printArabicPdf("بيانات العميل", rows, [{ key: "field", label: "البيان" }, { key: "value", label: "القيمة" }]);
}

export function printCustomerVisits(report: CustomerProfileReportInput) {
  const rows = report.visits.map(visit => ({
    type: visit.visitType,
    date: formatOptionalDate(visit.visitDate),
    technician: visit.technicianName,
    tdsIn: visit.tdsIn == null ? "" : `${visit.tdsIn} ppm`,
    tdsOut: visit.tdsOut == null ? "" : `${visit.tdsOut} ppm`,
    amount: formatOptionalMoney(visit.collectedAmount),
    notes: visit.notes,
  }));
  return printArabicPdf("سجل زيارات العميل", rows, [
    { key: "type", label: "نوع الزيارة" },
    { key: "date", label: "التاريخ" },
    { key: "technician", label: "الفني" },
    { key: "tdsIn", label: "TDS قبل" },
    { key: "tdsOut", label: "TDS بعد" },
    { key: "amount", label: "المبلغ" },
    { key: "notes", label: "ملاحظات" },
  ]);
}

export function printCustomerReminders(report: CustomerProfileReportInput) {
  return printArabicPdf("موعد متابعة العميل", [{ field: "موعد الشمعات القادم", value: formatOptionalDate(report.nextFollowUpDate) }], [{ key: "field", label: "البيان" }, { key: "value", label: "القيمة" }]);
}

export type WorkOrderReceiptInput = VisitReportInput & { workOrderId?: number | string | null; technicianName?: string | null };

export function buildWorkOrderReceiptDocument(order: WorkOrderReceiptInput) {
  return buildVisitReportDocument({ ...order, includeSignatures: true, workOrderId: order.workOrderId });
}

export function printWorkOrderReceipt(order: WorkOrderReceiptInput) {
  return openArabicPdfPrintWindow(buildWorkOrderReceiptDocument(order));
}
