import { describe, expect, it } from "vitest";
import { canRemoveInventoryCategory, getInventoryCategoryOptions } from "./inventoryCategories";

describe("inventory category management", () => {
  it("adds custom categories without duplicating built-in options", () => {
    const options = getInventoryCategoryOptions(["فلاتر منزلية", "أخرى"]);
    expect(options).toContain("فلاتر منزلية");
    expect(options.filter(option => option === "أخرى")).toHaveLength(1);
  });

  it("blocks removal when a category is used by an inventory item", () => {
    expect(canRemoveInventoryCategory("فلاتر منزلية", [{ category: "فلاتر منزلية" }])).toBe(false);
    expect(canRemoveInventoryCategory("فلاتر منزلية", [{ category: "شمعات" }])).toBe(true);
  });
});
