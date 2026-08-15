import { getDeviceNotificationPermission, showDeviceReminderNotification } from "@/lib/deviceNotifications";
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
      const key = `water-alert-${alert.id}-${new Date(alert.alertDate).getTime()}`;
      if (localStorage.getItem(key)) continue;
      void showDeviceReminderNotification(alert.customer?.name || "عميل", key).then(sent => {
        if (sent) localStorage.setItem(key, "sent");
      });
    }
  }, [readyAlerts]);

  return null;
}
