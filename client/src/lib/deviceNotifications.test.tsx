import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeviceNotificationPermission, isNotificationVibrationEnabled, playReminderTone, playWorkOrderTone, requestDeviceNotificationPermission, setNotificationVibrationEnabled, showDeviceReminderNotification, vibrateNotification } from "./deviceNotifications";

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

  it("يشغل نغمة التنبيه الأقوى عندما يكون الصوت مفعّلًا ويمنعها عند إيقافه", () => {
    const setValueAtTime = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const oscillator = {
      frequency: { setValueAtTime },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: undefined as (() => void) | undefined,
    };
    const gain = { gain: { setValueAtTime, exponentialRampToValueAtTime }, connect: vi.fn() };
    const close = vi.fn(async () => undefined);
    class AudioContextMock {
      currentTime = 0;
      destination = {};
      createOscillator() { return oscillator; }
      createGain() { return gain; }
      close = close;
    }
    vi.stubGlobal("AudioContext", AudioContextMock);
    localStorage.removeItem("water-filter-reminder-sound-enabled");
    expect(playReminderTone()).toBe(true);
    expect(exponentialRampToValueAtTime).toHaveBeenCalledWith(0.32, 0.03);
    expect(oscillator.stop).toHaveBeenCalledWith(0.78);
    localStorage.setItem("water-filter-reminder-sound-enabled", "false");
    expect(playReminderTone()).toBe(false);
    expect(close).not.toHaveBeenCalled();
  });

  it("يشغل نغمة أمر الفني المرتفعة بتردد ومدة مميزين", () => {
    const setValueAtTime = vi.fn();
    const exponentialRampToValueAtTime = vi.fn();
    const oscillator = {
      frequency: { setValueAtTime },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: undefined as (() => void) | undefined,
    };
    const gain = { gain: { setValueAtTime, exponentialRampToValueAtTime }, connect: vi.fn() };
    class AudioContextMock {
      currentTime = 0;
      destination = {};
      createOscillator() { return oscillator; }
      createGain() { return gain; }
      close = vi.fn(async () => undefined);
    }
    vi.stubGlobal("AudioContext", AudioContextMock);
    localStorage.removeItem("water-filter-reminder-sound-enabled");
    expect(playWorkOrderTone()).toBe(true);
    expect(setValueAtTime).toHaveBeenCalledWith(880, 0);
    expect(exponentialRampToValueAtTime).toHaveBeenCalledWith(0.78, 0.03);
    expect(oscillator.stop).toHaveBeenCalledWith(1.15);
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
