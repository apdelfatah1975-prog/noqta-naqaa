export const APP_SETTINGS_KEY = "purepoint-app-settings";

export type AppSettings = {
  companyName: string;
  companyPhone: string;
  companyAddress: string;
  defaultTechnician: string;
  followUpDays: number;
  reminderLeadDays: number;
  reminderHour: number;
  reminderMinute: number;
  remindersEnabled: boolean;
  reminderSoundEnabled: boolean;
  reminderKeepVisibleNextDay: boolean;
  currencyLabel: string;
  dateFormat: "arabic" | "gregorian";
  useArabicDigits: boolean;
  dashboardShowUpcoming: boolean;
  dashboardShowDue: boolean;
  dashboardShowCash: boolean;
  dashboardShowInventory: boolean;
  customerCodeMode: "automatic" | "manual";
  defaultVisitType: "installation" | "maintenance" | "cartridge_change" | "follow_up" | "other";
  autoSaveLocally: boolean;
  syncWhenOnline: boolean;
  backupReminderDays: number;
  confirmDestructiveActions: boolean;
  compactTables: boolean;
};

export const defaultAppSettings: AppSettings = {
  companyName: "نقطة نقاء",
  companyPhone: "",
  companyAddress: "",
  defaultTechnician: "",
  followUpDays: 120,
  reminderLeadDays: 1,
  reminderHour: 9,
  reminderMinute: 0,
  remindersEnabled: true,
  reminderSoundEnabled: true,
  reminderKeepVisibleNextDay: true,
  currencyLabel: "ر.س",
  dateFormat: "arabic",
  useArabicDigits: true,
  dashboardShowUpcoming: true,
  dashboardShowDue: true,
  dashboardShowCash: true,
  dashboardShowInventory: true,
  customerCodeMode: "automatic",
  defaultVisitType: "installation",
  autoSaveLocally: true,
  syncWhenOnline: true,
  backupReminderDays: 7,
  confirmDestructiveActions: true,
  compactTables: false,
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getAppSettings(): AppSettings {
  if (!canUseStorage()) return { ...defaultAppSettings };
  try {
    const raw = localStorage.getItem(APP_SETTINGS_KEY);
    if (!raw) return { ...defaultAppSettings };
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return { ...defaultAppSettings, ...parsed };
  } catch {
    return { ...defaultAppSettings };
  }
}

export function saveAppSettings(patch: Partial<AppSettings>): AppSettings {
  const next = { ...getAppSettings(), ...patch };
  if (canUseStorage()) localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(next));
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("purepoint-settings-changed", { detail: next }));
  return next;
}

export function resetAppSettings(): AppSettings {
  if (canUseStorage()) localStorage.removeItem(APP_SETTINGS_KEY);
  const next = { ...defaultAppSettings };
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("purepoint-settings-changed", { detail: next }));
  return next;
}

export function formatAppMoney(amountInHalalas: number, settings = getAppSettings()) {
  return `${new Intl.NumberFormat(settings.dateFormat === "arabic" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 }).format(amountInHalalas / 100)} ${settings.currencyLabel}`;
}

export function formatAppDate(value: string | Date, settings = getAppSettings()) {
  return new Intl.DateTimeFormat(settings.dateFormat === "arabic" ? "ar-SA" : "en-GB", { dateStyle: "medium" }).format(new Date(value));
}
