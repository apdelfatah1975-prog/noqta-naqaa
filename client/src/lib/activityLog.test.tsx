import { beforeEach, describe, expect, it } from "vitest";
import { appendActivityLog, clearActivityLog, getActivityLog } from "./activityLog";

describe("سجل التغييرات المحلي", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("يحفظ أحدث تغيير ويعيده بالعربية", () => {
    appendActivityLog("تحديث الإعدادات", "تم حفظ إعدادات التطبيق", new Date("2026-08-17T10:00:00.000Z"));
    expect(getActivityLog()).toMatchObject([{ action: "تحديث الإعدادات", details: "تم حفظ إعدادات التطبيق" }]);
  });

  it("يمسح السجل دون التأثير على بقية التخزين", () => {
    localStorage.setItem("purepoint-offline-customers", "[]");
    appendActivityLog("اختبار", "سجل مؤقت");
    clearActivityLog();
    expect(getActivityLog()).toEqual([]);
    expect(localStorage.getItem("purepoint-offline-customers")).toBe("[]");
  });
});
