export const FOLLOW_UP_DAYS = 120;
export const DEFAULT_ALERT_LEAD_DAYS = 1;
export const DEFAULT_ALERT_HOUR = 9;
export const DEFAULT_ALERT_MINUTE = 0;
export const DEFAULT_TIMEZONE_OFFSET_MINUTES = 180;

export const visitTypes = [
  "installation",
  "maintenance",
  "cartridge_change",
  "follow_up",
  "other",
] as const;

export type VisitType = (typeof visitTypes)[number];

export function needsAutomaticReminder(visitType: VisitType) {
  return visitType === "installation" || visitType === "maintenance";
}

export function followUpDate(visitDate: Date) {
  const dueDate = new Date(visitDate);
  dueDate.setUTCDate(dueDate.getUTCDate() + FOLLOW_UP_DAYS);
  return dueDate;
}

export type ReminderAlertSettings = {
  leadDays: number;
  alertHour: number;
  alertMinute: number;
  timezoneOffsetMinutes: number;
};

export function alertDateForReminder(reminderDate: Date, settings: ReminderAlertSettings) {
  const localDue = new Date(reminderDate.getTime() + settings.timezoneOffsetMinutes * 60_000);
  const localAlertUtcMillis = Date.UTC(
    localDue.getUTCFullYear(),
    localDue.getUTCMonth(),
    localDue.getUTCDate() - settings.leadDays,
    settings.alertHour,
    settings.alertMinute,
    0,
    0,
  );
  return new Date(localAlertUtcMillis - settings.timezoneOffsetMinutes * 60_000);
}

export function isAlertReady(reminderDate: Date, settings: ReminderAlertSettings, now = new Date()) {
  return alertDateForReminder(reminderDate, settings).getTime() <= now.getTime();
}

export function mergeDashboardReminderAlerts<T extends { id: number; reminderDate: Date }>(
  dueReminders: T[],
  upcomingAlerts: T[],
) {
  const dueIds = new Set(dueReminders.map(reminder => reminder.id));
  const reminders = new Map<number, T>();
  [...dueReminders, ...upcomingAlerts].forEach(reminder => reminders.set(reminder.id, reminder));

  return Array.from(reminders.values())
    .sort((first, second) => first.reminderDate.getTime() - second.reminderDate.getTime())
    .map(reminder => ({ reminder, isDue: dueIds.has(reminder.id) }));
}

export function calculateStockBalance(
  openingQuantity: number,
  movements: Array<{ movementType: "incoming" | "outgoing"; quantity: number }>,
) {
  return movements.reduce(
    (balance, movement) =>
      movement.movementType === "incoming"
        ? balance + movement.quantity
        : balance - movement.quantity,
    openingQuantity,
  );
}
