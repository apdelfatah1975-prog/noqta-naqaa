import { describe, expect, it } from "vitest";
import { getBackupSuccessCopy } from "./backupFeedback";

describe("getBackupSuccessCopy", () => {
  it("يؤكد اكتمال تنزيل Excel عند توفر رابط التنزيل", () => {
    expect(getBackupSuccessCopy({ downloaded: true, customers: 4, visits: 9 })).toEqual({
      title: "تم تنزيل النسخة الاحتياطية Excel بنجاح",
      description: "4 عميل و9 زيارة محفوظة في النسخة الحالية.",
    });
  });

  it("يعرض رسالة تجهيز واضحة عند غياب رابط التنزيل", () => {
    expect(getBackupSuccessCopy({ downloaded: false, customers: 0, visits: 0 })).toEqual({
      title: "تم إنشاء النسخة الاحتياطية بنجاح",
      description: "0 عميل و0 زيارة جاهزة للحفظ.",
    });
  });
});
