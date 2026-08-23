import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotificationSettingsCard } from "./NotificationSettingsCard";

const mocks = vi.hoisted(() => ({
  settingsQuery: vi.fn(),
  nextAlertQuery: vi.fn(),
  saveMutation: vi.fn(),
  saveOptions: null as null | { onSuccess?: () => void },
  invalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    filters: {
      notifications: {
        settings: { useQuery: mocks.settingsQuery },
        nextAlert: { useQuery: mocks.nextAlertQuery },
        saveSettings: { useMutation: (options: { onSuccess?: () => void }) => { mocks.saveOptions = options; return { mutate: mocks.saveMutation, isPending: false }; } },
        enableScheduledAlerts: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
    },
    useUtils: () => ({ filters: { notifications: { settings: { invalidate: mocks.invalidate }, nextAlert: { invalidate: mocks.invalidate } } } }),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("إعداد رقم واتساب الشركة", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.saveOptions = null;
  });

  it("يعرض الرقم الحالي ويسمح بتغييره وحفظه مركزيًا", () => {
    mocks.settingsQuery.mockReturnValue({ data: { alertHour: 9, alertMinute: 0, companyWhatsAppPhone: "966500000000" }, isLoading: false });
    mocks.nextAlertQuery.mockReturnValue({ data: null });
    render(<NotificationSettingsCard />);

    const input = screen.getByPlaceholderText("مثال: 201001234567");
    expect((input as HTMLInputElement).value).toBe("966500000000");
    fireEvent.change(input, { target: { value: "966511111111" } });
    fireEvent.click(screen.getByTestId("save-whatsapp-settings"));

    expect(mocks.saveMutation).toHaveBeenCalledWith(expect.objectContaining({ companyWhatsAppPhone: "966511111111" }));
  });
});

export {};
