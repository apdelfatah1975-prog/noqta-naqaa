import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Inventory from "./Inventory";

const mocks = vi.hoisted(() => ({
  summary: vi.fn(),
  createItem: vi.fn(),
  createMovement: vi.fn(),
  movementMutate: vi.fn(),
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
        cash: { summary: { invalidate: mocks.invalidate } },
      },
    }),
  },
}));

describe("تفاصيل المنصرف في المخزون", () => {
  beforeEach(() => {
    mocks.createItem.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.movementMutate.mockReset();
    mocks.createMovement.mockReturnValue({ mutate: mocks.movementMutate, isPending: false });
    mocks.deleteItem.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.deleteMovement.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.summary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [{ id: 4, name: "شمعة كربون 10 بوصة", notes: null, openingQuantity: 10, currentBalance: 7, reorderLevel: 2 }],
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
    expect(screen.getAllByText("الصنف").length).toBeGreaterThan(0);
    expect(screen.getAllByText("منصرف").length).toBeGreaterThan(0);
    expect(screen.getAllByText("محمد الفني").length).toBeGreaterThan(0);
    expect(screen.getAllByText("صرف لتركيب جديد").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الفني / المستلم").length).toBeGreaterThan(0);
    expect(screen.getAllByText("7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("متوفر").length).toBeGreaterThan(0);
  });

  it("يفصل سعر الوحدة عن إجمالي التكلفة في حركة الوارد", () => {
    mocks.summary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [{ id: 4, name: "فلتر جامبو", notes: null, openingQuantity: 1, currentBalance: 1, reorderLevel: 2 }],
        movements: [{ id: 9, inventoryItemId: 4, inventoryItemName: "فلتر جامبو", movementType: "incoming", quantity: 1, unitCost: 80000, movementDate: new Date("2026-08-18T09:00:00.000Z"), technicianName: null, notes: null }],
      },
    });
    render(<Inventory />);
    expect(screen.getAllByText("سعر الوحدة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("الإجمالي · 1 قطعة").length).toBeGreaterThan(0);
    expect(screen.getAllByText("٨٠٠").length).toBeGreaterThanOrEqual(2);
  });

  it("يفتح زر صرف الصنف نموذج المنصرف مباشرة", () => {
    render(<Inventory />);
    fireEvent.click(screen.getAllByRole("button", { name: "صرف صنف" })[0]);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/صرف صنف من المخزن/)).toBeTruthy();
    expect(dialog.getByDisplayValue("منصرف")).toBeTruthy();
  });

  it("يعرض مسار إضافة الوارد للصنف الموجود لتحديث رصيده", () => {
    render(<Inventory />);
    expect(screen.getAllByRole("button", { name: "إضافة وارد" }).length).toBeGreaterThan(0);
  });

  it("يحوّل سعر قطعة الوارد إلى إجمالي صحيح قبل إرساله للخادم", () => {
    render(<Inventory />);
    fireEvent.click(screen.getAllByRole("button", { name: "إضافة وارد" })[0]);
    const dialog = within(screen.getByRole("dialog"));
    const numberInputs = dialog.getAllByRole("spinbutton");
    fireEvent.change(numberInputs[0], { target: { value: "10" } });
    fireEvent.change(numberInputs[1], { target: { value: "50" } });
    expect(dialog.getByText("إجمالي الخصم المتوقع: 500.00")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "حفظ الحركة" }));
    expect(mocks.movementMutate).toHaveBeenCalledWith(expect.objectContaining({ quantity: 10, unitCost: 5000 }));
  });

  it("ينقل بطاقة الصنف إلى صفها ويظلله بالبرتقالي", async () => {
    window.history.pushState({}, "", "/inventory?item=4");
    render(<Inventory />);
    await waitFor(() => {
      const rows = document.querySelectorAll('[data-inventory-item-id="4"]');
      expect(rows.length).toBeGreaterThan(0);
      expect(Array.from(rows).some(row => row.className.includes("bg-orange-100"))).toBe(true);
    });
  });

  it("يعرض حقول بيانات الصنف المفيدة داخل بطاقة الإضافة", () => {
    render(<Inventory />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة صنف جديد" }));
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("نوع الصنف")).toBeTruthy();
    expect(dialog.getByText("وحدة القياس")).toBeTruthy();
    expect(dialog.getByText("الحد الأدنى للرصيد")).toBeTruthy();
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
