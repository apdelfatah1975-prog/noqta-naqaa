import * as XLSX from "xlsx";
import {
  cashTransactions,
  customers,
  inventoryItems,
  inventoryMovements,
  notificationSettings,
  reminders,
  visits,
} from "../drizzle/schema";
import { getDb } from "./db";
import { storagePut } from "./storage";
import { eq } from "drizzle-orm";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function excelValue(value: unknown) {
  if (value instanceof Date) return value.toLocaleString("ar-EG");
  if (value === null || value === undefined) return "";
  return value;
}

function rowsForExcel(rows: Array<Record<string, unknown>>) {
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, excelValue(value)])));
}

function addSheet(workbook: XLSX.WorkBook, name: string, rows: Array<Record<string, unknown>>) {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rowsForExcel(rows) : [{ "لا توجد بيانات": "" }]);
  sheet["!cols"] = [{ wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }, { wch: 22 }];
  XLSX.utils.book_append_sheet(workbook, sheet, name.slice(0, 31));
}

export async function createOwnerBackup(ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات لإنشاء النسخة الاحتياطية.");
  // بعض اختبارات الراوتر تستخدم عميل قاعدة بيانات مبسطًا لا يدعم القراءة؛ لا نُفشل العملية الأصلية بسببه.
  if (typeof (db as { select?: unknown }).select !== "function") return null;

  const [customerRows, visitRows, reminderRows, itemRows, movementRows, cashRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.ownerId, ownerId)),
    db.select().from(visits).where(eq(visits.ownerId, ownerId)),
    db.select().from(reminders).where(eq(reminders.ownerId, ownerId)),
    db.select().from(inventoryItems).where(eq(inventoryItems.ownerId, ownerId)),
    db.select().from(inventoryMovements).where(eq(inventoryMovements.ownerId, ownerId)),
    db.select().from(cashTransactions).where(eq(cashTransactions.ownerId, ownerId)),
  ]);

  const generatedAt = new Date();
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, "ملخص النسخة", [{
    "نوع البيانات": "نسخة احتياطية كاملة",
    "تاريخ الإنشاء": generatedAt,
    "عدد العملاء": customerRows.length,
    "عدد الزيارات": visitRows.length,
    "عدد التذكيرات": reminderRows.length,
    "عدد أصناف المخزون": itemRows.length,
    "عدد حركات المخزون": movementRows.length,
    "عدد عمليات الخزينة": cashRows.length,
  }]);
  addSheet(workbook, "العملاء", customerRows as unknown as Array<Record<string, unknown>>);
  addSheet(workbook, "الزيارات", visitRows as unknown as Array<Record<string, unknown>>);
  addSheet(workbook, "التذكيرات", reminderRows as unknown as Array<Record<string, unknown>>);
  addSheet(workbook, "أصناف المخزون", itemRows as unknown as Array<Record<string, unknown>>);
  addSheet(workbook, "حركات المخزون", movementRows as unknown as Array<Record<string, unknown>>);
  addSheet(workbook, "الخزينة", cashRows as unknown as Array<Record<string, unknown>>);

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  if (typeof (db as { insert?: unknown }).insert !== "function") return null;
  const uploaded = await storagePut(`water-filter-backups/${ownerId}/latest.xlsx`, buffer, XLSX_CONTENT_TYPE);
  const metadataInsert = db.insert(notificationSettings).values({ ownerId, backupFileKey: uploaded.key, backupGeneratedAt: generatedAt });
  if (typeof (metadataInsert as { onDuplicateKeyUpdate?: unknown }).onDuplicateKeyUpdate !== "function") return null;
  await metadataInsert.onDuplicateKeyUpdate({
    set: { backupFileKey: uploaded.key, backupGeneratedAt: generatedAt },
  });
  return { key: uploaded.key, url: uploaded.url, generatedAt, counts: { customers: customerRows.length, visits: visitRows.length, reminders: reminderRows.length, inventoryItems: itemRows.length, inventoryMovements: movementRows.length, cashTransactions: cashRows.length } };
}

export async function refreshOwnerBackup(ownerId: number) {
  try {
    return await createOwnerBackup(ownerId);
  } catch (error) {
    console.error("[Backup] تعذر تحديث نسخة Excel السحابية", error);
    return null;
  }
}
