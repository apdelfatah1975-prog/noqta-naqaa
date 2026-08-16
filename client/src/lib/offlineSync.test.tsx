import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  cacheOfflineCustomers,
  cacheOfflineReport,
  createOfflineBackup,
  clearOfflineState,
  getOfflineCustomers,
  getOfflineReport,
  getOfflineSession,
  getPendingCustomers,
  queueOfflineCash,
  getPendingVisits,
  queueOfflineCustomer,
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

  it("يضع العميل الجديد في طابور المزامنة ويظهر محليًا", () => {
    const pending = queueOfflineCustomer(5, { name: "عميل دون اتصال", phone: "01011111111", address: null, latitude: null, longitude: null, notes: null });

    expect(getPendingCustomers(5)).toEqual([expect.objectContaining({ clientOperationId: pending.clientOperationId, name: "عميل دون اتصال" })]);
    expect(getOfflineCustomers()).toEqual([expect.objectContaining({ id: pending.localId, name: "عميل دون اتصال" })]);
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

  it("يحفظ التقرير محليًا ليستعمله التصدير دون اتصال", () => {
    const report = { period: { dateFrom: "2026-08-01", dateTo: "2026-08-16" }, summary: { income: 1000 } };
    cacheOfflineReport(5, "2026-08-01", "2026-08-16", report);
    expect(getOfflineReport(5, "2026-08-01", "2026-08-16")).toEqual(report);
    expect(getOfflineReport(5, "2026-07-01", "2026-07-31")).toBeNull();
  });

  it("يجمع كل بيانات التطبيق المحلية في نسخة احتياطية واحدة", () => {
    rememberOfflineSession({ id: 5, name: "مدير", email: "manager@example.com", openId: "owner-5", role: "admin" });
    cacheOfflineCustomers([{ id: 8, name: "عميل محفوظ", phone: "01000000000" }]);
    cacheOfflineReport(5, "2026-08-01", "2026-08-16", { summary: { income: 1000 } });
    queueOfflineCash(5, { transactionType: "income", currency: "SAR", amount: 250, category: "صيانة", transactionDate: "2026-08-16", recipientName: "عميل محفوظ", notes: null });

    const backup = createOfflineBackup(new Date("2026-08-16T12:00:00.000Z"));

    expect(backup).toMatchObject({ format: "purepoint-offline-backup", version: 1, exportedAt: "2026-08-16T12:00:00.000Z", app: "نقطة نقاء" });
    expect(backup.storage["purepoint-offline-session"]).toMatchObject({ id: 5 });
    expect(backup.storage["purepoint-offline-customers"]).toEqual([expect.objectContaining({ name: "عميل محفوظ" })]);
    expect(Object.keys(backup.storage).some(key => key.startsWith("purepoint-pending-cash-5"))).toBe(true);
  });

  it("يمسح بيانات الجهاز وطابور مزامنته عند تسجيل الخروج", () => {
    rememberOfflineSession({ id: 5, name: "مدير", email: "manager@example.com", openId: "owner-5", role: "admin" });
    queueOfflineVisit(5, { customerId: 8, visitType: "other", visitDate: "2026-08-15T09:00:00.000Z", notes: null });

    clearOfflineState();

    expect(getOfflineSession()).toBeNull();
    expect(getPendingVisits(5)).toEqual([]);
  });

  it("يحفظ ويسترجع 500 عميل محليًا بسرعة مناسبة للعمل دون اتصال", () => {
    const customers = Array.from({ length: 500 }, (_, index) => ({
      id: index + 1,
      name: `عميل ${index + 1}`,
      phone: `0100000${String(index).padStart(4, "0")}`,
      address: null,
      latitude: null,
      longitude: null,
      notes: null,
    }));

    const startedAt = performance.now();
    cacheOfflineCustomers(customers);
    const restored = getOfflineCustomers();
    const elapsedMs = performance.now() - startedAt;

    expect(restored).toHaveLength(500);
    expect(restored[499]).toMatchObject({ id: 500, name: "عميل 500" });
    expect(elapsedMs).toBeLessThan(500);
  });
});
