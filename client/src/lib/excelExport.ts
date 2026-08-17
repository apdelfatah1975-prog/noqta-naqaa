import * as XLSX from "xlsx";
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
