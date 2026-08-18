import { describe, expect, it } from "vitest";
import { hashPin, verifyPin } from "./routers/filterManagement";

describe("تسجيل دخول الفني الداخلي", () => {
  it("يخزن كلمة السر كتجزئة مع salt مختلفة ويقبل الأصل فقط", async () => {
    const first = await hashPin("Technician-1234");
    const second = await hashPin("Technician-1234");

    expect(first).not.toBe("Technician-1234");
    expect(second).not.toBe(first);
    await expect(verifyPin("Technician-1234", first)).resolves.toBe(true);
    await expect(verifyPin("wrong-password", first)).resolves.toBe(false);
  });

  it("يرفض قيمة التجزئة غير الصالحة دون رمي خطأ", async () => {
    await expect(verifyPin("Technician-1234", "invalid-hash")).resolves.toBe(false);
  });
});
