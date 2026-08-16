const SESSION_KEY = "purepoint-offline-session";
import * as XLSX from "xlsx";

const CUSTOMERS_KEY = "purepoint-offline-customers";
const CUSTOMER_QUEUE_PREFIX = "purepoint-pending-customers";
const VISIT_QUEUE_PREFIX = "purepoint-pending-visits";
const DASHBOARD_KEY = "purepoint-offline-dashboard";
const CASH_KEY_PREFIX = "purepoint-offline-cash";
const INVENTORY_KEY_PREFIX = "purepoint-offline-inventory";
const CASH_QUEUE_PREFIX = "purepoint-pending-cash";
const INVENTORY_QUEUE_PREFIX = "purepoint-pending-inventory";
const REPORT_KEY_PREFIX = "purepoint-offline-report";

export type OfflineCustomer = {
  id: number;
  manualCode?: string | null;
  name: string;
  phone: string;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  notes?: string | null;
};

export type PendingCustomer = Omit<OfflineCustomer, "id"> & {
  firstVisitType?: PendingVisit["visitType"];
  firstVisitDate?: string;
  firstTechnicianName?: string | null;
  firstVisitNotes?: string | null;
  firstCollectedAmount?: number;
  firstCollectedCurrency?: "SAR";
  localId: number;
  clientOperationId: string;
  createdAt: string;
};

export type PendingVisit = {
  clientOperationId: string;
  customerId: number;
  visitType: "installation" | "maintenance" | "cartridge_change" | "follow_up" | "other";
  visitDate: string;
  notes: string | null;
  collectedAmount?: number;
  collectedCurrency?: "SAR";
  createdAt: string;
};

