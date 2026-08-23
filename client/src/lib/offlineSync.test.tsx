import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatSyncError } from "../components/OfflineSyncManager";
import {
  cacheOfflineCustomers,
  cacheOfflineReminders,
  getOfflineReminders,
  cacheOfflineWorkOrders,
  getOfflineWorkOrders,
  cacheOfflineReport,
  createOfflineBackup,
  clearOfflineState,
  getOfflineCustomers,
  getOfflineReport,
  getLatestOfflineReport,
  getOfflineSession,
  getPendingCustomers,
  queueOfflineCash,
  getPendingVisits,
  getPendingVisitDeletes,
  queueOfflineCustomer,
  hasOfflineCustomerName,
  queueOfflineVisit,
  queueOfflineInventoryItem,
  getPendingInventory,
  rememberOfflineSession,
  removePendingVisit,
  queueOfflineDelete,
  removePendingVisitDelete,
  restoreOfflineBackup,
  downloadOfflineBackup,
  restoreOfflineBackupFromExcel,
  getPendingOperationCount,
  queueOfflineWorkOrderUpdate,
  queueOfflineWorkOrderProof,
} from "./offlineSync";

describe("معالجة أخطاء مزامنة البيانات", () => {
  it("يعرض رسالة واضحة لأخطاء الاتصال", () => {
    expect(formatSyncError(new Error("Failed to fetch"))).toContain("تعذر الاتصال بالخادم");
  });

  it("يعرض رسالة صلاحيات قابلة للفهم", () => {
    expect(formatSyncError(new Error("401 Unauthorized"))).toContain("انتهت صلاحية الجلسة");
  });

  it("يستخدم رسالة عامة آمنة للأخطاء غير المعروفة", () => {
    expect(formatSyncError({ unexpected: true })).toContain("خطأ غير متوقع");
  });
});

