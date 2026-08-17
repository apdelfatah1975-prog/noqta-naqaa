import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Inventory from "./Inventory";

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  createItem: vi.fn(),
  createMovement: vi.fn(),
  deleteItem: vi.fn(),
  deleteMovement: vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    filters: {
      inventory: {
        summary: { useQuery: mocks.summary },
        createItem: { useMutation: mocks.createItem },
        createMovement: { useMutation: mocks.createMovement },
        deleteItem: { useMutation: mocks.deleteItem },
        deleteMovement: { useMutation: mocks.deleteMovement },
      },
      dashboard: { invalidate: mocks.invalidate },
    },
    useUtils: () => ({
      filters: {
        inventory: { summary: { invalidate: mocks.invalidate } },
        dashboard: { invalidate: mocks.invalidate },
      },
    }),
  },
}));

describe("تفاصيل المنصرف في المخزون", () => {
  beforeEach(() => {
    mocks.createItem.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.createMovement.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.deleteItem.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.deleteMovement.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.summary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [{ id: 4, name: "شمعة كربون 10 بوصة", notes: null, openingQuantity: 10, currentBalance: 7 }],
        movements: [{
          id: 8,
          inventoryItemId: 4,
          inventoryItemName: "شمعة كربون 10 بوصة",
          movementType: "outgoing",
          quantity: 3,
          movementDate: new Date("2026-08-15T09:00:00.000Z"),
          technicianName: "محمد الفني",
          notes: "صرف لتركيب جديد",
        }],
      },
    });
  });

  afterEach(cleanup);

  it("يعرض اسم الصنف ونوع المنصرف والفني أو المستلم وملاحظاته", () => {
    render(<Inventory />);

    expect(screen.getAllByText("شمعة كربون 10 بوصة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("#0004").length).toBeGreaterThan(0);
    expect(screen.getAllByText("رقم الصنف").length).toBeGreaterThan(0);
    expect(screen.getAllByText("نوع الصنف").length).toBeGreaterThan(0);
    expect(screen.getAllByText("منصرف").length).toBeGreaterThan(0);
    expect(screen.getAllByText("محمد الفني").length).toBeGreaterThan(0);
    expect(screen.getAllByText("صرف لتركيب جديد").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الفني / المستلم").length).toBeGreaterThan(0);
  });

  it("يفتح زر صرف الصنف نموذج المنصرف مباشرة", () => {
    render(<Inventory />);
    fireEvent.click(screen.getAllByRole("button", { name: "صرف صنف" })[0]);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/صرف صنف من المخزن/)).toBeTruthy();
    expect(dialog.getByDisplayValue("منصرف")).toBeTruthy();
  });

  it("يعرض حقول بيانات الصنف المفيدة داخل بطاقة الإضافة", () => {
    render(<Inventory />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة صنف" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("نوع الصنف")).toBeTruthy();
    expect(dialog.getByText("وحدة القياس")).toBeTruthy();
    expect(dialog.getByText("حد التنبيه")).toBeTruthy();
    expect(dialog.queryByText("سعر الشراء الافتراضي")).toBeNull();
    expect(dialog.queryByText("سعر شراء الوحدة")).toBeNull();
  });

  it("يعرض واجهة المخزن الفارغة عند فشل الاستعلام دون رسالة تعذر التحميل", () => {
    mocks.summary.mockReturnValue({ isLoading: false, isError: true, data: undefined });
    render(<Inventory />);
    expect(screen.getByText("إدارة المخزن")).toBeTruthy();
    expect(screen.queryByText("تعذر تحميل بيانات المخزن.")).toBeNull();
    expect(screen.getAllByText("لا توجد حركات في المخزن بعد.").length).toBeGreaterThan(0);
  });
});
