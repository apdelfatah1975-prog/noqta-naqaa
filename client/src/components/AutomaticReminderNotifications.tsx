import { getDeviceNotificationPermission, isReminderSoundEnabled, playReminderTone, showDeviceReminderNotification } from "@/lib/deviceNotifications";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

export function AutomaticReminderNotifications() {
  const { data: readyAlerts } = trpc.filters.reminders.alerts.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (getDeviceNotificationPermission() !== "granted" || !readyAlerts?.length) return;
    for (const alert of readyAlerts) {
      const dayKey = new Date().toLocaleDateString("en-CA");
      const key = `water-alert-${alert.id}-${dayKey}`;
      if (localStorage.getItem(key)) continue;
      void showDeviceReminderNotification(alert.customer?.name || "عميل", key).then(sent => {
        if (!sent) return;
        localStorage.setItem(key, "sent");
        if (isReminderSoundEnabled()) playReminderTone();
      });
    }
  }, [readyAlerts]);

  return null;
}
