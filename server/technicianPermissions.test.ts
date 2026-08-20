import { describe, expect, it } from "vitest";
import { parseTechnicianMenuPermissions } from "./routers/filterManagement";

describe("صلاحيات قوائم الفني", () => {
  it("تستخدم أوامر الشغل فقط عند غياب الإعداد", () => {
    expect(parseTechnicianMenuPermissions(null)).toEqual(["workOrders"]);
  });

  it("تحتفظ بالقوائم المسموح بها وتتجاهل القيم غير المعروفة", () => {
    expect(parseTechnicianMenuPermissions('["workOrders","customers","unknown","customers"]')).toEqual(["workOrders", "customers"]);
  });

  it("تعود للوضع الآمن إذا كانت القيمة غير صالحة", () => {
    expect(parseTechnicianMenuPermissions("not-json")).toEqual(["workOrders"]);
  });
});
