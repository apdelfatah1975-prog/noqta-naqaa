import React from "react";
import { cleanup, render, screen, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OfflineStatusIndicator } from "./OfflineStatusIndicator";

const countOfflineQueue = vi.hoisted(() => vi.fn());

vi.mock("@/_core/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: 7 } }),
}));

vi.mock("@/lib/offlineDatabase", () => ({
  countOfflineQueue,
}));

describe("مؤشر مزامنة البيانات", () => {
  beforeEach(() => {
    countOfflineQueue.mockResolvedValue(2);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("يعرض حركة تحميل واضحة أثناء المزامنة ويحافظ على حالة الوصول", async () => {
    render(<OfflineStatusIndicator />);

    await act(async () => {
      window.dispatchEvent(new CustomEvent("purepoint-offline-sync-start"));
    });

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("جارٍ المزامنة");
    expect(status.getAttribute("aria-busy")).toBe("true");
    expect(status.querySelector("svg")?.className.baseVal ?? "").toContain("motion-safe:animate-spin");
  });
});
