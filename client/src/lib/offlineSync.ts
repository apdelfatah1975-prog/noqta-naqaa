const SESSION_KEY = "purepoint-offline-session";
const CUSTOMERS_KEY = "purepoint-offline-customers";
const QUEUE_PREFIX = "purepoint-pending-visits";

export type OfflineCustomer = { id: number; name: string; phone: string };
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

function queueKey(ownerId: number) {
  return `${QUEUE_PREFIX}-${ownerId}`;
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
  if (session) localStorage.removeItem(queueKey(session.id));
}

export function cacheOfflineCustomers(customers: OfflineCustomer[]) {
  writeJson(CUSTOMERS_KEY, customers.map(({ id, name, phone }) => ({ id, name, phone })));
}

export function getOfflineCustomers() {
  return readJson<OfflineCustomer[]>(CUSTOMERS_KEY, []);
}

export function getPendingVisits(ownerId: number) {
  return readJson<PendingVisit[]>(queueKey(ownerId), []);
}

export function queueOfflineVisit(ownerId: number, visit: Omit<PendingVisit, "clientOperationId" | "createdAt">) {
  const pending: PendingVisit = { ...visit, clientOperationId: newOperationId(), createdAt: new Date().toISOString() };
  const visits = getPendingVisits(ownerId);
  writeJson(queueKey(ownerId), [...visits, pending]);
  return pending;
}

export function removePendingVisit(ownerId: number, clientOperationId: string) {
  writeJson(queueKey(ownerId), getPendingVisits(ownerId).filter(item => item.clientOperationId !== clientOperationId));
}
