const SESSION_KEY = "purepoint-offline-session";
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
