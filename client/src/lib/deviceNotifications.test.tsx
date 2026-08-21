import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeviceNotificationPermission, isNotificationVibrationEnabled, requestDeviceNotificationPermission, setNotificationVibrationEnabled, showDeviceReminderNotification, vibrateNotification } from "./deviceNotifications";

const serviceWorkerDescriptor = Object.getOwnPropertyDescriptor(navigator, "serviceWorker");

function stubServiceWorker(value: unknown) {
  Object.defineProperty(navigator, "serviceWorker", { value, configurable: true });
}

describe("حالة إذن إشعارات الجهاز", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    if (serviceWorkerDescriptor) Object.defineProperty(navigator, "serviceWorker", serviceWorkerDescriptor);
    else Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("يعيد حالة السماح بعد طلب الإذن", async () => {
    const requestPermission = vi.fn(async () => "granted" as NotificationPermission);
    vi.stubGlobal("Notification", { permission: "default", requestPermission });

    await expect(requestDeviceNotificationPermission()).resolves.toBe("granted");
    expect(requestPermission).toHaveBeenCalledOnce();
  });

  it("يعرض الرفض بوضوح عند عدم السماح", async () => {
    vi.stubGlobal("Notification", { permission: "denied", requestPermission: vi.fn(async () => "denied" as NotificationPermission) });

    expect(getDeviceNotificationPermission()).toBe("denied");
    await expect(requestDeviceNotificationPermission()).resolves.toBe("denied");
  });

  it("يحدد المتصفحات غير الداعمة بدل طلب الإذن", async () => {
    vi.stubGlobal("Notification", undefined);

    expect(getDeviceNotificationPermission()).toBe("unsupported");
    await expect(requestDeviceNotificationPermission()).resolves.toBe("unsupported");
  });

  it("يشغل الاهتزاز عندما يكون مفعّلًا ويمنعه عند إيقافه", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    setNotificationVibrationEnabled(true);
    expect(isNotificationVibrationEnabled()).toBe(true);
    expect(vibrateNotification()).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([120, 70, 180]);
    setNotificationVibrationEnabled(false);
    expect(isNotificationVibrationEnabled()).toBe(false);
    expect(vibrateNotification()).toBe(false);
  });

  it("يرسل إشعار الموعد عبر عامل الخدمة عند منح الإذن", async () => {
    const showNotification = vi.fn(async () => undefined);
    vi.stubGlobal("Notification", { permission: "granted", requestPermission: vi.fn() });
    stubServiceWorker({ ready: Promise.resolve({ showNotification }) });

    await expect(showDeviceReminderNotification("أحمد", "water-alert-81")).resolves.toBe(true);
    expect(showNotification).toHaveBeenCalledWith("موعد متابعة قريب", expect.objectContaining({
      body: "موعد متابعة أحمد أصبح جاهزًا للمتابعة.",
      tag: "water-alert-81",
    }));
  });
});
