import {
  getDeviceNotificationPermission,
  isNotificationVibrationEnabled,
  isReminderSoundEnabled,
  playReminderTone,
  playWorkOrderTone,
  showDeviceReminderNotification,
  showDeviceWorkOrderNotification,
  vibrateNotification,
} from "@/lib/deviceNotifications";
import { trpc } from "@/lib/trpc";
import { useEffect, useMemo } from "react";
import { extractArray } from "@/lib/dataNormalization";

const WORK_ORDER_SEEN_KEY = "purepoint-work-order-notification-seen";

type WorkOrderNotificationRow = {
  id: number;
  status?: string | null;
  customer?: { name?: string | null } | null;
};

function isPendingWorkOrder(order: WorkOrderNotificationRow) {
  return order.status !== "completed" && order.status !== "cancelled";
}

export function AutomaticReminderNotifications() {
  const { data: readyAlerts } = trpc.filters.reminders.alerts.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
  const { data: workOrders } = trpc.filters.workOrders.list.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
  const safeReadyAlerts = useMemo(() => extractArray<typeof readyAlerts extends (infer T)[] | undefined ? T : unknown>(readyAlerts), [readyAlerts]);
  const safeWorkOrders = useMemo(() => extractArray<WorkOrderNotificationRow>(workOrders), [workOrders]);

  useEffect(() => {
    if (!safeReadyAlerts.length) return;
    const permissionGranted = getDeviceNotificationPermission() === "granted";
    for (const alert of safeReadyAlerts) {
      const dayKey = new Date().toLocaleDateString("en-CA");
      const key = `water-alert-${alert.id}-${dayKey}`;
      const soundKey = `${key}-sound`;
      const vibrationKey = `${key}-vibration`;
      if (!localStorage.getItem(soundKey) && isReminderSoundEnabled()) {
        if (playReminderTone()) localStorage.setItem(soundKey, "played");
      }
      if (!localStorage.getItem(vibrationKey) && isNotificationVibrationEnabled()) {
        if (vibrateNotification()) localStorage.setItem(vibrationKey, "played");
      }
      if (!permissionGranted || localStorage.getItem(key)) continue;
      void showDeviceReminderNotification(alert.customer?.name || "عميل", key).then(sent => {
        if (sent) localStorage.setItem(key, "sent");
      });
    }
  }, [safeReadyAlerts]);

  useEffect(() => {
    if (!safeWorkOrders.length) {
      localStorage.setItem(WORK_ORDER_SEEN_KEY, "");
      return;
    }
    const pendingOrders = safeWorkOrders.filter(isPendingWorkOrder);
    const currentIds = pendingOrders.map(order => String(order.id));
    const stored = localStorage.getItem(WORK_ORDER_SEEN_KEY);
    const previousIds = stored ? new Set(stored.split(",").filter(Boolean)) : null;
    localStorage.setItem(WORK_ORDER_SEEN_KEY, currentIds.join(","));
    if (!previousIds) return;

    const permissionGranted = getDeviceNotificationPermission() === "granted";
    for (const order of pendingOrders) {
      const orderId = String(order.id);
      if (previousIds.has(orderId)) continue;
      const key = `water-work-order-${order.id}`;
      if (isReminderSoundEnabled()) playWorkOrderTone();
      if (isNotificationVibrationEnabled()) vibrateNotification();
      if (!permissionGranted || localStorage.getItem(key)) continue;
      void showDeviceWorkOrderNotification(order.customer?.name || "عميل", key).then(sent => {
        if (sent) localStorage.setItem(key, "sent");
      });
    }
  }, [safeWorkOrders]);

  return null;
}
