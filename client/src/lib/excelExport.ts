import * as XLSX from "xlsx";

export type CustomerImportRow = {
  rowNumber: number;
  name: string;
  phone: string;
  manualCode?: string | null;
  address?: string | null;
  location?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  notes?: string | null;
};

export type CustomerImportIssue = { rowNumber: number; reason: string };

function normalizeImportHeader(value: unknown) {
  return String(value ?? "").trim().toLocaleLowerCase("ar-EG").replace(/[\u0640\s_\-]+/g, "");
}

function textCell(value: unknown) {
  return value === undefined || value === null ? "" : String(value).trim();
}

export async function parseCustomerExcel(file: File): Promise<{ rows: CustomerImportRow[]; issues: CustomerImportIssue[] }> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows: [], issues: [{ rowNumber: 1, reason: "الملف لا يحتوي على ورقة بيانات" }] };
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const header = (matrix[0] ?? []).map(normalizeImportHeader);
  const aliases: Record<string, string[]> = {
    name: ["اسم العميل", "الاسم", "name", "customername"].map(normalizeImportHeader),
    phone: ["الهاتف", "رقم الهاتف", "الجوال", "الموبايل", "phone", "mobile"].map(normalizeImportHeader),
    manualCode: ["كود العميل", "الكود", "رقم العميل", "code", "customercode"].map(normalizeImportHeader),
    address: ["العنوان", "address"].map(normalizeImportHeader),
    location: ["الموقع", "الموقع gps", "gps", "location"].map(normalizeImportHeader),
    latitude: ["خط العرض", "latitude", "lat"].map(normalizeImportHeader),
    longitude: ["خط الطول", "longitude", "lng", "lon"].map(normalizeImportHeader),
    notes: ["ملاحظات", "الملاحظات", "notes"].map(normalizeImportHeader),
  };
  const indexOf = (key: string) => header.findIndex(item => aliases[key].includes(item));
  const nameIndex = indexOf("name");
  const phoneIndex = indexOf("phone");
  const issues: CustomerImportIssue[] = [];
  if (nameIndex < 0 || phoneIndex < 0) return { rows: [], issues: [{ rowNumber: 1, reason: "يجب أن يحتوي الملف على عمودي اسم العميل والهاتف" }] };
  const rows: CustomerImportRow[] = [];
  matrix.slice(1).forEach((cells, offset) => {
    const rowNumber = offset + 2;
    const name = textCell(cells[nameIndex]);
    const phone = textCell(cells[phoneIndex]);
    if (!name && !phone) return;
    if (!name || !phone) { issues.push({ rowNumber, reason: !name ? "اسم العميل ناقص" : "رقم الهاتف ناقص" }); return; }
    const value = (key: string) => { const index = indexOf(key); return index >= 0 ? textCell(cells[index]) : ""; };
    rows.push({ rowNumber, name, phone, manualCode: value("manualCode") || null, address: value("address") || null, location: value("location") || null, latitude: value("latitude") || null, longitude: value("longitude") || null, notes: value("notes") || null });
  });
  return { rows, issues };
}

export function downloadCustomerImportTemplate() {
  const rows = [{ "اسم العميل": "مثال: محمد أحمد", "الهاتف": "0500000000", "كود العميل": "", "العنوان": "الرياض", "الموقع GPS": "24.7136,46.6753", "خط العرض": "", "خط الطول": "", "ملاحظات": "" }];
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

export function downloadRowsAsExcel(filename: string, sheetName: string, rows: Array<Record<string, unknown>>) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
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
