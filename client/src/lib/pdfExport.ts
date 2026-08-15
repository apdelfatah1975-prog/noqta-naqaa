import { formatDate } from "./filterUi";

export type PdfColumn = { key: string; label: string };

const escapeHtml = (value: unknown) => String(value ?? "—")
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
  <footer class="footer">هذا التقرير تم إنشاؤه من نظام نقطة نقاء لإدارة تركيب وصيانة فلاتر مياه الشرب.</footer>
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