export type PendingCashTransaction = {
  entity?: "cash";
  clientOperationId: string;
  transactionType: "income" | "expense";
  currency: "SAR";
  amount: number;
  category: string;
  transactionDate: string;
  recipientName?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type PendingCashDelete = PendingOfflineDelete & { entity: "cash" };

export type PendingInventoryItem = {
  entity: "item";
  localId: number;
  clientOperationId: string;
  name: string;
  openingQuantity: number;
  notes?: string | null;
  createdAt: string;
};

export type PendingInventoryMovement = {
  entity: "movement";
  clientOperationId: string;
  inventoryItemId: number;
  movementType: "incoming" | "outgoing";
  quantity: number;
  unitCost: number;
  currency: "SAR";
  movementDate: string;
  technicianName?: string | null;
  notes?: string | null;
  createdAt: string;
};

export type PendingOfflineDelete = {
  clientOperationId: string;
  entity: "cash" | "inventoryItem" | "inventoryMovement";
  id: number;
  pin: string;
  createdAt: string;
};

export type OfflineUser = {
  id: number;
  name: string | null;
  email: string | null;
  openId: string;
  role: "admin" | "user";
};

function available() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readJson<T>(key: string, fallback: T): T {
  if (!available()) return fallback;
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  if (available()) localStorage.setItem(key, JSON.stringify(value));
}

function queueKey(prefix: string, ownerId: number) {
  return `${prefix}-${ownerId}`;
}

function ownerDataKey(prefix: string, ownerId: number) {
  return `${prefix}-${ownerId}`;
}

function newOperationId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `offline-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function rememberOfflineSession(user: OfflineUser | null | undefined) {
  if (!user) return;
  writeJson(SESSION_KEY, { id: user.id, name: user.name, email: user.email, openId: user.openId, role: user.role });
}

export function getOfflineSession() {
  return readJson<OfflineUser | null>(SESSION_KEY, null);
}

export function clearOfflineState() {
  if (!available()) return;
  const session = getOfflineSession();
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(CUSTOMERS_KEY);
  if (session) {
    localStorage.removeItem(queueKey(CUSTOMER_QUEUE_PREFIX, session.id));
    localStorage.removeItem(queueKey(VISIT_QUEUE_PREFIX, session.id));
  }
}

export function cacheOfflineCustomers(customers: OfflineCustomer[]) {
  writeJson(CUSTOMERS_KEY, customers.map(({ id, manualCode, name, phone, address, latitude, longitude, notes }) => ({ id, manualCode, name, phone, address, latitude, longitude, notes })));
}

export function getOfflineCustomers() {
  return readJson<OfflineCustomer[]>(CUSTOMERS_KEY, []);
}

export function cacheOfflineDashboard<T>(dashboard: T) {
  writeJson(DASHBOARD_KEY, dashboard);
}

export function getOfflineDashboard<T>() {
  return readJson<T | null>(DASHBOARD_KEY, null);
}

export function getPendingCustomers(ownerId: number) {
  return readJson<PendingCustomer[]>(queueKey(CUSTOMER_QUEUE_PREFIX, ownerId), []);
}

export function queueOfflineCustomer(ownerId: number, customer: Omit<OfflineCustomer, "id"> & Partial<Omit<PendingCustomer, "localId" | "clientOperationId" | "createdAt">>) {
  const pending: PendingCustomer = {
    ...customer,
    localId: -Date.now(),
    clientOperationId: newOperationId(),
    createdAt: new Date().toISOString(),
  };
  writeJson(queueKey(CUSTOMER_QUEUE_PREFIX, ownerId), [...getPendingCustomers(ownerId), pending]);
  cacheOfflineCustomers([...getOfflineCustomers(), { ...customer, id: pending.localId }]);
  return pending;
}

export function removePendingCustomer(ownerId: number, clientOperationId: string) {
  writeJson(queueKey(CUSTOMER_QUEUE_PREFIX, ownerId), getPendingCustomers(ownerId).filter(item => item.clientOperationId !== clientOperationId));
}

export function replaceOfflineCustomerId(localId: number, serverId: number) {
  writeJson(CUSTOMERS_KEY, getOfflineCustomers().map(customer => customer.id === localId ? { ...customer, id: serverId } : customer));
}

export function getPendingVisits(ownerId: number) {
  return readJson<PendingVisit[]>(queueKey(VISIT_QUEUE_PREFIX, ownerId), []);
}

export function queueOfflineVisit(ownerId: number, visit: Omit<PendingVisit, "clientOperationId" | "createdAt">) {
  const pending: PendingVisit = { ...visit, clientOperationId: newOperationId(), createdAt: new Date().toISOString() };
  writeJson(queueKey(VISIT_QUEUE_PREFIX, ownerId), [...getPendingVisits(ownerId), pending]);
  return pending;
}

export function removePendingVisit(ownerId: number, clientOperationId: string) {
  writeJson(queueKey(VISIT_QUEUE_PREFIX, ownerId), getPendingVisits(ownerId).filter(item => item.clientOperationId !== clientOperationId));
}

export function cacheOfflineReport<T>(ownerId: number, dateFrom: string, dateTo: string, value: T) {
  writeJson(`${REPORT_KEY_PREFIX}-${ownerId}-${dateFrom}-${dateTo}`, value);
}

export function getOfflineReport<T>(ownerId: number, dateFrom: string, dateTo: string) {
  return readJson<T | null>(`${REPORT_KEY_PREFIX}-${ownerId}-${dateFrom}-${dateTo}`, null);
}

export function getLatestOfflineReport<T extends { period?: { dateFrom?: string; dateTo?: string } }>(ownerId: number) {
  if (!available()) return null;
  let latest: T | null = null;
  let latestDate = "";
  const prefix = `${REPORT_KEY_PREFIX}-${ownerId}-`;
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith(prefix)) continue;
    const value = readJson<T | null>(key, null);
    const dateTo = value?.period?.dateTo ?? "";
    if (value && dateTo >= latestDate) {
      latest = value;
      latestDate = dateTo;
    }
  }
  return latest;
}

export function cacheOfflineCash<T>(ownerId: number, value: T) {
  writeJson(ownerDataKey(CASH_KEY_PREFIX, ownerId), value);
}

export function getOfflineCash<T>(ownerId: number) {
  return readJson<T | null>(ownerDataKey(CASH_KEY_PREFIX, ownerId), null);
}

export function cacheOfflineInventory<T>(ownerId: number, value: T) {
  writeJson(ownerDataKey(INVENTORY_KEY_PREFIX, ownerId), value);
}

export function getOfflineInventory<T>(ownerId: number) {
  return readJson<T | null>(ownerDataKey(INVENTORY_KEY_PREFIX, ownerId), null);
}

export function getPendingCash(ownerId: number) {
  return readJson<Array<PendingCashTransaction | PendingOfflineDelete>>(queueKey(CASH_QUEUE_PREFIX, ownerId), []);
}

export function queueOfflineCash(ownerId: number, input: Omit<PendingCashTransaction, "clientOperationId" | "createdAt" | "entity">) {
  const pending = { ...input, clientOperationId: newOperationId(), createdAt: new Date().toISOString() };
  writeJson(queueKey(CASH_QUEUE_PREFIX, ownerId), [...getPendingCash(ownerId), pending]);
  return pending;
}

export function removePendingCash(ownerId: number, clientOperationId: string) {
  writeJson(queueKey(CASH_QUEUE_PREFIX, ownerId), getPendingCash(ownerId).filter(item => item.clientOperationId !== clientOperationId));
}

export function getPendingInventory(ownerId: number) {
  return readJson<Array<PendingInventoryItem | PendingInventoryMovement | PendingOfflineDelete>>(queueKey(INVENTORY_QUEUE_PREFIX, ownerId), []);
}

export function queueOfflineInventoryItem(ownerId: number, input: Omit<PendingInventoryItem, "clientOperationId" | "createdAt" | "entity" | "localId">) {
  const pending = { ...input, localId: -Date.now(), clientOperationId: newOperationId(), createdAt: new Date().toISOString(), entity: "item" as const };
  writeJson(queueKey(INVENTORY_QUEUE_PREFIX, ownerId), [...getPendingInventory(ownerId), pending]);
  return pending;
}

export function queueOfflineInventoryMovement(ownerId: number, input: Omit<PendingInventoryMovement, "clientOperationId" | "createdAt" | "entity">) {
  const pending = { ...input, clientOperationId: newOperationId(), createdAt: new Date().toISOString(), entity: "movement" as const };
  writeJson(queueKey(INVENTORY_QUEUE_PREFIX, ownerId), [...getPendingInventory(ownerId), pending]);
  return pending;
}

export function queueOfflineDelete(ownerId: number, input: Omit<PendingOfflineDelete, "clientOperationId" | "createdAt">) {
  const pending = { ...input, clientOperationId: newOperationId(), createdAt: new Date().toISOString() };
  const prefix = input.entity === "cash" ? CASH_QUEUE_PREFIX : INVENTORY_QUEUE_PREFIX;
  writeJson(queueKey(prefix, ownerId), [...(input.entity === "cash" ? getPendingCash(ownerId) : getPendingInventory(ownerId)), pending]);
  return pending;
}

export function removePendingInventory(ownerId: number, clientOperationId: string) {
  writeJson(queueKey(INVENTORY_QUEUE_PREFIX, ownerId), getPendingInventory(ownerId).filter(item => item.clientOperationId !== clientOperationId));
}

export function getPendingOperationCount(ownerId: number) {
  return getPendingCustomers(ownerId).length + getPendingVisits(ownerId).length + getPendingCash(ownerId).length + getPendingInventory(ownerId).length;
}

export type OfflineBackup = {
  format: "purepoint-offline-backup";
  version: 1;
  exportedAt: string;
  app: "نقطة نقاء";
  storage: Record<string, unknown>;
};

export function createOfflineBackup(now = new Date()): OfflineBackup {
  const storage: Record<string, unknown> = {};
  if (available()) {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith("purepoint-")) continue;
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try {
        storage[key] = JSON.parse(raw);
      } catch {
        storage[key] = raw;
      }
    }
  }
  return {
    format: "purepoint-offline-backup",
    version: 1,
    exportedAt: now.toISOString(),
    app: "نقطة نقاء",
    storage,
  };
}

function serializeStoredValue(value: unknown) {
  return typeof value === "string" ? value : JSON.stringify(value) ?? "";
}

const arabicFieldLabels: Record<string, string> = {
  id: "المعرّف", ownerId: "معرّف المستخدم", customerId: "معرّف العميل", inventoryItemId: "معرّف الصنف", manualCode: "كود العميل", customerCode: "كود العميل", localId: "المعرّف المحلي", clientOperationId: "معرّف العملية المحلية",
  name: "الاسم", phone: "الهاتف", address: "العنوان", location: "الموقع", latitude: "خط العرض", longitude: "خط الطول", notes: "الملاحظات",
  visitType: "نوع الزيارة", serviceOrderType: "نوع أمر الخدمة", visitDate: "تاريخ الزيارة", nextVisitDate: "موعد الزيارة القادمة", reminderDate: "تاريخ التذكير", reminderId: "معرّف التذكير", alertedAt: "وقت التنبيه", status: "الحالة",
  technicianName: "اسم الفني", firstTechnicianName: "اسم فني الزيارة الأولى", recipientName: "اسم المستلم", receivedBy: "الفني المستلم",
  collectedAmount: "المبلغ المحصل", firstCollectedAmount: "مبلغ الزيارة الأولى", amount: "المبلغ", currency: "العملة", category: "البند", description: "البيان", transactionType: "نوع العملية", transactionDate: "تاريخ العملية",
  date: "التاريخ", dateFrom: "من تاريخ", dateTo: "إلى تاريخ", period: "الفترة", itemId: "معرّف الصنف", itemName: "اسم الصنف", quantity: "الكمية", openingQuantity: "الرصيد الافتتاحي", currentBalance: "الرصيد الحالي", incoming: "الوارد", outgoing: "المنصرف", movementType: "نوع الحركة", movementDate: "تاريخ الحركة", unitCost: "سعر الوحدة", unitPrice: "سعر الوحدة", total: "الإجمالي",
  createdAt: "تاريخ الإنشاء", updatedAt: "آخر تحديث", pendingOperations: "العمليات المعلقة", data: "البيانات", entity: "نوع السجل", leadDays: "عدد أيام التنبيه", alertHour: "ساعة التنبيه", alertMinute: "دقيقة التنبيه", timezoneOffsetMinutes: "فرق التوقيت بالدقائق", scheduleCronTaskUid: "معرّف الجدولة", pinHash: "رمز الحماية المشفّر",
};

function localizeReadableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(localizeReadableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, nested], index) => [arabicFieldLabels[key] ?? `حقل إضافي ${index + 1}`, localizeReadableValue(nested)]));
}

function readableSheetRows(storage: Record<string, unknown>) {
  const groups: Record<string, Array<Record<string, unknown>>> = {
    "العملاء": [],
    "الزيارات": [],
    "التذكيرات": [],
    "الخزينة": [],
    "المخزن": [],
    "التقارير": [],
    "العمليات المعلقة": [],
    "بيانات الحساب": [],
    "بيانات محلية": [],
  };

  for (const [key, value] of Object.entries(storage)) {
    const serialized = serializeStoredValue(value);
    // هذه الورقة هي المصدر الكامل للاستعادة، لذلك تضم كل مفتاح purepoint بلا استثناء.
    groups["بيانات محلية"].push({ "مفتاح البيانات": key, "القيمة": serialized });

    let groupName = "بيانات محلية";
    if (key.includes("customers")) groupName = "العملاء";
    else if (key.includes("visits")) groupName = "الزيارات";
    else if (key.includes("report")) groupName = "التقارير";
    else if (key.includes("cash")) groupName = "الخزينة";
    else if (key.includes("inventory")) groupName = "المخزن";
    else if (key.includes("pending")) groupName = "العمليات المعلقة";
    else if (key.includes("session")) groupName = "بيانات الحساب";

    if (Array.isArray(value)) {
      value.forEach((record, index) => {
        groups[groupName].push({
          "مفتاح البيانات": key,
          "رقم السجل": index + 1,
          "البيانات": serializeStoredValue(localizeReadableValue(record)),
        });
      });
    } else if (value && typeof value === "object") {
      groups[groupName].push({
        "مفتاح البيانات": key,
        "رقم السجل": 1,
        "البيانات": serialized,
      });
    } else {
      groups[groupName].push({
        "مفتاح البيانات": key,
        "رقم السجل": 1,
        "البيانات": serialized,
      });
    }
  }
  return groups;
}

export function downloadOfflineBackup(now = new Date()) {
  if (!available()) return false;
  const backup = createOfflineBackup(now);
  const workbook = XLSX.utils.book_new();
  const groups = readableSheetRows(backup.storage);
  const summary = [{
    "اسم التطبيق": backup.app,
    "نوع النسخة": "نسخة احتياطية محلية Excel",
    "تاريخ الإنشاء": now.toLocaleString("ar-EG"),
    "عدد مفاتيح البيانات": Object.keys(backup.storage).length,
    "طريقة الاستعادة": "من زر استعادة ثم اختيار ملف Excel هذا",
  }];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summary), "ملخص النسخة");
  for (const [sheetName, rows] of Object.entries(groups)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "مفتاح البيانات": "لا توجد بيانات", "البيانات": "", "القيمة": "" }]), sheetName);
  }
  const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([output], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  anchor.href = url;
  anchor.download = `pure-point-backup-${stamp}.xlsx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

export function getOfflineBackupKeyCount() {
  return Object.keys(createOfflineBackup().storage).length;
}

export type OfflineRestoreResult = { restoredKeys: number; exportedAt: string };

function isOfflineBackup(value: unknown): value is OfflineBackup {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<OfflineBackup>;
  return candidate.format === "purepoint-offline-backup" && candidate.version === 1 && typeof candidate.exportedAt === "string" && !!candidate.storage && typeof candidate.storage === "object" && !Array.isArray(candidate.storage);
}

export function restoreOfflineBackup(value: unknown): OfflineRestoreResult {
  if (!available()) throw new Error("التخزين المحلي غير متاح على هذا الجهاز.");
  if (!isOfflineBackup(value)) throw new Error("ملف النسخة الاحتياطية غير صالح أو غير مدعوم.");
  const entries = Object.entries(value.storage).filter(([key, storedValue]) => key.startsWith("purepoint-") && storedValue !== undefined);
  if (entries.length === 0) throw new Error("النسخة الاحتياطية لا تحتوي على بيانات نقطة نقاء.");
  const currentKeys: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith("purepoint-")) currentKeys.push(key);
  }
  for (const key of currentKeys) localStorage.removeItem(key);
  for (const [key, storedValue] of entries) localStorage.setItem(key, JSON.stringify(storedValue));
  return { restoredKeys: entries.length, exportedAt: value.exportedAt };
}

