import { describe, expect, it } from "vitest";
import { calculateInventoryPurchaseAmount, shouldCreateInventoryPurchase } from "./inventoryPurchase";

describe("inventory purchase cost", () => {
  it("multiplies unit cost by quantity", () => {
    expect(calculateInventoryPurchaseAmount(10, 5000)).toBe(50000);
  });

  it("does not create a purchase for zero quantity or zero cost", () => {
    expect(shouldCreateInventoryPurchase(0, 5000)).toBe(false);
    expect(shouldCreateInventoryPurchase(10, 0)).toBe(false);
    expect(shouldCreateInventoryPurchase(10, 5000)).toBe(true);
  });
});
