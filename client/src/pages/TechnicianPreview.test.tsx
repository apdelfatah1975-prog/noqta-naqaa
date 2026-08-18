import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TechnicianPreview from "./TechnicianPreview";

const setLocation = vi.fn();
const mutate = vi.fn();
const refetch = vi.fn();

const orders = [
  {
    id: 7,
    status: "assigned",
    visitType: "maintenance",
    visitDate: new Date("2026-08-18T09:00:00Z"),
    visitResult: null,
    customer: { name: "أحمد محمد", phone: "0500000000", address: "حي النور", latitude: null, longitude: null },
  },
];

vi.mock("wouter", () => ({ useLocation: () => ["/technician-preview", setLocation] }));
vi.mock("@/_core/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: 3, name: "الفني التجريبي", role: "user" } }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ filters: { visits: { list: { invalidate: vi.fn() } }, dashboard: { invalidate: vi.fn() } } }),
    filters: {
      workOrders: {
        list: { useQuery: () => ({ data: orders, refetch }) },
        updateStatus: { useMutation: () => ({ mutate, isPending: false }) },
        addProof: { useMutation: () => ({ mutate: vi.fn(), isPending: false }) },
      },
      inventory: { technicianSummary: { useQuery: () => ({ data: { items: [] } }) } },
    },
  },
}));

describe("واجهة الفني وأوامر العمل", () => {
  afterEach(() => {
    cleanup();
    orders[0].status = "assigned";
    setLocation.mockReset();
    mutate.mockReset();
    refetch.mockReset();
  });

  it("تعرض بيانات العميل المسموحة وتحجب أسرار الشركة", () => {
    render(<TechnicianPreview />);
    expect(screen.getByText("أوامر اليوم")).toBeTruthy();
    expect(screen.getByText("أحمد محمد")).toBeTruthy();
    expect(screen.getByText("بيانات العمل المسموحة فقط")).toBeTruthy();
    expect(screen.queryByText("الخزينة العامة")).toBeNull();
    expect(screen.queryByText("تكلفة الشراء")).toBeNull();
    expect(screen.queryByText("تقارير الشركة")).toBeNull();
  });

  it("تنقل أمر العمل من مسند إلى في الطريق", () => {
    render(<TechnicianPreview />);
    fireEvent.click(screen.getByRole("button", { name: "في الطريق" }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ id: 7, status: "en_route" }));
  });

  it("تفتح نموذج الإغلاق للأمر الجاري وتعرض حقول النتيجة والتحصيل", () => {
    orders[0].status = "en_route";
    render(<TechnicianPreview />);
    fireEvent.click(screen.getByRole("button", { name: "تحديث" }));
    expect(screen.getByText("إغلاق أمر العمل")).toBeTruthy();
    expect(screen.getByLabelText("المبلغ المحصل")).toBeTruthy();
  });
});