export function restoreOfflineBackupFromText(text: string): OfflineRestoreResult {
  try {
    return restoreOfflineBackup(JSON.parse(text));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("تعذر قراءة ملف النسخة الاحتياطية؛ تأكد من أنه ملف JSON صحيح.");
    throw error;
  }
}

export function restoreOfflineBackupFromExcel(data: ArrayBuffer): OfflineRestoreResult {
  if (!available()) throw new Error("التخزين المحلي غير متاح على هذا الجهاز.");
  try {
    const workbook = XLSX.read(data, { type: "array" });
    const sheet = workbook.Sheets["بيانات محلية"];
    if (!sheet) throw new Error("ملف Excel لا يحتوي على ورقة البيانات المحلية المطلوبة.");
    const rows = XLSX.utils.sheet_to_json<{ "مفتاح البيانات"?: string; "القيمة"?: string }>(sheet);
    const entries: Array<[string, unknown]> = [];
    for (const row of rows) {
      const key = row["مفتاح البيانات"];
      const raw = row["القيمة"];
      if (!key || key === "لا توجد بيانات" || !key.startsWith("purepoint-") || raw === undefined) continue;
      try { entries.push([key, JSON.parse(String(raw))]); } catch { entries.push([key, raw]); }
    }
    if (entries.length === 0) throw new Error("النسخة الاحتياطية لا تحتوي على بيانات نقطة نقاء قابلة للاستعادة.");
    const currentKeys: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith("purepoint-")) currentKeys.push(key);
    }
    for (const key of currentKeys) localStorage.removeItem(key);
    for (const [key, value] of entries) localStorage.setItem(key, JSON.stringify(value));
    return { restoredKeys: entries.length, exportedAt: new Date().toISOString() };
  } catch (error) {
    if (error instanceof Error && error.message.includes("لا يحتوي")) throw error;
    throw new Error("تعذر قراءة ملف Excel؛ تأكد من أنه ملف نسخة احتياطية صادر من تطبيق نقطة نقاء.");
  }
}
