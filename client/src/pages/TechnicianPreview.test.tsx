import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TechnicianPreview from "./TechnicianPreview";

const setLocation = vi.fn();

vi.mock("wouter", () => ({
  useLocation: () => ["/technician-preview", setLocation],
}));

describe("نموذج واجهة الفني التفاعلي", () => {
  afterEach(() => {
    cleanup();
    setLocation.mockReset();
  });

  it("يعرض البيانات المسموحة ويحجب أسرار الشركة", () => {
    render(<TechnicianPreview />);
    expect(screen.getByText("لوحة الفني اليومية")).toBeTruthy();
    expect(screen.getByText("أحمد محمد")).toBeTruthy();
    expect(screen.getByText("بيانات العمل المسموحة فقط")).toBeTruthy();
    expect(screen.queryByText("الخزينة العامة")).toBeNull();
    expect(screen.queryByText("تكلفة الشراء")).toBeNull();
    expect(screen.queryByText("التقارير")).toBeNull();
  });

  it("تفلتر الزيارات وتفتح نموذج تسجيل النتيجة التجريبية", () => {
    render(<TechnicianPreview />);
    fireEvent.click(screen.getByRole("button", { name: "قادمة" }));
    expect(screen.getByText("أحمد محمد")).toBeTruthy();
    expect(screen.queryByText("محمود علي")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "تسجيل" }));
    expect(screen.getByText("تسجيل نتيجة تجريبية")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /حفظ النتيجة التجريبية/ }));
    expect(screen.getByText("تم الحفظ في النموذج")).toBeTruthy();
  });
});
