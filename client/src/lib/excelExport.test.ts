import { describe, expect, it } from "vitest";
import { cleanExcelCell, localizeExcelRows, parseCustomerClipboard } from "./excelExport";

describe("parseCustomerClipboard", () => {
  it("reads pasted Arabic Excel rows and calculates follow-up dates", () => {
    const pasted = [
      "كود العميل\tاسم العميل\tالهاتف\tالعنوان\tالفني\tتاريخ الزيارة\tنوع الزيارة\tالمبلغ",
      "1001\tأحمد علي\t0500000001\tالرياض\tمحمد\t2026-01-01\tصيانة\t250",
      "1002\tسارة حسن\t0500000002\tجدة\tخالد\t2026-02-15\tتركيب فلتر\t400",
      "1003\tعميل ثالث\t0500000003\tالدمام\t\t\t\t",
    ].join("\n");

    const result = parseCustomerClipboard(pasted);

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({ name: "أحمد علي", phone: "0500000001", visitType: "maintenance", collectedAmount: 250 });
    expect(result.rows[0].nextVisitDate).toBeTruthy();
    expect(result.rows[1].visitType).toBe("installation");
    expect(result.rows[2].name).toBe("عميل ثالث");
  });

  it("returns a clear error when required headers are missing", () => {
    const result = parseCustomerClipboard("العنوان\tالملاحظات\nالرياض\tبدون بيانات أساسية");
    expect(result.rows).toHaveLength(0);
    expect(result.issues[0].reason).toContain("اسم العميل والهاتف");
  });
});

describe("تنظيف Excel", () => {
  it("يحوّل null-like إلى خلايا فارغة ويحافظ على الصفر", () => {
    expect(cleanExcelCell(null)).toBe("");
    expect(cleanExcelCell(" undefined ")).toBe("");
    expect(cleanExcelCell("N/A")).toBe("");
    expect(cleanExcelCell(0)).toBe(0);
    expect(localizeExcelRows([{ notes: null, tdsIn: undefined, amount: 0 }])).toEqual([{ notes: "", tdsIn: "", amount: 0 }]);
  });
});
