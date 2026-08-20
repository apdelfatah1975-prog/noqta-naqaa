import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TechnicianLogin from "./TechnicianLogin";

const navigate = vi.fn();
const mutate = vi.fn();

vi.mock("wouter", () => ({ useLocation: () => ["/technician-app/login", navigate] }));
vi.mock("@/components/InstallAppButton", () => ({ InstallAppButton: () => <button type="button">تثبيت التطبيق</button> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ auth: { me: { invalidate: vi.fn() } } }),
    filters: { technicianAuth: { login: { useMutation: () => ({ mutate, isPending: false }) } } },
  },
}));

describe("واجهة دخول الفني المستقلة", () => {
  afterEach(() => {
    cleanup();
    navigate.mockReset();
    mutate.mockReset();
  });

  it("تعرض دخول الفني فقط مع زر التثبيت وتوضح عزل الإدارة", () => {
    render(<TechnicianLogin />);
    expect(screen.getByRole("heading", { name: "تسجيل الدخول" })).toBeTruthy();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeTruthy();
    expect(screen.getByLabelText("رمز دخول الفني")).toBeTruthy();
    expect(screen.getByRole("button", { name: "تثبيت التطبيق" })).toBeTruthy();
    expect(screen.getByText(/لا تعرض الخزينة أو التقارير/)).toBeTruthy();
    expect(screen.queryByText("العملاء")).toBeNull();
  });

  it("ترسل البريد ورمز الدخول إلى دخول الفني", () => {
    render(<TechnicianLogin />);
    fireEvent.change(screen.getByLabelText("البريد الإلكتروني"), { target: { value: "tech@example.com" } });
    fireEvent.change(screen.getByLabelText("رمز دخول الفني"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "دخول إلى أوامر العمل" }));
    expect(mutate).toHaveBeenCalledWith({ email: "tech@example.com", password: "password123" });
  });
});
