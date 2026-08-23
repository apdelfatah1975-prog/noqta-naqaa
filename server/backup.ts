import * as XLSX from "xlsx";
import {
  allowedTechnicianAccounts,
  cashTransactions,
  customers,
  exportHistory,
  inventoryItems,
  inventoryMovements,
  notificationSettings,
  reminders,
  serviceTypeItems,
  serviceTypes,
  technicianLocations,
  visits,
  visitItems,
  workOrderProofs,
} from "../drizzle/schema";
import { desc, eq } from "drizzle-orm";
import { getDb } from "./db";
import { storageGet, storagePut } from "./storage";

const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const BACKUP_TABLES = [
  { key: "customers", label: "العملاء" },
  { key: "visits", label: "الزيارات" },
  { key: "reminders", label: "التذكيرات" },
  { key: "inventoryItems", label: "أصناف المخزون" },
  { key: "inventoryMovements", label: "حركات المخزون" },
  { key: "cashTransactions", label: "الخزينة" },
  { key: "allowedTechnicianAccounts", label: "حسابات الفنيين" },
  { key: "technicianLocations", label: "مواقع الفنيين" },
  { key: "serviceTypes", label: "أنواع الخدمات" },
  { key: "serviceTypeItems", label: "أصناف الخدمات" },
  { key: "visitItems", label: "أصناف الزيارات" },
  { key: "workOrderProofs", label: "أدلة أوامر العمل" },
] as const;

export type BackupTableKey = (typeof BACKUP_TABLES)[number]["key"];
export const DEFAULT_BACKUP_TABLES = BACKUP_TABLES.map(table => table.key) as BackupTableKey[];

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

function normalizeTables(tables?: BackupTableKey[]) {
  const requested = tables?.length ? tables : DEFAULT_BACKUP_TABLES;
  return Array.from(new Set(requested)).filter(table => DEFAULT_BACKUP_TABLES.includes(table));
}

export async function createOwnerBackup(ownerId: number, options?: { tables?: BackupTableKey[]; exportedBy?: number }) {
  const db = await getDb();
  if (!db) throw new Error("تعذر الاتصال بقاعدة البيانات لإنشاء النسخة الاحتياطية.");
  if (typeof (db as { select?: unknown }).select !== "function") return null;

  const tables = normalizeTables(options?.tables);
  const [customerRows, visitRows, reminderRows, itemRows, movementRows, cashRows, technicianRows, locationRows, serviceRows, serviceItemRows, visitItemRows, proofRows] = await Promise.all([
    db.select().from(customers).where(eq(customers.ownerId, ownerId)),
    db.select().from(visits).where(eq(visits.ownerId, ownerId)),
    db.select().from(reminders).where(eq(reminders.ownerId, ownerId)),
    db.select().from(inventoryItems).where(eq(inventoryItems.ownerId, ownerId)),
    db.select().from(inventoryMovements).where(eq(inventoryMovements.ownerId, ownerId)),
    db.select().from(cashTransactions).where(eq(cashTransactions.ownerId, ownerId)),
    db.select().from(allowedTechnicianAccounts).where(eq(allowedTechnicianAccounts.ownerId, ownerId)),
    db.select().from(technicianLocations).where(eq(technicianLocations.ownerId, ownerId)),
    db.select().from(serviceTypes).where(eq(serviceTypes.ownerId, ownerId)),
    db.select().from(serviceTypeItems).where(eq(serviceTypeItems.ownerId, ownerId)),
    db.select().from(visitItems).where(eq(visitItems.ownerId, ownerId)),
    db.select().from(workOrderProofs).where(eq(workOrderProofs.ownerId, ownerId)),
  ]);

  const rows: Record<BackupTableKey, Array<Record<string, unknown>>> = {
    customers: customerRows as Array<Record<string, unknown>>,
    visits: visitRows as Array<Record<string, unknown>>,
    reminders: reminderRows as Array<Record<string, unknown>>,
    inventoryItems: itemRows as Array<Record<string, unknown>>,
    inventoryMovements: movementRows as Array<Record<string, unknown>>,
    cashTransactions: cashRows as Array<Record<string, unknown>>,
    allowedTechnicianAccounts: technicianRows as Array<Record<string, unknown>>,
    technicianLocations: locationRows as Array<Record<string, unknown>>,
    serviceTypes: serviceRows as Array<Record<string, unknown>>,
    serviceTypeItems: serviceItemRows as Array<Record<string, unknown>>,
    visitItems: visitItemRows as Array<Record<string, unknown>>,
    workOrderProofs: proofRows as Array<Record<string, unknown>>,
  };
  const counts = Object.fromEntries(tables.map(table => [table, rows[table].length]));
  const generatedAt = new Date();
  const workbook = XLSX.utils.book_new();
  addSheet(workbook, "ملخص النسخة", [{ "نوع البيانات": "نسخة احتياطية مختارة", "تاريخ الإنشاء": generatedAt, ...counts }]);
  for (const table of BACKUP_TABLES) {
    if (tables.includes(table.key)) addSheet(workbook, table.label, rows[table.key]);
  }

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
  if (typeof (db as { insert?: unknown }).insert !== "function") return null;
  const uploaded = await storagePut(`water-filter-backups/${ownerId}/latest.xlsx`, buffer, XLSX_CONTENT_TYPE);
  const settingsInsert = db.insert(notificationSettings).values({ ownerId, backupFileKey: uploaded.key, backupGeneratedAt: generatedAt });
  if (typeof (settingsInsert as { onDuplicateKeyUpdate?: unknown }).onDuplicateKeyUpdate !== "function") return null;
  await settingsInsert.onDuplicateKeyUpdate({ set: { backupFileKey: uploaded.key, backupGeneratedAt: generatedAt } });
  await db.insert(exportHistory).values({ ownerId, exportedBy: options?.exportedBy ?? ownerId, selectedTables: JSON.stringify(tables), counts: JSON.stringify(counts), fileKey: uploaded.key, generatedAt });
  return { key: uploaded.key, url: uploaded.url, generatedAt, tables, counts };
}

export async function getOwnerBackupHistory(ownerId: number, limit = 20) {
  const db = await getDb();
  if (!db || typeof (db as { select?: unknown }).select !== "function") return [];
  const rows = await db.select().from(exportHistory).where(eq(exportHistory.ownerId, ownerId)).orderBy(desc(exportHistory.createdAt)).limit(Math.min(Math.max(limit, 1), 100));
  return rows.map(row => ({ ...row, selectedTables: JSON.parse(row.selectedTables || "[]"), counts: JSON.parse(row.counts || "{}") }));
}

export async function getOwnerBackupStatus(ownerId: number) {
  const db = await getDb();
  if (!db || typeof (db as { select?: unknown }).select !== "function") return { generatedAt: null, downloadUrl: null, history: [] };
  const settings = await db.select().from(notificationSettings).where(eq(notificationSettings.ownerId, ownerId)).limit(1);
  const stored = settings[0]?.backupFileKey ? await storageGet(settings[0].backupFileKey) : null;
  return { generatedAt: settings[0]?.backupGeneratedAt ?? null, downloadUrl: stored?.url ?? null, history: await getOwnerBackupHistory(ownerId) };
}

export function refreshOwnerBackup(ownerId: number) {
  void createOwnerBackup(ownerId).catch(error => {
    console.error("[Backup] تعذر تحديث نسخة Excel السحابية", error);
  });
  return Promise.resolve(null);
}
