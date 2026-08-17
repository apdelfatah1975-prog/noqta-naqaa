import { afterEach, describe, expect, it } from "vitest";
import { getTrashItems, moveToTrash, permanentlyDeleteFromTrash, restoreFromTrash, TRASH_BIN_KEY } from "./trashBin";

describe("سلة المحذوفات المحلية", () => {
  afterEach(() => localStorage.clear());

  it("تحفظ العنصر وتستعيده", () => {
    const item = moveToTrash({ entityType: "technician-settings", entityLabel: "إعدادات الفني: أحمد", payload: { name: "أحمد" } });
    expect(getTrashItems()).toHaveLength(1);
    expect(restoreFromTrash(item.id)?.entityLabel).toContain("أحمد");
    expect(getTrashItems()).toHaveLength(0);
  });

  it("تحذف العنصر نهائيًا ولا تتركه في التخزين المحلي", () => {
    const item = moveToTrash({ entityType: "customer", entityLabel: "عميل تجريبي", payload: { id: 4 } });
    permanentlyDeleteFromTrash(item.id);
    expect(getTrashItems()).toEqual([]);
    expect(localStorage.getItem(TRASH_BIN_KEY)).toBe("[]");
  });
});
