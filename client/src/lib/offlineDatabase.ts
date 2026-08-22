const DB_NAME = "purepoint-offline-db";
const DB_VERSION = 1;
const SNAPSHOTS_STORE = "snapshots";
const QUEUE_STORE = "syncQueue";
const META_STORE = "meta";

export type OfflineDomain =
  | "customers"
  | "visits"
  | "workOrders"
  | "reminders"
  | "inventory"
  | "cash"
  | "reports"
  | "activity";

export type OfflineSnapshot<T = unknown> = {
  userId: number;
  domain: OfflineDomain;
  queryKey?: unknown[];
  records: T[];
  updatedAt: number;
  serverVersion?: string | null;
};

export type SyncQueueEntry = {
  id?: number;
  userId: number;
  clientOperationId: string;
  domain: OfflineDomain;
  action: "create" | "update" | "delete";
  payload: unknown;
  createdAt: number;
  attempts: number;
  status: "pending" | "syncing" | "conflict" | "failed";
  lastError?: string;
};

export type OfflineConnectionState = "online" | "offline" | "syncing";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB غير متاح على هذا المتصفح"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("تعذر فتح قاعدة البيانات المحلية"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOTS_STORE)) {
        const store = db.createObjectStore(SNAPSHOTS_STORE, { keyPath: ["userId", "domain"] });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("domain", "domain", { unique: false });
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const store = db.createObjectStore(QUEUE_STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("userId", "userId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("clientOperationId", "clientOperationId", { unique: true });
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
    };
  });
}

async function withStore<T>(storeName: string, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest | void): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request: IDBRequest | void;
    try { request = run(store); } catch (error) { db.close(); reject(error); return; }
    transaction.oncomplete = () => { db.close(); if (request && "result" in request) resolve((request as IDBRequest).result as T); else resolve(undefined as T); };
    transaction.onerror = () => { db.close(); reject(transaction.error ?? new Error("قاعدة البيانات المحلية رفضت العملية")); };
    transaction.onabort = () => { db.close(); reject(transaction.error ?? new Error("تم إلغاء العملية المحلية")); };
  });
}

export async function saveOfflineSnapshot<T>(snapshot: OfflineSnapshot<T>): Promise<void> {
  await withStore(SNAPSHOTS_STORE, "readwrite", store => store.put(snapshot));
}

export async function getOfflineSnapshot<T>(userId: number, domain: OfflineDomain): Promise<OfflineSnapshot<T> | null> {
  return (await withStore<OfflineSnapshot<T> | undefined>(SNAPSHOTS_STORE, "readonly", store => store.get([userId, domain]))) ?? null;
}

export async function getOfflineSnapshots(userId: number): Promise<OfflineSnapshot[]> {
  const snapshots = await withStore<OfflineSnapshot[]>(SNAPSHOTS_STORE, "readonly", store => store.index("userId").getAll(userId));
  return snapshots ?? [];
}

export async function enqueueOfflineOperation(entry: Omit<SyncQueueEntry, "id" | "attempts" | "status" | "createdAt"> & Partial<Pick<SyncQueueEntry, "createdAt">>): Promise<void> {
  const operation: SyncQueueEntry = { ...entry, createdAt: entry.createdAt ?? Date.now(), attempts: 0, status: "pending" };
  await withStore(QUEUE_STORE, "readwrite", store => store.put(operation));
  window.dispatchEvent(new CustomEvent("purepoint-offline-queue-changed"));
}

export async function listOfflineQueue(userId: number): Promise<SyncQueueEntry[]> {
  const entries = await withStore<SyncQueueEntry[]>(QUEUE_STORE, "readonly", store => store.index("userId").getAll(userId));
  return (entries ?? []).sort((a, b) => a.createdAt - b.createdAt);
}

export async function countOfflineQueue(userId: number): Promise<number> {
  return (await withStore<number>(QUEUE_STORE, "readonly", store => store.index("userId").count(userId))) ?? 0;
}

export async function updateOfflineQueueEntry(id: number, patch: Partial<SyncQueueEntry>): Promise<void> {
  const current = await withStore<SyncQueueEntry | undefined>(QUEUE_STORE, "readonly", store => store.get(id));
  if (!current) return;
  await withStore(QUEUE_STORE, "readwrite", store => store.put({ ...current, ...patch, id }));
}

export async function removeOfflineQueueEntry(id: number): Promise<void> {
  await withStore(QUEUE_STORE, "readwrite", store => store.delete(id));
  window.dispatchEvent(new CustomEvent("purepoint-offline-queue-changed"));
}

export async function saveOfflineMeta(key: string, value: unknown): Promise<void> {
  await withStore(META_STORE, "readwrite", store => store.put({ key, value, updatedAt: Date.now() }));
}

export async function getOfflineMeta<T>(key: string): Promise<T | null> {
  const result = await withStore<{ value: T } | undefined>(META_STORE, "readonly", store => store.get(key));
  return result?.value ?? null;
}

export function createClientOperationId(prefix = "offline"): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
