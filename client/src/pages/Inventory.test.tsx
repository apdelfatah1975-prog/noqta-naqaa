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
  technicians: vi.fn(),
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
      technicians: { list: { useQuery: mocks.technicians } },
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
    mocks.technicians.mockReturnValue({ data: [{ id: 12, name: "محمد الفني" }], isLoading: false, isError: false });
    mocks.summary.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [{ id: 4, name: "شمعة كربون 10 بوصة", category: "شمع فلاتر", unit: "قطعة", notes: "مقاس 10 بوصة", openingQuantity: 10, currentBalance: 7, reorderLevel: 2, openingUnitCost: 5000, openingAddedAt: new Date("2026-08-01T09:00:00.000Z") }],
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

  it("يفتح زر صرف الصنف نموذج المنصرف مباشرة", () => {
    render(<Inventory />);
    fireEvent.click(screen.getAllByRole("button", { name: "صرف صنف" })[0]);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText(/صرف صنف من المخزن/)).toBeTruthy();
    expect(dialog.getByDisplayValue("منصرف")).toBeTruthy();
  });

  it("يفتح كل بيانات الصنف عند الضغط على اسمه", () => {
    render(<Inventory />);
    fireEvent.click(screen.getAllByRole("button", { name: "شمعة كربون 10 بوصة" })[0]);
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("تفاصيل الصنف: شمعة كربون 10 بوصة")).toBeTruthy();
    expect(dialog.getByText("شمع فلاتر")).toBeTruthy();
    expect(dialog.getByText("مقاس 10 بوصة")).toBeTruthy();
    expect(dialog.getByText("سجل التوريد وتغير السعر")).toBeTruthy();
    expect(dialog.getByText("سجل المنصرف")).toBeTruthy();
    expect(dialog.getByText("محمد الفني")).toBeTruthy();
  });

  it("يغلق نافذة تفاصيل الصنف بزر الإغلاق العائم", () => {
    render(<Inventory />);
    fireEvent.click(screen.getAllByRole("button", { name: "شمعة كربون 10 بوصة" })[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إغلاق تفاصيل الصنف" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("يغلق نافذة تفاصيل الصنف عند النقر خارج البطاقة", async () => {
    render(<Inventory />);
    fireEvent.click(screen.getAllByRole("button", { name: "شمعة كربون 10 بوصة" })[0]);
    expect(screen.getByRole("dialog")).toBeTruthy();
    const overlay = document.querySelector('[data-slot="dialog-overlay"]');
    expect(overlay).toBeTruthy();
    // Radix installs its document-level listener on the next task after mount.
    await new Promise(resolve => setTimeout(resolve, 0));
    // Dispatching on body matches a real pointerdown outside the dialog content.
    fireEvent.pointerDown(document.body);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
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
    expect(dialog.getByText("إجمالي الخصم المتوقع: ٥٠٠")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "حفظ الحركة" }));
    expect(mocks.movementMutate).toHaveBeenCalledWith(expect.objectContaining({ quantity: 10, unitCost: 50 }));
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
