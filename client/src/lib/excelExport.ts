import * as XLSX from "xlsx";
import { getDocument } from "pdfjs-dist";


export type CustomerImportRow = {
  rowNumber: number;
  name: string;
  phone: string;
  manualCode?: string | null;
  address?: string | null;
  location?: string | null;
  notes?: string | null;
  technicianName?: string | null;
  visitDate?: string | null;
  visitType?: "installation" | "maintenance" | "cartridge_change" | "follow_up" | "other" | null;
  collectedAmount?: number | null;
  nextVisitDate?: string | null;
};

const visitTypeAliases: Record<NonNullable<CustomerImportRow["visitType"]>, string[]> = {
  installation: ["تركيب فلتر", "تركيب", "installation", "install"],
  maintenance: ["صيانة", "maintenance", "maintain"],
  cartridge_change: ["تغيير شمعات", "تغيير الشمعات", "شمعات", "cartridge change", "cartridge_change"],
  follow_up: ["متابعة", "follow up", "follow_up"],
  other: ["أخرى", "اخرى", "أخرى", "other"],
};

function parseVisitType(value: unknown): CustomerImportRow["visitType"] {
  const normalized = normalizeImportHeader(value);
  if (!normalized) return null;
  const exact = Object.entries(visitTypeAliases).find(([, aliases]) => aliases.some(alias => normalizeImportHeader(alias) === normalized))?.[0] as CustomerImportRow["visitType"] | undefined;
  if (exact) return exact;

  // بعض الملفات تستخدم وصف التنفيذ الكامل بدل نوع الزيارة المختصر.
  // نعطي إشارات تغيير الشمعات أولوية على التركيب عند اجتماع النوعين.
  if (/(تغيير|شمع|مراحل|شمعة)/.test(normalized)) return "cartridge_change";
  if (/(متابع|تذكير)/.test(normalized)) return "follow_up";
  if (/(صيان|اصلاح)/.test(normalized)) return "maintenance";
  if (/(تركيب|جهاز|فلتر|براده|ستاند)/.test(normalized)) return "installation";
  return null;
}

function parseDateCell(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  const text = textCell(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function nextFollowUpDate(visitDate: string | null, visitType: CustomerImportRow["visitType"]): string | null {
  if (!visitDate || (visitType !== "installation" && visitType !== "maintenance")) return null;
  const date = new Date(visitDate);
  date.setUTCDate(date.getUTCDate() + 120);
  return date.toISOString();
}

export type CustomerImportIssue = { rowNumber: number; reason: string; data?: Record<string, unknown> };

function normalizeImportHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ar-EG")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[\u0640\s_\-:/\\]+/g, "");
}

function textCell(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

const emptyExcelTokens = new Set(["null", "undefined", "n/a", "na", "none", "غير محدد", "غير مسجل"]);

export function cleanExcelCell(value: unknown): unknown {
  if (value === undefined || value === null) return "";
  if (typeof value === "string") {
    const cleaned = value.replace(/[\u200B\uFEFF]/g, "").trim();
    return emptyExcelTokens.has(cleaned.toLocaleLowerCase("ar-EG")) ? "" : cleaned;
  }
  return value;
}

function cleanExcelRow(row: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, cleanExcelCell(value)]));
}

const excelValueLabels: Record<string, string> = {
  installation: "تركيب فلتر",
  install: "تركيب فلتر",
  maintenance: "صيانة",
  maintain: "صيانة",
  cartridge_change: "تغيير شمعات",
  "cartridge change": "تغيير شمعات",
  follow_up: "متابعة",
  "follow up": "متابعة",
  other: "أخرى",
  income: "إيراد",
  expense: "مصروف",
  pending: "معلق",
  completed: "مكتمل",
  dismissed: "تم التجاوز",
  paid: "مدفوع",
  remaining: "متبقي",
  all: "الكل",
};

