const SESSION_KEY = "purepoint-offline-session";
const CUSTOMERS_KEY = "purepoint-offline-customers";
const CUSTOMER_QUEUE_PREFIX = "purepoint-pending-customers";
const VISIT_QUEUE_PREFIX = "purepoint-pending-visits";

export type OfflineCustomer = {
  id: number;
  name: string;
  phone: string;
  address?: string | null;
  latitude?: string | null;
  longitude?: string | null;
  notes?: string | null;
};

export type PendingCustomer = Omit<OfflineCustomer, "id"> & {
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
  writeJson(CUSTOMERS_KEY, customers.map(({ id, name, phone, address, latitude, longitude, notes }) => ({ id, name, phone, address, latitude, longitude, notes })));
}

export function getOfflineCustomers() {
  return readJson<OfflineCustomer[]>(CUSTOMERS_KEY, []);
}

export function getPendingCustomers(ownerId: number) {
  return readJson<PendingCustomer[]>(queueKey(CUSTOMER_QUEUE_PREFIX, ownerId), []);
}

export function queueOfflineCustomer(ownerId: number, customer: Omit<OfflineCustomer, "id">) {
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

export function getPendingOperationCount(ownerId: number) {
  return getPendingCustomers(ownerId).length + getPendingVisits(ownerId).length;
}
