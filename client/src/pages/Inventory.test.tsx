import { cleanup, render, screen } from "@testing-library/react";
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
});
