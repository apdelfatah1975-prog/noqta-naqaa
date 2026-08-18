import { getOfflineSession } from "@/lib/offlineSync";

export const TRASH_BIN_KEY = "purepoint-trash-bin";

export type TrashItem = {
  id: string;
  entityType: "technician-settings" | "customer" | "visit" | "cash" | "inventory" | "reminder";
  entityLabel: string;
  payload: unknown;
  deletedAt: string;
  deletedBy: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("purepoint-trash-bin-changed"));
}

export function filterTrashItems(items: TrashItem[], query: string, entityType: "all" | TrashItem["entityType"] = "all") {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter(item => {
    if (entityType !== "all" && item.entityType !== entityType) return false;
    if (!normalizedQuery) return true;
    const searchable = `${item.entityLabel} ${item.entityType} ${JSON.stringify(item.payload ?? {})}`.toLowerCase();
    return searchable.includes(normalizedQuery);
  });
}

export function getTrashItems(): TrashItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(TRASH_BIN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is TrashItem => Boolean(item && typeof item === "object" && typeof item.id === "string" && typeof item.entityType === "string" && typeof item.entityLabel === "string" && typeof item.deletedAt === "string")).map(item => ({
      ...item,
      deletedBy: typeof item.deletedBy === "string" && item.deletedBy.trim() ? item.deletedBy : "مستخدم سابق",
    }));
  } catch {
    return [];
  }
}

function saveTrashItems(items: TrashItem[]) {
  if (canUseStorage()) localStorage.setItem(TRASH_BIN_KEY, JSON.stringify(items));
  notify();
}

export function moveToTrash(item: Omit<TrashItem, "id" | "deletedAt" | "deletedBy">) {
  const session = getOfflineSession();
  const deletedBy = session?.name?.trim() || session?.email?.trim() || "المستخدم الحالي";
  const entry: TrashItem = {
    ...item,
    id: `${item.entityType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    deletedAt: new Date().toISOString(),
    deletedBy,
  };
  saveTrashItems([entry, ...getTrashItems()]);
  return entry;
}

export function restoreFromTrash(id: string): TrashItem | null {
  const items = getTrashItems();
  const found = items.find(item => item.id === id) ?? null;
  if (!found) return null;
  saveTrashItems(items.filter(item => item.id !== id));
  return found;
}

export function permanentlyDeleteFromTrash(id: string) {
  saveTrashItems(getTrashItems().filter(item => item.id !== id));
}

export function emptyTrash() {
  saveTrashItems([]);
}
