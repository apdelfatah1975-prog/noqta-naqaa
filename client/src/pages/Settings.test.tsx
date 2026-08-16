import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Settings from "./Settings";

const mocks = vi.hoisted(() => ({
  mutate: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    filters: {
      notifications: {
        setPin: { useMutation: () => ({ mutate: mocks.mutate, isPending: false }) },
      },
    },
  },
}));

vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));

describe("صفحة الإعدادات", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("تعرض إعداد الرقم السري وتسمح بإرساله من صفحة الإعدادات", () => {
    render(<Settings />);

    expect(screen.getByRole("heading", { name: "الإعدادات" })).toBeTruthy();
    expect(screen.getByText("الرقم السري للحماية")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("اتركه فارغًا عند الإعداد لأول مرة"), { target: { value: "1234" } });
    fireEvent.change(screen.getByPlaceholderText("4 أحرف أو أرقام على الأقل"), { target: { value: "5678" } });
    fireEvent.change(screen.getByPlaceholderText("أعد كتابة الرقم السري"), { target: { value: "5678" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الرقم السري" }));

    expect(mocks.mutate).toHaveBeenCalledWith({ currentPin: "1234", newPin: "5678" });
  });
});

export {};