const excelKeyLabels: Record<string, string> = {
  customerCode: "كود العميل",
  customerName: "اسم العميل",
  phone: "الهاتف",
  address: "العنوان",
  location: "الموقع",
  notes: "ملاحظات",
  technicianName: "اسم الفني",
  visitType: "نوع الزيارة",
  visitDate: "تاريخ الزيارة",
  collectedAmount: "المبلغ المحصل",
  status: "الحالة",
  transactionType: "نوع الحركة",
  category: "التصنيف",
  recipientName: "الفني أو المستلم",
};

function localizeExcelValue(key: string, value: unknown) {
  if (typeof value !== "string") return value;
  const normalizedKey = key.trim().toLocaleLowerCase("ar-EG");
  const normalizedValue = value.trim().toLocaleLowerCase("ar-EG");
  const shouldTranslate = ["النوع", "نوع الزيارة", "نوع آخر خدمة", "الحالة", "نوع الحركة", "التصنيف", "البند", "category", "status", "transactiontype", "visittype"].some(token => normalizedKey === token || normalizedKey.includes(token));
  return shouldTranslate ? excelValueLabels[normalizedValue] ?? value : value;
}

export function localizeExcelRows(rows: Array<Record<string, unknown>>) {
  return rows.map(row => Object.fromEntries(Object.entries(cleanExcelRow(row)).map(([key, value]) => {
    const arabicKey = excelKeyLabels[key] ?? key;
    return [arabicKey, cleanExcelCell(localizeExcelValue(arabicKey, value))];
  })));
}

export async function parseCustomerPdf(file: File): Promise<{ rows: CustomerImportRow[]; issues: CustomerImportIssue[] }> {
  const pdf = await getDocument({ data: await file.arrayBuffer(), useWorkerFetch: false, isEvalSupported: false }).promise;
  const lines: Array<{ y: number; cells: Array<{ x: number; text: string }> }> = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const grouped = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const transform = "transform" in item ? item.transform : [1, 0, 0, 1, 0, 0];
      const y = Math.round(Number(transform[5]) / 2) * 2;
      const x = Number(transform[4]) || 0;
      const row = grouped.get(y) ?? [];
      row.push({ x, text: item.str.trim() });
      grouped.set(y, row);
    }
    Array.from(grouped.entries()).forEach(([y, cells]) => lines.push({ y: (pageNumber * 1_000_000) + y, cells: cells.sort((a: { x: number }, b: { x: number }) => a.x - b.x) }));
  }
  lines.sort((a, b) => b.y - a.y);
  const matrix = lines.map(line => line.cells.map(cell => cell.text));
  const aliases: Record<string, string[]> = {
    name: ["اسم العميل", "إسم العميل", "الاسم", "اسم", "name", "customer name"].map(normalizeImportHeader),
    phone: ["الهاتف", "رقم الهاتف", "رقم الجوال", "الجوال", "الموبايل", "phone", "mobile"].map(normalizeImportHeader),
    manualCode: ["كود العميل", "الكود", "رقم العميل", "code", "customer code"].map(normalizeImportHeader),
    address: ["العنوان", "address"].map(normalizeImportHeader),
    technicianName: ["الفني", "اسم الفني", "technician"].map(normalizeImportHeader),
    visitDate: ["تاريخ الزيارة", "تاريخ ووقت الزيارة", "visit date"].map(normalizeImportHeader),
    visitType: ["نوع الزيارة", "الخدمة", "نوع الخدمة", "visit type"].map(normalizeImportHeader),
    collectedAmount: ["المبلغ", "المبلغ المحصل", "المبلغ المدفوع", "amount"].map(normalizeImportHeader),
  };
  const matches = (key: string, value: unknown) => { const normalized = normalizeImportHeader(value); return normalized.length > 0 && aliases[key].some(alias => normalized === alias || normalized.includes(alias) || alias.includes(normalized)); };
  const headerIndex = matrix.findIndex(row => ["name", "phone"].filter(key => row.some(cell => matches(key, cell))).length === 2);
  if (headerIndex < 0) {
    return { rows: [], issues: [{ rowNumber: 1, reason: matrix.length ? "تعذر التعرف على صف عناوين اسم العميل والهاتف في PDF. إذا كان الملف مصورًا، حوّله إلى Excel أو PDF نصي قابل للتحديد." : "ملف PDF لا يحتوي على نص قابل للاستخراج؛ يبدو أنه صورة أو مسح ضوئي." }] };
  }
  const headerCells = matrix[headerIndex];
  const header = headerCells.map(normalizeImportHeader);
  const indexOf = (key: string) => header.findIndex(cell => matches(key, cell));
  const nameIndex = indexOf("name");
  const phoneIndex = indexOf("phone");
  const issues: CustomerImportIssue[] = [];
  const rows: CustomerImportRow[] = [];
  matrix.slice(headerIndex + 1).forEach((cells, offset) => {
    const rowNumber = headerIndex + offset + 2;
    const name = textCell(cells[nameIndex]);
    const phone = textCell(cells[phoneIndex]);
    if (!name && !phone) return;
    const sourceData = Object.fromEntries(headerCells.map((cell, index) => [cell || `عمود ${index + 1}`, cells[index] ?? ""]));
    if (!name || !phone) { issues.push({ rowNumber, reason: !name ? "اسم العميل ناقص" : "رقم الهاتف ناقص", data: sourceData }); return; }
    const value = (key: string) => { const index = indexOf(key); return index >= 0 ? textCell(cells[index]) : ""; };
    const visitDate = parseDateCell(value("visitDate"));
    const visitType = parseVisitType(value("visitType"));
    const amountText = value("collectedAmount").replace(/[,،\s]/g, "");
    const collectedAmount = amountText ? Number(amountText) : null;
    if (value("visitType") && !visitType) issues.push({ rowNumber, reason: "نوع الزيارة غير معروف", data: sourceData });
    if (value("visitType") && !visitDate) issues.push({ rowNumber, reason: "تاريخ الزيارة غير صالح", data: sourceData });
    if (amountText && (collectedAmount === null || !Number.isFinite(collectedAmount) || collectedAmount < 0)) issues.push({ rowNumber, reason: "المبلغ يجب أن يكون رقمًا موجبًا أو صفرًا", data: sourceData });
    rows.push({ rowNumber, name, phone, manualCode: value("manualCode") || null, address: value("address") || null, technicianName: value("technicianName") || null, visitDate, visitType: visitType || null, collectedAmount: collectedAmount ?? null, nextVisitDate: nextFollowUpDate(visitDate, visitType) });
  });
  return { rows, issues };
}

