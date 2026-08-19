import * as XLSX from "xlsx";

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

export async function parseCustomerExcel(file: File): Promise<{ rows: CustomerImportRow[]; issues: CustomerImportIssue[] }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
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
    return { rows: [], issues: [{ rowNumber: 1, reason: `لم يتم التعرف على عمودي اسم العميل والهاتف. العناوين المقروءة: ${detected || "لا توجد عناوين واضحة"}` }] };
  }
  const { matrix, headerRow } = selected;
  const headerCells = matrix[headerRow] ?? [];
  const header = headerCells.map(normalizeImportHeader);
  const indexOf = (key: string) => header.findIndex(item => headerMatches(key, item));
  const nameIndex = indexOf("name");
  const phoneIndex = indexOf("phone");
  const issues: CustomerImportIssue[] = [];
  if (nameIndex < 0 || phoneIndex < 0) return { rows: [], issues: [{ rowNumber: headerRow + 1, reason: `لم يتم التعرف على عمودي اسم العميل والهاتف. العناوين المقروءة: ${headerCells.filter(Boolean).map(textCell).join("، ") || "لا توجد عناوين واضحة"}` }] };
  const rows: CustomerImportRow[] = [];
  matrix.slice(headerRow + 1).forEach((cells, offset) => {
    const rowNumber = headerRow + offset + 2;
    const name = textCell(cells[nameIndex]);
    const phone = textCell(cells[phoneIndex]);
    if (!name && !phone) return;
    const sourceData = Object.fromEntries(headerCells.map((headerCell, index) => [textCell(headerCell) || `عمود ${index + 1}`, cells[index] ?? ""]));
    if (!name || !phone) { issues.push({ rowNumber, reason: !name ? "اسم العميل ناقص" : "رقم الهاتف ناقص", data: sourceData }); return; }
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
    rows.push({ rowNumber, name, phone, manualCode: value("manualCode") || null, address: value("address") || null, location: value("location") || null, notes: value("notes") || null, technicianName: value("technicianName") || null, visitDate, visitType: visitType || null, collectedAmount: collectedAmount ?? null, nextVisitDate: nextFollowUpDate(visitDate, visitType) });
  });
  return { rows, issues };
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
  totalCollectedAmount: number;
};

export type VisitExportRow = {
  customerCode: string;
  customerName: string;
  phone: string;
  address: string;
  visitType: string;
  visitDate: string;
  technicianName: string;
  collectedAmount: number;
  visitResult: string;
};

export type ReminderExportRow = {
  customerCode: string;
  customerName: string;
  phone: string;
  reminderDate: string;
  lastServiceType: string;
  lastServiceDate: string;
  daysOverdue: number;
  status: string;
};

export function customerRowsForExcel(customers: Array<any>): CustomerExportRow[] {
  return customers.map(customer => ({
    customerCode: customer.customerCode || "",
    name: customer.name || "",
    phone: customer.phone || "",
    address: customer.address || "",
    followUpDate: customer.followUp?.nextVisitDate ? new Date(customer.followUp.nextVisitDate).toLocaleDateString("ar-EG") : "",
    followUpDays: customer.followUp ? (customer.followUp.daysRemaining < 0 ? `متأخر ${Math.abs(customer.followUp.daysRemaining)} يوم` : customer.followUp.daysRemaining === 0 ? "اليوم" : `${customer.followUp.daysRemaining} يوم`) : "لا يوجد موعد",
    lastServiceType: labelVisitType(customer.followUp?.lastServiceVisitType),
    latestTechnicianName: customer.latestTechnicianName || "",
    totalCollectedAmount: Number(customer.totalCollectedAmount || 0) / 100,
  }));
}

export function visitRowsForExcel(visits: Array<any>): VisitExportRow[] {
  return visits.map(visit => ({
    customerCode: visit.customer?.manualCode || visit.customer?.customerCode || "",
    customerName: visit.customer?.name || "",
    phone: visit.customer?.phone || "",
    address: visit.customer?.address || "",
    visitType: labelVisitType(visit.visitType),
    visitDate: visit.visitDate ? new Date(visit.visitDate).toLocaleString("ar-EG") : "",
    technicianName: visit.technicianName || "",
    collectedAmount: Number(visit.collectedAmount || 0) / 100,
    visitResult: visit.visitResult || visit.visitOutcome || visit.result || visit.notes || "",
  }));
}

export function reminderRowsForExcel(reminders: Array<any>): ReminderExportRow[] {
  return reminders.map(reminder => ({
    customerCode: reminder.customer?.customerCode || "",
    customerName: reminder.customer?.name || "",
    phone: reminder.customer?.phone || "",
    reminderDate: new Date(reminder.reminderDate).toLocaleDateString("ar-EG"),
    lastServiceType: labelVisitType(reminder.lastServiceVisitType),
    lastServiceDate: reminder.lastServiceVisitDate ? new Date(reminder.lastServiceVisitDate).toLocaleDateString("ar-EG") : "",
    daysOverdue: reminder.daysOverdue || 0,
    status: reminder.status === "pending" ? "معلق" : reminder.status || "",
  }));
}

export function customerImportIssuesForExcel(issues: CustomerImportIssue[]): Array<Record<string, unknown>> {
  return issues.map(issue => ({ "رقم الصف": issue.rowNumber, "سبب الرفض": issue.reason, ...(issue.data ?? {}) }));
}

export function downloadCustomerImportIssues(issues: CustomerImportIssue[]) {
  if (!issues.length) return false;
  downloadRowsAsExcel("أخطاء-استيراد-العملاء-نقطة-نقاء.xlsx", "أخطاء الاستيراد", customerImportIssuesForExcel(issues));
  return true;
}

export function downloadRowsAsExcel(filename: string, sheetName: string, rows: Array<Record<string, unknown>>) {
  if (typeof document === "undefined" || typeof URL === "undefined") return false;
  const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "لا توجد بيانات": "" }]);
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
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [headers[key as keyof T], value])));
}
