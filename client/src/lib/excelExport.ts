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
