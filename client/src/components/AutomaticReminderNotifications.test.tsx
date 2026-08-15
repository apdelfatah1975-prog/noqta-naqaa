import { cleanup, render, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AutomaticReminderNotifications } from "./AutomaticReminderNotifications";

const mocks = vi.hoisted(() => ({
  alerts: vi.fn(),
  permission: vi.fn(),
  show: vi.fn(),
  soundEnabled: vi.fn(),
  playTone: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: { filters: { reminders: { alerts: { useQuery: mocks.alerts } } } },
}));

vi.mock("@/lib/deviceNotifications", () => ({
  getDeviceNotificationPermission: mocks.permission,
  isReminderSoundEnabled: mocks.soundEnabled,
  playReminderTone: mocks.playTone,
  showDeviceReminderNotification: mocks.show,
}));

describe("التنبيه التلقائي للمواعيد", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.permission.mockReturnValue("granted");
    mocks.show.mockResolvedValue(true);
    mocks.soundEnabled.mockReturnValue(true);
    mocks.alerts.mockReturnValue({
      data: [{ id: 9, alertDate: new Date("2026-08-15T09:00:00.000Z"), customer: { name: "أحمد" } }],
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("يرسل إشعارًا تلقائيًا واحدًا للموعـد الجاهز بعد منح الإذن", async () => {
    render(<AutomaticReminderNotifications />);

    await waitFor(() => expect(mocks.show).toHaveBeenCalledWith("أحمد", expect.stringMatching(/^water-alert-9-\d{4}-\d{2}-\d{2}$/)));
    expect(mocks.playTone).toHaveBeenCalledOnce();
  });

  it("يشغل الصوت حتى إذا لم يمنح المستخدم إذن إشعار الجهاز", async () => {
    mocks.permission.mockReturnValue("denied");
    render(<AutomaticReminderNotifications />);

    await waitFor(() => expect(mocks.playTone).toHaveBeenCalledOnce());
    expect(mocks.show).not.toHaveBeenCalled();
  });
});
