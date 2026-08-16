import { afterEach, describe, expect, it } from "vitest";
import { defaultAppSettings, formatAppMoney, getAppSettings, resetAppSettings, saveAppSettings } from "./appSettings";

describe("إعدادات التطبيق المحلية", () => {
  afterEach(() => localStorage.clear());

  it("تحفظ التغييرات وتدمجها مع القيم الافتراضية", () => {
    saveAppSettings({ companyName: "شركة اختبار", followUpDays: 90, dashboardShowCash: false });
    expect(getAppSettings()).toMatchObject({ companyName: "شركة اختبار", followUpDays: 90, dashboardShowCash: false, currencyLabel: "ر.س" });
  });

  it("تعيد الإعدادات الافتراضية دون حذف بيانات التطبيق الأخرى", () => {
    localStorage.setItem("purepoint-offline-customers", "[]");
    saveAppSettings({ compactTables: true });
    expect(resetAppSettings()).toEqual(defaultAppSettings);
    expect(localStorage.getItem("purepoint-offline-customers")).toBe("[]");
  });

  it("تنسق المبلغ بالعملة التي اختارها المستخدم", () => {
    expect(formatAppMoney(12550, { ...defaultAppSettings, currencyLabel: "ر.س" })).toContain("١٢٥٫٥");
  });
});
