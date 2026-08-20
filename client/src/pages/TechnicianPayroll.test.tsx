import { describe, expect, it } from "vitest";
import { buildTechnicianMonthlyReportRows, calculateSalesAgentCommission, calculateTechnicianCommission, formatPayrollMoney, monthBounds, updateTechnicianProfile, upsertTechnicianProfile } from "./TechnicianPayroll";

describe("TechnicianPayroll", () => {
  it("يحسب بداية ونهاية الشهر المحدد", () => {
    expect(monthBounds("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("يحسب عمولة التركيب والصيانة تلقائيًا ولا يحسب للخدمات الأخرى", () => {
    expect(calculateTechnicianCommission(10000, "installation", 10, 5)).toBe(1000);
    expect(calculateTechnicianCommission(10000, "maintenance", 10, 5)).toBe(500);
    expect(calculateTechnicianCommission(10000, "follow_up", 10, 5)).toBe(0);
    expect(calculateTechnicianCommission(10000, "installation", 0, 5)).toBe(0);
  });

  it("يحسب عمولة متابع العملاء حسب الفلتر أو المجموعة ويعرض الريال بلا كسور", () => {
    expect(calculateSalesAgentCommission(7, { commissionMode: "per_filter", commissionValue: 15, filtersPerGroup: 10 })).toBe(105);
    expect(calculateSalesAgentCommission(27, { commissionMode: "per_group", commissionValue: 500, filtersPerGroup: 10 })).toBe(1000);
    expect(formatPayrollMoney(250)).toBe("٢٥٠");
  });

  it("يضيف فنيًا جديدًا بإعدادات صفرية ويمنع التكرار", () => {
    const first = upsertTechnicianProfile({}, "  أحمد  ");
    expect(first).toEqual({ أحمد: { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0, phone: "" } });
    expect(upsertTechnicianProfile(first, "أحمد")).toBe(first);
  });

  it("يحدّث راتب الفني ونسبه ضمن الحدود الآمنة", () => {
    const payroll = { أحمد: { monthlySalary: 0, installationPercent: 0, maintenancePercent: 0 } };
    expect(updateTechnicianProfile(payroll, "أحمد", "monthlySalary", 250000)).toEqual({ أحمد: { monthlySalary: 250000, installationPercent: 0, maintenancePercent: 0 } });
    expect(updateTechnicianProfile(payroll, "أحمد", "installationPercent", 150).أحمد.installationPercent).toBe(100);
    expect(updateTechnicianProfile(payroll, "أحمد", "maintenancePercent", -5).أحمد.maintenancePercent).toBe(0);
  });

  it("يعتبر الدفعة الموحدة للفني مدفوعًا من حساب الراتب", () => {
    const rows = buildTechnicianMonthlyReportRows({
      technician: "أحمد",
      required: 500,
      paid: 200,
      remaining: 300,
      status: "remaining",
      transactions: [{ id: 2, transactionType: "expense", amount: 200, category: "دفعة راتب فني", transactionDate: "2026-08-05", recipientName: "أحمد", notes: "مبلغ مستلم" }],
    });
    expect(rows[0]).toMatchObject({ النوع: "مدفوع", التصنيف: "دفعة راتب فني", المبلغ: "٢٠٠" });
  });

  it("يجهز صفوف التقرير الشهري بالعربية مع النوع والملاحظات", () => {
    const rows = buildTechnicianMonthlyReportRows({
      technician: "أحمد",
      required: 500,
      paid: 200,
      remaining: 300,
      status: "remaining",
      transactions: [{ id: 1, transactionType: "expense", amount: 200, category: "راتب فني", transactionDate: "2026-08-05", recipientName: "أحمد", notes: "دفعة شهر أغسطس" }],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ النوع: "مدفوع", التصنيف: "راتب فني", المبلغ: "٢٠٠" });
    expect(rows[0].الملاحظات).toBe("دفعة شهر أغسطس");
  });
});