describe("التخزين المحلي للمزامنة", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("crypto", { randomUUID: () => "26c4b0f0-e34e-4a89-8d6f-4dbdfd34403e" });
  });

  it("يحسب العمليات المعلقة بما فيها تحديثات الفني وإثباتات العمل", () => {
    queueOfflineWorkOrderUpdate(5, { id: 11, status: "completed", visitResult: "تم التنفيذ" });
    queueOfflineWorkOrderProof(5, { visitId: 11, kind: "signature", dataUrl: "data:image/png;base64,test" });
    expect(getPendingOperationCount(5)).toBe(2);
  });

  it("يحفظ ويسترجع التذكيرات وأوامر العمل من التخزين المحلي", () => {
    const reminders = { due: [{ id: 1, reminderDate: "2026-08-20" }], alerts: [] };
    const workOrders = { orders: [{ id: 2, status: "assigned" }], customers: [{ id: 8, name: "عميل محلي" }], technicians: [{ id: 3, name: "فني" }] };

    cacheOfflineReminders(reminders);
    cacheOfflineWorkOrders(workOrders);

    expect(getOfflineReminders()).toEqual(reminders);
    expect(getOfflineWorkOrders()).toEqual(workOrders);
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

  it("يحافظ على أصناف الزيارة الأولى داخل طابور العميل الجديد", () => {
    const pending = queueOfflineCustomer(5, { name: "عميل تركيب", phone: "01022222222", address: null, latitude: null, longitude: null, notes: null, firstVisitType: "installation", firstVisitItems: [{ inventoryItemId: 21, quantity: 2, source: "default" }] });

    expect(getPendingCustomers(5)).toEqual([expect.objectContaining({ firstVisitType: "installation", firstVisitItems: [{ inventoryItemId: 21, quantity: 2, source: "default" }] })]);
    expect(pending.localId).toBeLessThan(0);
  });

  it("يحفظ نوع الصنف وبياناته عند إنشاء صنف المخزن دون اتصال", () => {
    const pending = queueOfflineInventoryItem(5, { name: "فلتر ٧ مراحل كلاسيك", category: "فلتر ٧ مراحل كلاسيك", unit: "قطعة", reorderLevel: 2, defaultUnitCost: 0, openingQuantity: 10, notes: "مقاس قياسي" });

    expect(getPendingInventory(5)).toEqual([expect.objectContaining({ entity: "item", name: "فلتر ٧ مراحل كلاسيك", category: "فلتر ٧ مراحل كلاسيك", unit: "قطعة", openingQuantity: 10 })]);
    expect(pending.clientOperationId).toBeTruthy();
  });

  it("يرفض اسم العميل المكرر محليًا حتى مع اختلاف المسافات والحروف", () => {
    rememberOfflineSession({ id: 5, name: "مدير", email: "manager@example.com", openId: "owner-5", role: "admin" });
    cacheOfflineCustomers([{ id: 8, name: "أحمد محمد", phone: "01000000000" }]);

    expect(hasOfflineCustomerName(" أحمد   محمد ")).toBe(true);
    expect(() => queueOfflineCustomer(5, { name: "أحمد محمد", phone: "01011111111", address: null, latitude: null, longitude: null, notes: null })).toThrow("اسم العميل موجود بالفعل");
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

  it("يحافظ على بيانات الأصناف المستخدمة وبيانات التحصيل في الزيارة غير المتصلة", () => {
    const pending = queueOfflineVisit(5, {
      customerId: 8,
      visitType: "maintenance",
      visitDate: "2026-08-15T09:00:00.000Z",
      technicianName: "أحمد",
      visitResult: "تم تغيير الممبرين",
      collectedAmount: 25000,
      collectedCurrency: "SAR",
      notes: "تم الحفظ دون اتصال",
      items: [{ inventoryItemId: 12, quantity: 1, source: "manual" }],
    });

    expect(getPendingVisits(5)).toEqual([expect.objectContaining({
      clientOperationId: pending.clientOperationId,
      technicianName: "أحمد",
      visitResult: "تم تغيير الممبرين",
      collectedAmount: 25000,
      items: [{ inventoryItemId: 12, quantity: 1, source: "manual" }],
    })]);
  });

  it("يحفظ حذف الزيارة في طابور مستقل ثم يزيله بعد المزامنة", () => {
    const pending = queueOfflineDelete(5, { entity: "visit", id: 17, pin: "1234" });

    expect(getPendingVisitDeletes(5)).toEqual([expect.objectContaining({ clientOperationId: pending.clientOperationId, id: 17, entity: "visit" })]);
    removePendingVisitDelete(5, pending.clientOperationId);
    expect(getPendingVisitDeletes(5)).toEqual([]);
  });

  it("يحفظ التقرير محليًا ليستعمله التصدير دون اتصال", () => {
    const report = { period: { dateFrom: "2026-08-01", dateTo: "2026-08-16" }, summary: { income: 1000 } };
    cacheOfflineReport(5, "2026-08-01", "2026-08-16", report);
    expect(getOfflineReport(5, "2026-08-01", "2026-08-16")).toEqual(report);
    expect(getOfflineReport(5, "2026-07-01", "2026-07-31")).toBeNull();
  });

  it("يسترجع أحدث تقرير محلي عند عدم وجود الفترة المطلوبة", () => {
    const older = { period: { dateFrom: "2026-07-01", dateTo: "2026-07-31" }, summary: { income: 700 } };
    const latest = { period: { dateFrom: "2026-08-01", dateTo: "2026-08-16" }, summary: { income: 1000 } };
    cacheOfflineReport(5, "2026-07-01", "2026-07-31", older);
    cacheOfflineReport(5, "2026-08-01", "2026-08-16", latest);
    expect(getLatestOfflineReport(5)).toEqual(latest);
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

  it("ينشئ نسخة Excel محلية بأوراق ورؤوس عربية قابلة للقراءة", async () => {
    rememberOfflineSession({ id: 5, name: "مدير", email: "manager@example.com", openId: "owner-5", role: "admin" });
    cacheOfflineCustomers([{ id: 8, name: "عميل Excel", phone: "01000000000" }]);
    const click = vi.fn();
    const anchor = { click, href: "", download: "" };
    let downloaded: Blob | undefined;
    vi.spyOn(document, "createElement").mockReturnValue(anchor as unknown as HTMLElement);
    vi.stubGlobal("URL", { createObjectURL: vi.fn((blob: Blob) => { downloaded = blob; return "blob:test"; }), revokeObjectURL: vi.fn() });

    expect(downloadOfflineBackup(new Date("2026-08-16T12:00:00.000Z"))).toBe(true);
    expect(anchor.download).toMatch(/\.xlsx$/);
    expect(click).toHaveBeenCalled();
    expect(downloaded).toBeDefined();
    const workbook = (await import("xlsx")).read(await downloaded!.arrayBuffer(), { type: "array" });
    expect(workbook.SheetNames).toContain("العملاء");
    const rows = (await import("xlsx")).utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets["العملاء"]);
    expect(rows[0]).toMatchObject({ الاسم: "عميل Excel", الهاتف: "01000000000" });
    expect(rows[0]).not.toHaveProperty("البيانات");
  });

  it("يستعيد مفاتيح البيانات من ورقة Excel المحلية", async () => {
    rememberOfflineSession({ id: 5, name: "مدير", email: "manager@example.com", openId: "owner-5", role: "admin" });
    cacheOfflineCustomers([{ id: 8, name: "عميل Excel", phone: "01000000000" }]);
    const workbook = (await import("xlsx")).utils.book_new();
    const sheet = (await import("xlsx")).utils.json_to_sheet([{ "مفتاح البيانات": "purepoint-offline-customers", "القيمة": JSON.stringify([{ id: 8, name: "عميل Excel", phone: "01000000000" }]) }]);
    (await import("xlsx")).utils.book_append_sheet(workbook, sheet, "بيانات محلية");
    const bytes = (await import("xlsx")).write(workbook, { bookType: "xlsx", type: "array" });

    cacheOfflineCustomers([{ id: 9, name: "بيانات مؤقتة", phone: "01000000001" }]);
    const result = restoreOfflineBackupFromExcel(bytes);
    expect(result.restoredKeys).toBe(1);
    expect(getOfflineCustomers()).toEqual([{ id: 8, name: "عميل Excel", phone: "01000000000" }]);
  });

  it("يستعيد النسخة الاحتياطية محليًا ويرفض الملف غير الصالح", () => {
    rememberOfflineSession({ id: 5, name: "قديم", email: "old@example.com", openId: "owner-5", role: "admin" });
    cacheOfflineCustomers([{ id: 1, name: "عميل قديم", phone: "01000000000" }]);
    const backup = createOfflineBackup(new Date("2026-08-16T12:00:00.000Z"));
    cacheOfflineCustomers([{ id: 2, name: "بيانات مؤقتة", phone: "01000000001" }]);

    expect(() => restoreOfflineBackup({ format: "invalid" })).toThrow();
    const result = restoreOfflineBackup(backup);

    expect(result.restoredKeys).toBeGreaterThan(0);
    expect(getOfflineSession()).toMatchObject({ id: 5, name: "قديم" });
    expect(getOfflineCustomers()).toEqual([{ id: 1, name: "عميل قديم", phone: "01000000000" }]);
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
