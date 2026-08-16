import { describe, expect, it } from "vitest";
import {
  buildWhatsAppNextVisitMessage,
  buildWhatsAppReminderMessage,
  buildWhatsAppUrl,
  normalizeEgyptianWhatsAppPhone,
  whatsappReminderStage,
} from "./filterUi";

describe("رسائل واتساب اليدوية للتذكيرات", () => {
  const dueDate = new Date(2026, 7, 20, 9, 0, 0);

  it("يحوّل الرقم المصري المحلي إلى الصيغة الدولية", () => {
    expect(normalizeEgyptianWhatsAppPhone("01008797774")).toBe("201008797774");
    expect(normalizeEgyptianWhatsAppPhone("+201008797774")).toBe("201008797774");
  });

  it("يحدد رسالة اليوم السابق ويوم الموعد", () => {
    expect(whatsappReminderStage(dueDate, new Date(2026, 7, 19, 10, 0, 0))).toBe("before");
    expect(whatsappReminderStage(dueDate, new Date(2026, 7, 20, 10, 0, 0))).toBe("today");
    expect(whatsappReminderStage(dueDate, new Date(2026, 7, 18, 10, 0, 0))).toBeNull();
  });

  it("يبني رسالة موعد الصيانة القادمة باسم العميل وتاريخ الموعد", () => {
    const message = buildWhatsAppNextVisitMessage("أحمد", dueDate);
    expect(message).toContain("أحمد");
    expect(message).toContain("موعد الصيانة الدورية القادم");
    expect(message).toContain("يسعدنا خدمتكم");
    expect(message).toContain("٢٠٢٦");
  });

  it("يبني رسالة عربية ورابط واتساب قابلًا للفتح", () => {
    const message = buildWhatsAppReminderMessage("أحمد", dueDate, "before");
    const url = buildWhatsAppUrl("01008797774", message);
    expect(message).toContain("أحمد");
    expect(message).toContain("الصيانة الدورية");
    expect(url).toContain("https://wa.me/201008797774?text=");
    expect(url).toContain(encodeURIComponent("أحمد"));
  });
});
