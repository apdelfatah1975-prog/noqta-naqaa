import { describe, expect, it } from "vitest";
import { buildWhatsAppBulkReminderMessage, buildWhatsAppShareUrl } from "./filterUi";

describe("bulk WhatsApp reminders", () => {
  it("builds a reviewable message for selected due customers", () => {
    const message = buildWhatsAppBulkReminderMessage([
      { customerName: "أحمد علي", reminderDate: "2026-08-20T00:00:00.000Z" },
      { customerName: "سارة محمد", reminderDate: "2026-08-21T00:00:00.000Z" },
    ]);

    expect(message).toContain("أحمد علي");
    expect(message).toContain("سارة محمد");
    expect(message).toContain("شركة نقطة نقاء");
    expect(buildWhatsAppShareUrl(message)).toContain("https://wa.me/?text=");
  });
});