export async function parseCustomerExcel(file: File, requestedSheetName?: string): Promise<{ rows: CustomerImportRow[]; issues: CustomerImportIssue[]; sheetNames: string[]; selectedSheetName: string | null }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetNames = workbook.SheetNames;
  const selectedSheet = requestedSheetName?.trim() || null;
  const aliases: Record<string, string[]> = {
    name: ["اسم العميل", "إسم العميل", "الاسم", "اسم", "name", "customername", "customer name"].map(normalizeImportHeader),
    phone: ["الهاتف", "رقم الهاتف", "رقم الجوال", "الجوال", "الموبايل", "رقم الموبايل", "phone", "mobile"].map(normalizeImportHeader),
    manualCode: ["كود العميل", "الكود", "رقم العميل", "code", "customercode"].map(normalizeImportHeader),
    address: ["العنوان", "address"].map(normalizeImportHeader),
    location: ["الموقع", "الموقع gps", "gps", "location"].map(normalizeImportHeader),
    notes: ["ملاحظات", "الملاحظات", "notes"].map(normalizeImportHeader),
    technicianName: ["الفني", "اسم الفني", "الفني المنفذ", "technician", "technicianname"].map(normalizeImportHeader),
    visitDate: ["تاريخ الزيارة", "تاريخ ووقت الزيارة", "visit date", "visitdate"].map(normalizeImportHeader),
    visitType: ["نوع الزيارة", "الخدمة", "نوع الخدمة", "visit type", "visittype"].map(normalizeImportHeader),
    collectedAmount: ["المبلغ", "المبلغ المحصل", "المبلغ المدفوع", "amount", "collectedamount"].map(normalizeImportHeader),
  };
  const headerMatches = (key: string, item: unknown) => {
    const normalizedItem = normalizeImportHeader(item);
    if (!normalizedItem) return false;
    return aliases[key].some(alias => normalizedItem === alias || normalizedItem.includes(alias) || alias.includes(normalizedItem));
  };
  const scoreHeader = (cells: unknown[]) => ["name", "phone"].filter(key => cells.some(item => headerMatches(key, item))).length;
  const candidates: Array<{ sheetName: string; matrix: unknown[][]; headerRow: number; score: number }> = [];
  for (const sheetName of workbook.SheetNames) {
    if (selectedSheet && sheetName !== selectedSheet) continue;
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
    const limit = Math.min(matrix.length, 30);
    let best = { headerRow: -1, score: 0 };
    for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
      const score = scoreHeader(matrix[rowIndex] ?? []);
      if (score > best.score) best = { headerRow: rowIndex, score };
    }
    if (best.headerRow >= 0) candidates.push({ sheetName, matrix, ...best });
  }
  const selected = candidates.sort((a, b) => b.score - a.score)[0];
  if (!selected || selected.score < 2) {
    const detected = selected?.matrix[selected.headerRow >= 0 ? selected.headerRow : 0]?.filter(Boolean).map(textCell).join("، ");
    return { sheetNames, selectedSheetName: selected?.sheetName ?? selectedSheet, rows: [], issues: [{ rowNumber: 1, reason: selectedSheet && !workbook.Sheets[selectedSheet] ? `ورقة العمل «${selectedSheet}» غير موجودة في الملف.` : `لم يتم التعرف على عمودي اسم العميل والهاتف. العناوين المقروءة: ${detected || "لا توجد عناوين واضحة"}` }] };
  }
  const { matrix, headerRow } = selected;
  const headerCells = matrix[headerRow] ?? [];
  const header = headerCells.map(normalizeImportHeader);
  const indexOf = (key: string) => header.findIndex(item => headerMatches(key, item));
  const nameIndex = indexOf("name");
  const phoneIndex = indexOf("phone");
  const issues: CustomerImportIssue[] = [];
  if (nameIndex < 0 || phoneIndex < 0) return { sheetNames, selectedSheetName: selected.sheetName, rows: [], issues: [{ rowNumber: headerRow + 1, reason: `لم يتم التعرف على عمودي اسم العميل والهاتف في ورقة «${selected.sheetName}». العناوين المقروءة: ${headerCells.filter(Boolean).map(textCell).join("، ") || "لا توجد عناوين واضحة"}` }] };
  const rows: CustomerImportRow[] = [];
  matrix.slice(headerRow + 1).forEach((cells, offset) => {
    const rowNumber = headerRow + offset + 2;
    const name = textCell(cells[nameIndex]);
    const phone = textCell(cells[phoneIndex]);
    if (!name && !phone) return;
    const sourceData = Object.fromEntries(headerCells.map((headerCell, index) => [textCell(headerCell) || `عمود ${index + 1}`, cells[index] ?? ""]));
    const importName = name || `عميل بدون اسم - صف ${rowNumber}`;
    const importPhone = phone || `بدون هاتف - صف ${rowNumber}`;
    if (!name) issues.push({ rowNumber, reason: `اسم العميل ناقص؛ تم استخدام اسم مؤقت «${importName}» حتى لا تضيع الزيارة.`, data: sourceData });
    if (!phone) issues.push({ rowNumber, reason: `رقم الهاتف ناقص؛ تم استخدام قيمة مؤقتة «${importPhone}» ويمكن تعديلها بعد الاستيراد.`, data: sourceData });
    const value = (key: string) => { const index = indexOf(key); return index >= 0 ? textCell(cells[index]) : ""; };
    const visitDateIndex = indexOf("visitDate");
    const visitTypeIndex = indexOf("visitType");
    const amountIndex = indexOf("collectedAmount");
    const visitDate = parseDateCell(visitDateIndex >= 0 ? cells[visitDateIndex] : "");
    const rawVisitType = visitTypeIndex >= 0 ? cells[visitTypeIndex] : "";
    const visitType = parseVisitType(rawVisitType);
    const rawAmount = amountIndex >= 0 ? cells[amountIndex] : "";
    const amountText = textCell(rawAmount).replace(/[,،\s]/g, "");
    const collectedAmount = amountText ? Number(amountText) : null;
    if (rawVisitType && !visitType) issues.push({ rowNumber, reason: "نوع الزيارة غير معروف؛ استخدم تركيب فلتر أو صيانة أو تغيير شمعات أو متابعة أو أخرى", data: sourceData });
    if (rawAmount && (collectedAmount === null || !Number.isFinite(collectedAmount) || collectedAmount < 0)) issues.push({ rowNumber, reason: "المبلغ يجب أن يكون رقمًا موجبًا أو صفرًا", data: sourceData });
    if (rawVisitType && !visitDate) issues.push({ rowNumber, reason: "تاريخ الزيارة غير صالح", data: sourceData });
    rows.push({ rowNumber, name: importName, phone: importPhone, manualCode: value("manualCode") || null, address: value("address") || null, location: value("location") || null, notes: value("notes") || null, technicianName: value("technicianName") || null, visitDate, visitType: visitType || null, collectedAmount: collectedAmount ?? null, nextVisitDate: nextFollowUpDate(visitDate, visitType) });
  });
  return { sheetNames, selectedSheetName: selected.sheetName, rows, issues };
}

