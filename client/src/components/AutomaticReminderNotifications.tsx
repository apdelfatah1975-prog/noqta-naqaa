import { getDeviceNotificationPermission, isReminderSoundEnabled, playReminderTone, showDeviceReminderNotification } from "@/lib/deviceNotifications";
import { trpc } from "@/lib/trpc";
import { useEffect } from "react";

export function AutomaticReminderNotifications() {
  const { data: readyAlerts } = trpc.filters.reminders.alerts.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    if (!readyAlerts?.length) return;
    const permissionGranted = getDeviceNotificationPermission() === "granted";
    for (const alert of readyAlerts) {
      const dayKey = new Date().toLocaleDateString("en-CA");
      const key = `water-alert-${alert.id}-${dayKey}`;
      const soundKey = `${key}-sound`;
      if (!localStorage.getItem(soundKey) && isReminderSoundEnabled()) {
        if (playReminderTone()) localStorage.setItem(soundKey, "played");
      }
      if (!permissionGranted || localStorage.getItem(key)) continue;
      void showDeviceReminderNotification(alert.customer?.name || "عميل", key).then(sent => {
        if (sent) localStorage.setItem(key, "sent");
      });
    }
  }, [readyAlerts]);

  return null;
}
