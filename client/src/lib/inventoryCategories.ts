export const INVENTORY_CATEGORY_OPTIONS = [
  "فلتر ٧ مراحل كلاسيك",
  "فلاتر جامبو",
  "مبردة",
  "قارورة",
  "شمعات",
  "ممبرين",
  "وصلات",
  "مستلزمات تركيب",
  "أخرى",
] as const;

export const INVENTORY_CATEGORY_STORAGE_KEY = "purepoint-inventory-categories-v1";

export function readCustomInventoryCategories() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const stored = JSON.parse(window.localStorage.getItem(INVENTORY_CATEGORY_STORAGE_KEY) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      : [];
  } catch {
    return [] as string[];
  }
}

export function getInventoryCategoryOptions(customCategories: string[]) {
  return [
    ...INVENTORY_CATEGORY_OPTIONS,
    ...customCategories.filter(category => !(INVENTORY_CATEGORY_OPTIONS as readonly string[]).includes(category)),
  ];
}

export function canRemoveInventoryCategory(category: string, items: Array<{ category?: string | null }>) {
  return !items.some(item => item.category === category);
}