export function downloadCustomerImportTemplate() {
  const rows = [{ "اسم العميل": "مثال: محمد أحمد", "الهاتف": "0500000000", "كود العميل": "", "العنوان": "الرياض", "الموقع": "رابط Google Maps أو وصف الموقع", "ملاحظات": "", "الفني": "", "تاريخ الزيارة": "2026-01-15", "نوع الزيارة": "صيانة", "المبلغ": 0 }];
  downloadRowsAsExcel("قالب-استيراد-العملاء-نقطة-نقاء.xlsx", "العملاء", rows);
}
import { labelVisitType } from "@/lib/filterUi";

export type CustomerExportRow = {
  customerCode: string;
  name: string;
  phone: string;
  address: string;
  followUpDate: string;
  followUpDays: string;
  lastServiceType: string;
  latestTechnicianName: string;
  totalCollectedAmount: number | "";
};

export type VisitExportRow = {
  customerCode: string;
  customerName: string;
  phone: string;
  address: string;
  visitType: string;
  visitDate: string;
  technicianName: string;
  collectedAmount: number | "";
  visitResult: string;
};

export type ReminderExportRow = {
  customerCode: string;
  customerName: string;
  phone: string;
  reminderDate: string;
  lastServiceType: string;
  lastServiceDate: string;
  daysOverdue: number | "";
  status: string;
};

