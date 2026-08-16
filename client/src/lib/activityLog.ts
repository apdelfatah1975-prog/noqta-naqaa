const ACTIVITY_LOG_KEY = "purepoint-activity-log";
const MAX_ENTRIES = 100;

export type ActivityLogEntry = {
  id: string;
  action: string;
  details: string;
  createdAt: string;
};

function available() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

export function getActivityLog(): ActivityLogEntry[] {
  if (!available()) return [];
  try {
    const value = JSON.parse(localStorage.getItem(ACTIVITY_LOG_KEY) ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function appendActivityLog(action: string, details: string, now = new Date()) {
  if (!available()) return;
  const entry: ActivityLogEntry = {
    id: `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
    action,
    details,
    createdAt: now.toISOString(),
  };
  localStorage.setItem(ACTIVITY_LOG_KEY, JSON.stringify([entry, ...getActivityLog()].slice(0, MAX_ENTRIES)));
  window.dispatchEvent(new CustomEvent("purepoint-activity-log-changed"));
}

export function clearActivityLog() {
  if (!available()) return;
  localStorage.removeItem(ACTIVITY_LOG_KEY);
  window.dispatchEvent(new CustomEvent("purepoint-activity-log-changed"));
}
