export type DeviceNotificationPermission = NotificationPermission | "unsupported";

export function getDeviceNotificationPermission(): DeviceNotificationPermission {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export async function requestDeviceNotificationPermission(): Promise<DeviceNotificationPermission> {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.requestPermission();
}

export async function showDeviceReminderNotification(customerName: string, tag: string): Promise<boolean> {
  if (getDeviceNotificationPermission() !== "granted") return false;
  const options = {
    body: `موعد متابعة ${customerName} أصبح جاهزًا للمتابعة.`,
    icon: "/app-icon.svg",
    badge: "/app-icon.svg",
    tag,
    data: { url: "/reminders" },
  };
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("موعد متابعة قريب", options);
      return true;
    }
    new Notification("موعد متابعة قريب", options);
    return true;
  } catch {
    return false;
  }
}