export function customerRowsForExcel(customers: Array<any>): CustomerExportRow[] {
  return customers.map(customer => ({
    customerCode: customer.customerCode || "",
    name: customer.name || "",
    phone: customer.phone || "",
    address: customer.address || "",
    followUpDate: customer.followUp?.nextVisitDate ? new Date(customer.followUp.nextVisitDate).toLocaleDateString("ar-EG") : "",
    followUpDays: customer.followUp ? (customer.followUp.daysRemaining < 0 ? `متأخر ${Math.abs(customer.followUp.daysRemaining)} يوم` : customer.followUp.daysRemaining === 0 ? "اليوم" : `${customer.followUp.daysRemaining} يوم`) : "",
    lastServiceType: customer.followUp?.lastServiceVisitType ? labelVisitType(customer.followUp.lastServiceVisitType) : "",
    latestTechnicianName: customer.latestTechnicianName || "",
    totalCollectedAmount: customer.totalCollectedAmount == null ? "" : Number(customer.totalCollectedAmount),
  }));
}

export function visitRowsForExcel(visits: Array<any>): VisitExportRow[] {
  return visits.map(visit => ({
    customerCode: visit.customer?.manualCode || visit.customer?.customerCode || "",
    customerName: visit.customer?.name || "",
    phone: visit.customer?.phone || "",
    address: visit.customer?.address || "",
    visitType: visit.visitType ? labelVisitType(visit.visitType) : "",
    visitDate: visit.visitDate ? new Date(visit.visitDate).toLocaleString("ar-EG") : "",
    technicianName: visit.technicianName || "",
    collectedAmount: visit.collectedAmount == null ? "" : Number(visit.collectedAmount),
    visitResult: visit.visitResult || visit.visitOutcome || visit.result || visit.notes || "",
  }));
}

