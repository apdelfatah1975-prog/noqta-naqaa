export function calculateInventoryPurchaseAmount(quantity: number, unitCost: number) {
  if (!Number.isFinite(quantity) || quantity < 0) throw new Error("quantity must be non-negative");
  if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("unitCost must be non-negative");
  return quantity * unitCost;
}

export function shouldCreateInventoryPurchase(quantity: number, unitCost: number) {
  return quantity > 0 && unitCost > 0;
}

