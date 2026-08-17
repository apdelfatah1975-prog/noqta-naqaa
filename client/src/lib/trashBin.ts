export const TRASH_BIN_KEY = "purepoint-trash-bin";

export type TrashItem = {
  id: string;
  entityType: "technician-settings" | "customer" | "visit" | "cash" | "inventory" | "reminder";
  entityLabel: string;
  payload: unknown;
  deletedAt: string;
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("purepoint-trash-bin-changed"));
}

export function getTrashItems(): TrashItem[] {
  if (!canUseStorage()) return [];
  try {
    const raw = localStorage.getItem(TRASH_BIN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveTrashItems(items: TrashItem[]) {
  if (canUseStorage()) localStorage.setItem(TRASH_BIN_KEY, JSON.stringify(items.slice(0, 100)));
  notify();
}

export function moveToTrash(item: Omit<TrashItem, "id" | "deletedAt">) {
  const entry: TrashItem = { ...item, id: `${item.entityType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, deletedAt: new Date().toISOString() };
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