export function reminderRowsForExcel(reminders: Array<any>): ReminderExportRow[] {
  return reminders.map(reminder => ({
    customerCode: reminder.customer?.customerCode || "",
    customerName: reminder.customer?.name || "",
    phone: reminder.customer?.phone || "",
    reminderDate: reminder.reminderDate ? new Date(reminder.reminderDate).toLocaleDateString("ar-EG") : "",
    lastServiceType: reminder.lastServiceVisitType ? labelVisitType(reminder.lastServiceVisitType) : "",
    lastServiceDate: reminder.lastServiceVisitDate ? new Date(reminder.lastServiceVisitDate).toLocaleDateString("ar-EG") : "",
    daysOverdue: reminder.daysOverdue == null ? "" : reminder.daysOverdue,
    status: reminder.status === "pending" ? "معلق" : reminder.status || "",
  }));
}

export function customerImportIssuesForExcel(issues: CustomerImportIssue[]): Array<Record<string, unknown>> {
  return localizeExcelRows(issues.map(issue => ({ "رقم الصف": issue.rowNumber, "سبب الرفض": issue.reason, ...(issue.data ?? {}) })));
}

export function downloadCustomerImportIssues(issues: CustomerImportIssue[]) {
  if (!issues.length) return false;
  downloadRowsAsExcel("أخطاء-استيراد-العملاء-نقطة-نقاء.xlsx", "أخطاء الاستيراد", customerImportIssuesForExcel(issues));
  return true;
}

export function downloadRowsAsExcel(filename: string, sheetName: string, rows: Array<Record<string, unknown>>) {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? localizeExcelRows(rows) : [{ "لا توجد بيانات": "" }]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31) || "البيانات");
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    link.remove();
    URL.revokeObjectURL(href);
  }, 1000);
  return true;
}

export const customerExcelHeaders: Record<keyof CustomerExportRow, string> = {
  customerCode: "كود العميل",
  name: "اسم العميل",
  phone: "الهاتف",
  address: "العنوان",
  followUpDate: "موعد المتابعة",
  followUpDays: "الأيام المتبقية",
  lastServiceType: "نوع آخر خدمة",
  latestTechnicianName: "اسم الفني لآخر زيارة",
  totalCollectedAmount: "إجمالي المحصل",
};

export const visitExcelHeaders: Record<keyof VisitExportRow, string> = {
  customerCode: "كود العميل",
  customerName: "اسم العميل",
  phone: "الهاتف",
  address: "العنوان",
  visitType: "نوع الزيارة",
  visitDate: "تاريخ ووقت الزيارة",
  technicianName: "اسم الفني",
  collectedAmount: "المبلغ المحصل",
  visitResult: "نتيجة الزيارة",
};

export const reminderExcelHeaders: Record<keyof ReminderExportRow, string> = {
  customerCode: "كود العميل",
  customerName: "اسم العميل",
  phone: "الهاتف",
  reminderDate: "تاريخ التذكير",
  lastServiceType: "نوع آخر خدمة",
  lastServiceDate: "تاريخ آخر خدمة",
  daysOverdue: "أيام التأخر",
  status: "الحالة",
};

export function withArabicHeaders<T extends Record<string, unknown>>(rows: T[], headers: Record<keyof T, string>): Array<Record<string, unknown>> {
  return localizeExcelRows(rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [headers[key as keyof T], value]))));
}


