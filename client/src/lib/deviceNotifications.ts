export type DeviceNotificationPermission = NotificationPermission | "unsupported";
const SOUND_ENABLED_KEY = "water-filter-reminder-sound-enabled";
const VIBRATION_ENABLED_KEY = "water-filter-notification-vibration-enabled";
const NOTIFICATION_TONE_GAIN = 0.32;
const WORK_ORDER_TONE_GAIN = 0.78;
const NOTIFICATION_TONE_DURATION_SECONDS = 0.78;
const WORK_ORDER_TONE_DURATION_SECONDS = 1.15;

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

export async function showDeviceWorkOrderNotification(customerName: string, tag: string): Promise<boolean> {
  if (getDeviceNotificationPermission() !== "granted") return false;
  const options = {
    body: `يوجد أمر عمل جديد للعميل ${customerName}.`,
    icon: "/app-icon.svg",
    badge: "/app-icon.svg",
    tag,
    data: { url: "/work-orders" },
  };
  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("أمر عمل جديد", options);
      return true;
    }
    new Notification("أمر عمل جديد", options);
    return true;
  } catch {
    return false;
  }
}

export function isReminderSoundEnabled() {
  return typeof localStorage === "undefined" || localStorage.getItem(SOUND_ENABLED_KEY) !== "false";
}

export function setReminderSoundEnabled(enabled: boolean) {
  localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
}

export function isNotificationVibrationEnabled() {
  return typeof localStorage === "undefined" || localStorage.getItem(VIBRATION_ENABLED_KEY) !== "false";
}

export function setNotificationVibrationEnabled(enabled: boolean) {
  localStorage.setItem(VIBRATION_ENABLED_KEY, String(enabled));
}

export function vibrateNotification(): boolean {
  if (!isNotificationVibrationEnabled() || typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
  try {
    return navigator.vibrate([120, 70, 180]);
  } catch {
    return false;
  }
}

function playTone(gainLevel: number, durationSeconds: number, frequency: number): boolean {
  if (!isReminderSoundEnabled() || typeof window === "undefined") return false;
  const AudioContextConstructor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return false;
  try {
    const context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(gainLevel, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + durationSeconds - 0.08);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + durationSeconds);
    oscillator.onended = () => void context.close();
    return true;
  } catch {
    return false;
  }
}

export function playReminderTone(): boolean {
  return playTone(NOTIFICATION_TONE_GAIN, NOTIFICATION_TONE_DURATION_SECONDS, 740);
}

export function playWorkOrderTone(): boolean {
  return playTone(WORK_ORDER_TONE_GAIN, WORK_ORDER_TONE_DURATION_SECONDS, 880);
}
