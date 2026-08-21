import { describe, expect, it, beforeEach } from "vitest";
import { formatLastRefreshTime, getAutoRefreshSettings, isEditingFormElement, setAutoRefreshSettings } from "./autoRefresh";

describe("autoRefresh settings", () => {
  beforeEach(() => window.localStorage.clear());

  it("defaults to disabled with a 15 minute interval", () => {
    expect(getAutoRefreshSettings()).toEqual({ enabled: false, intervalMinutes: 15 });
  });

  it("persists enabled state and only allows five or fifteen minutes", () => {
    setAutoRefreshSettings({ enabled: true, intervalMinutes: 5 });
    expect(getAutoRefreshSettings()).toEqual({ enabled: true, intervalMinutes: 5 });
    setAutoRefreshSettings({ enabled: true, intervalMinutes: 30 as 5 | 15 });
    expect(getAutoRefreshSettings()).toEqual({ enabled: true, intervalMinutes: 15 });
  });

  it("formats the last refresh time and handles an empty value", () => {
    expect(formatLastRefreshTime(null)).toBe("لم يتم التحديث تلقائيًا بعد");
    expect(formatLastRefreshTime(new Date("2026-08-21T09:30:00Z").getTime())).toContain("آخر تحديث:");
  });

  it("detects form editing only inside the admin content area", () => {
    const main = document.createElement("main");
    const input = document.createElement("input");
    const button = document.createElement("button");
    main.append(input, button);
    document.body.append(main);

    expect(isEditingFormElement(input)).toBe(true);
    expect(isEditingFormElement(button)).toBe(false);
    expect(isEditingFormElement(null)).toBe(false);
  });
});