export function parseCustomerClipboard(text: string): { rows: CustomerImportRow[]; issues: CustomerImportIssue[] } {
  const lines = text.replace(/\r/g, "").split("\n").filter(line => line.trim());
  const matrix = lines.map(line => line.split("\t").map(cell => cell.trim()));
  if (!matrix.length) return { rows: [], issues: [{ rowNumber: 1, reason: "لم يتم لصق أي بيانات." }] };
  const aliases: Record<string, string[]> = {
    name: ["اسم العميل", "إسم العميل", "الاسم", "اسم", "name", "customer name"].map(normalizeImportHeader),
    phone: ["الهاتف", "رقم الهاتف", "رقم الجوال", "الجوال", "الموبايل", "رقم الموبايل", "phone", "mobile"].map(normalizeImportHeader),
    manualCode: ["كود العميل", "الكود", "رقم العميل", "code", "customer code"].map(normalizeImportHeader),
    address: ["العنوان", "address"].map(normalizeImportHeader),
    location: ["الموقع", "الموقع gps", "gps", "location"].map(normalizeImportHeader),
    notes: ["ملاحظات", "الملاحظات", "notes"].map(normalizeImportHeader),
    technicianName: ["الفني", "اسم الفني", "الفني المنفذ", "technician"].map(normalizeImportHeader),
    visitDate: ["تاريخ الزيارة", "تاريخ ووقت الزيارة", "visit date"].map(normalizeImportHeader),
    visitType: ["نوع الزيارة", "الخدمة", "نوع الخدمة", "visit type"].map(normalizeImportHeader),
    collectedAmount: ["المبلغ", "المبلغ المحصل", "المبلغ المدفوع", "amount"].map(normalizeImportHeader),
  };
  const matches = (key: string, value: unknown) => { const normalized = normalizeImportHeader(value); return aliases[key].some(alias => normalized === alias || normalized.includes(alias) || alias.includes(normalized)); };
  const header = matrix[0];
  const indexOf = (key: string) => header.findIndex(cell => matches(key, cell));
  const nameIndex = indexOf("name");
  const phoneIndex = indexOf("phone");
  if (nameIndex < 0 || phoneIndex < 0) return { rows: [], issues: [{ rowNumber: 1, reason: "يجب أن تكون أول خلية منسوخة هي صف العناوين، وأن يحتوي على اسم العميل والهاتف." }] };
  const value = (cells: string[], key: string) => { const index = indexOf(key); return index >= 0 ? textCell(cells[index]) : ""; };
  const rows: CustomerImportRow[] = [];
  const issues: CustomerImportIssue[] = [];
  matrix.slice(1).forEach((cells, offset) => {
    const rowNumber = offset + 2;
    const name = textCell(cells[nameIndex]);
    const phone = textCell(cells[phoneIndex]);
    if (!name && !phone) return;
    const importName = name || `عميل بدون اسم - صف ${rowNumber}`;
    const importPhone = phone || `بدون هاتف - صف ${rowNumber}`;
    if (!name) issues.push({ rowNumber, reason: `اسم العميل ناقص؛ تم استخدام اسم مؤقت «${importName}».` });
    if (!phone) issues.push({ rowNumber, reason: `رقم الهاتف ناقص؛ تم استخدام قيمة مؤقتة «${importPhone}».` });
    const visitType = parseVisitType(value(cells, "visitType"));
    const visitDate = parseDateCell(value(cells, "visitDate"));
    const amountText = value(cells, "collectedAmount").replace(/[,،\s]/g, "");
    const collectedAmount = amountText ? Number(amountText) : null;
    if (value(cells, "visitType") && !visitType) issues.push({ rowNumber, reason: "نوع الزيارة غير معروف." });
    if (value(cells, "visitType") && !visitDate) issues.push({ rowNumber, reason: "تاريخ الزيارة غير صالح." });
    if (amountText && (collectedAmount === null || !Number.isFinite(collectedAmount) || collectedAmount < 0)) issues.push({ rowNumber, reason: "المبلغ يجب أن يكون رقمًا موجبًا أو صفرًا." });
    rows.push({ rowNumber, name: importName, phone: importPhone, manualCode: value(cells, "manualCode") || null, address: value(cells, "address") || null, location: value(cells, "location") || null, notes: value(cells, "notes") || null, technicianName: value(cells, "technicianName") || null, visitDate, visitType: visitType || null, collectedAmount: collectedAmount ?? null, nextVisitDate: nextFollowUpDate(visitDate, visitType) });
  });
  return { rows, issues };
}
