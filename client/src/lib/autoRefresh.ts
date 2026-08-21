export const AUTO_REFRESH_INTERVALS = [5, 15] as const;
export type AutoRefreshIntervalMinutes = (typeof AUTO_REFRESH_INTERVALS)[number];

export type AutoRefreshSettings = {
  enabled: boolean;
  intervalMinutes: AutoRefreshIntervalMinutes;
};

const STORAGE_KEY = "purepoint:auto-refresh-settings";
const DEFAULT_SETTINGS: AutoRefreshSettings = { enabled: false, intervalMinutes: 15 };

function normalizeInterval(value: unknown): AutoRefreshIntervalMinutes {
  return value === 5 ? 5 : 15;
}

export function getAutoRefreshSettings(): AutoRefreshSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null") as Partial<AutoRefreshSettings> | null;
    return {
      enabled: parsed?.enabled === true,
      intervalMinutes: normalizeInterval(parsed?.intervalMinutes),
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function setAutoRefreshSettings(settings: AutoRefreshSettings): AutoRefreshSettings {
  const normalized = {
    enabled: settings.enabled === true,
    intervalMinutes: normalizeInterval(settings.intervalMinutes),
  } satisfies AutoRefreshSettings;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

export function isEditingFormElement(element: Element | null): boolean {
  return element instanceof HTMLElement
    && Boolean(element.closest("main"))
    && element.matches('input, textarea, select, [contenteditable="true"]');
}

export function formatLastRefreshTime(timestamp: number | null): string {
  if (!timestamp) return "لم يتم التحديث تلقائيًا بعد";
  return `آخر تحديث: ${new Date(timestamp).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}`;
}
