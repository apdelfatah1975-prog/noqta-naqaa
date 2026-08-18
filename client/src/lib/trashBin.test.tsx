import { afterEach, describe, expect, it } from "vitest";
import { emptyTrash, filterTrashItems, getTrashItems, moveToTrash, permanentlyDeleteFromTrash, restoreFromTrash, TRASH_BIN_KEY } from "./trashBin";

describe("سلة المحذوفات المحلية", () => {
  afterEach(() => localStorage.clear());

  it("تحفظ العنصر وتستعيده", () => {
    const item = moveToTrash({ entityType: "technician-settings", entityLabel: "إعدادات الفني: أحمد", payload: { name: "أحمد" } });
    expect(getTrashItems()).toHaveLength(1);
    expect(restoreFromTrash(item.id)?.entityLabel).toContain("أحمد");
    expect(getTrashItems()).toHaveLength(0);
  });

  it("تختم العنصر باسم المستخدم المحلي ووقت حذف كامل", () => {
    localStorage.setItem("purepoint-offline-session", JSON.stringify({ id: 1, name: "أحمد المدير", email: "admin@example.com", openId: "owner", role: "admin" }));
    const item = moveToTrash({ entityType: "cash", entityLabel: "عملية خزينة", payload: { id: 8 } });
    expect(item.deletedBy).toBe("أحمد المدير");
    expect(Number.isNaN(Date.parse(item.deletedAt))).toBe(false);
    expect(getTrashItems()[0].deletedBy).toBe("أحمد المدير");
  });

  it("تدعم العناصر القديمة وتعرض مستخدمًا سابقًا عند غياب بيانات التدقيق", () => {
    localStorage.setItem(TRASH_BIN_KEY, JSON.stringify([{ id: "legacy-1", entityType: "customer", entityLabel: "عميل قديم", payload: {}, deletedAt: "2026-01-01T10:00:00.000Z" }]));
    expect(getTrashItems()[0].deletedBy).toBe("مستخدم سابق");
  });

  it("تحذف العنصر نهائيًا ولا تتركه في التخزين المحلي", () => {
    const item = moveToTrash({ entityType: "customer", entityLabel: "عميل تجريبي", payload: { id: 4 } });
    permanentlyDeleteFromTrash(item.id);
    expect(getTrashItems()).toEqual([]);
    expect(localStorage.getItem(TRASH_BIN_KEY)).toBe("[]");
  });

  it("تحافظ على أكثر من مئة عنصر دون إسقاط العناصر الأقدم", () => {
    for (let index = 0; index < 125; index += 1) {
      moveToTrash({ entityType: "customer", entityLabel: `عميل ${index}`, payload: { index } });
    }
    expect(getTrashItems()).toHaveLength(125);
    expect(getTrashItems().at(-1)?.entityLabel).toBe("عميل 0");
  });

  it("تبحث في اسم العنصر وبياناته وتصفّي حسب النوع", () => {
    const customer = moveToTrash({ entityType: "customer", entityLabel: "العميل محمد", payload: { phone: "0501234567" } });
    moveToTrash({ entityType: "visit", entityLabel: "زيارة صيانة", payload: { technicianName: "أحمد" } });
    expect(filterTrashItems(getTrashItems(), "محمد")).toEqual([expect.objectContaining({ id: customer.id })]);
    expect(filterTrashItems(getTrashItems(), "0501234567")).toHaveLength(1);
    expect(filterTrashItems(getTrashItems(), "", "visit")).toHaveLength(1);
    expect(filterTrashItems(getTrashItems(), "غير موجود")).toHaveLength(0);
  });

  it("تفرغ السلة بالكامل عند استدعاء العملية المحلية", () => {
    moveToTrash({ entityType: "cash", entityLabel: "عملية تجريبية", payload: { id: 9 } });
    emptyTrash();
    expect(getTrashItems()).toEqual([]);
    expect(localStorage.getItem(TRASH_BIN_KEY)).toBe("[]");
  });
});
