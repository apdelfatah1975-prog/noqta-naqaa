import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheOfflineCustomers,
  clearOfflineState,
  getOfflineCustomers,
  getOfflineSession,
  getPendingVisits,
  queueOfflineVisit,
  rememberOfflineSession,
  removePendingVisit,
} from "./offlineSync";

describe("التخزين المحلي للمزامنة", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("crypto", { randomUUID: () => "26c4b0f0-e34e-4a89-8d6f-4dbdfd34403e" });
  });

  it("يحفظ جلسة الجهاز والعملاء بعد أول اتصال", () => {
    rememberOfflineSession({ id: 5, name: "مدير", email: "manager@example.com", openId: "owner-5", role: "admin" });
    cacheOfflineCustomers([{ id: 8, name: "عميل اختبار", phone: "01000000000" }]);

    expect(getOfflineSession()).toMatchObject({ id: 5, name: "مدير" });
    expect(getOfflineCustomers()).toEqual([{ id: 8, name: "عميل اختبار", phone: "01000000000" }]);
  });

  it("يضع الزيارة في طابور الحساب ثم يزيلها بعد تأكيد المزامنة", () => {
    const pending = queueOfflineVisit(5, {
      customerId: 8,
      visitType: "maintenance",
      visitDate: "2026-08-15T09:00:00.000Z",
      notes: "زيارة دون إنترنت",
    });

    expect(getPendingVisits(5)).toEqual([expect.objectContaining({ clientOperationId: pending.clientOperationId, customerId: 8 })]);
    expect(getPendingVisits(6)).toEqual([]);
    removePendingVisit(5, pending.clientOperationId);
    expect(getPendingVisits(5)).toEqual([]);
  });

  it("يمسح بيانات الجهاز وطابور مزامنته عند تسجيل الخروج", () => {
    rememberOfflineSession({ id: 5, name: "مدير", email: "manager@example.com", openId: "owner-5", role: "admin" });
    queueOfflineVisit(5, { customerId: 8, visitType: "other", visitDate: "2026-08-15T09:00:00.000Z", notes: null });

    clearOfflineState();

    expect(getOfflineSession()).toBeNull();
    expect(getPendingVisits(5)).toEqual([]);
  });
});
