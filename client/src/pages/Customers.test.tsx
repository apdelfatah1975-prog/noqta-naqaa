import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Customers, { addOrIncrementVisitItem, buildPartsConfirmation } from "./Customers";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  techniciansList: vi.fn(),
  createUseMutation: vi.fn(),
  visitUseMutation: vi.fn(),
  updateUseMutation: vi.fn(),
  deleteUseMutation: vi.fn(),
  deleteAllUseMutation: vi.fn(),
  importBulkUseMutation: vi.fn(),
  listInvalidate: vi.fn(),
  getInvalidate: vi.fn(),
  dashboardInvalidate: vi.fn(),
  remindersInvalidate: vi.fn(),
  inventoryInvalidate: vi.fn(),
  location: vi.fn(),
  updateOptions: null as null | { onSuccess?: () => void },
  visitOptions: null as null | { onSuccess?: (result: { reminderCreated?: boolean }) => void },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    filters: {
      customers: {
        list: { useQuery: mocks.list },
        create: { useMutation: mocks.createUseMutation },
        update: { useMutation: mocks.updateUseMutation },
        delete: { useMutation: mocks.deleteUseMutation },
        deleteAll: { useMutation: mocks.deleteAllUseMutation },
        importBulk: { useMutation: mocks.importBulkUseMutation },
      },
      technicians: { list: { useQuery: mocks.techniciansList } },
      visits: { create: { useMutation: mocks.visitUseMutation } },
      dashboard: { invalidate: mocks.dashboardInvalidate },
      reminders: { due: { invalidate: mocks.remindersInvalidate } },
      inventory: { summary: { invalidate: mocks.inventoryInvalidate } },
    },
    useUtils: () => ({
      filters: {
        customers: {
          list: { invalidate: mocks.listInvalidate },
          get: { invalidate: mocks.getInvalidate },
        },
        dashboard: { invalidate: mocks.dashboardInvalidate },
        reminders: { due: { invalidate: mocks.remindersInvalidate } },
        inventory: { summary: { invalidate: mocks.inventoryInvalidate } },
      },
    }),
  },
}));

vi.mock("wouter", () => ({ useLocation: () => ["/customers", mocks.location] }));

describe("ترابط تعديل بيانات العميل", () => {
  beforeEach(() => {
    mocks.list.mockReturnValue({
      data: [{ id: 12, name: "عميل قديم", phone: "01000000000", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000012", followUp: { nextVisitDate: new Date("2026-12-01T09:00:00Z"), lastServiceVisitDate: new Date("2026-08-01T09:00:00Z"), lastServiceVisitType: "maintenance", daysRemaining: 108 } }],
      isLoading: false,
      isError: false,
    });
    mocks.techniciansList.mockReturnValue({ data: [{ id: 7, name: "أحمد" }], isLoading: false, isError: false });
    mocks.createUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.visitUseMutation.mockImplementation((options: { onSuccess?: (result: { reminderCreated?: boolean }) => void }) => {
      mocks.visitOptions = options;
      return { mutate: vi.fn(), isPending: false };
    });
    mocks.deleteUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.deleteAllUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.importBulkUseMutation.mockReturnValue({ mutate: vi.fn(), isPending: false });
    mocks.updateUseMutation.mockImplementation((options: { onSuccess?: () => void }) => {
      mocks.updateOptions = options;
      return { mutate: vi.fn(), isPending: false };
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    mocks.updateOptions = null;
    mocks.visitOptions = null;
  });

  it("يعرض شارة موعد اليوم وشارة التأخر بوضوح", () => {
    mocks.list.mockReturnValue({
      data: [
        { id: 12, name: "عميل اليوم", phone: "01000000000", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000012", followUp: { nextVisitDate: new Date("2026-08-15T09:00:00Z"), daysRemaining: 0 } },
        { id: 13, name: "عميل متأخر", phone: "01000000001", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000013", followUp: { nextVisitDate: new Date("2026-08-10T09:00:00Z"), daysRemaining: -5 } },
        { id: 14, name: "عميل قريب", phone: "01000000002", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000014", followUp: { nextVisitDate: new Date("2026-08-18T09:00:00Z"), daysRemaining: 3 } },
        { id: 15, name: "عميل بعيد", phone: "01000000003", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000015", followUp: { nextVisitDate: new Date("2026-09-10T09:00:00Z"), daysRemaining: 26 } },
      ],
      isLoading: false,
      isError: false,
    });
    render(<Customers />);
    expect(screen.getByLabelText("فلترة حالة العميل: اليوم")).toBeTruthy();
    expect(screen.getByLabelText("فلترة حالة العميل: خلال ٥ أيام")).toBeTruthy();
    expect(screen.getByLabelText("فلترة حالة العميل: متأخر")).toBeTruthy();
  });

  it("يعرض قسم قطع الغيار المستخدمة داخل حوار تسجيل عميل جديد", () => {
    render(<Customers />);
    fireEvent.click(screen.getByRole("button", { name: "إضافة عميل" }));
    expect(screen.getByText("قطع الغيار والأصناف المستخدمة")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إضافة صنف" })).toBeTruthy();
  });

  it("يجمع عدة أصناف مختلفة داخل زيارة واحدة دون استبدال الصنف السابق", () => {
    const catalog = [
      { id: 1, name: "فلتر جامبو" },
      { id: 2, name: "قارورة" },
      { id: 3, name: "مبردة" },
    ];
    let items: Array<{ inventoryItemId: number; quantity: number; source: "default" | "manual" }> = [];
    for (const item of catalog) items = addOrIncrementVisitItem(items, item);
    expect(items).toEqual([
      { inventoryItemId: 1, quantity: 1, source: "manual" },
      { inventoryItemId: 2, quantity: 1, source: "manual" },
      { inventoryItemId: 3, quantity: 1, source: "manual" },
    ]);
    expect(addOrIncrementVisitItem(items, catalog[1], 2)).toEqual([
      { inventoryItemId: 1, quantity: 1, source: "manual" },
      { inventoryItemId: 2, quantity: 3, source: "manual" },
      { inventoryItemId: 3, quantity: 1, source: "manual" },
    ]);
  });

  it("يعرض اسم الصنف والكمية في رسالة تأكيد الخصم", () => {
    const confirmation = buildPartsConfirmation([{ inventoryItemId: 7, quantity: 2 }], [{ id: 7, name: "ممبرين" }]);
    expect(confirmation).toContain("ممبرين: 2");
    expect(confirmation).toContain("هل تريد حفظ الزيارة وخصم هذه الكميات من المخزن؟");
  });

  it("يفتح بطاقة تسجيل الزيارة مباشرة من بطاقة العميل ويُبقي السجل مستقلًا", () => {
    render(<Customers />);
    fireEvent.click(screen.getAllByRole("button", { name: "زيارة" })[0]);
    expect(screen.getByText("تسجيل زيارة جديدة")).toBeTruthy();
    expect(screen.getByText(/للعميل: عميل قديم/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));
    fireEvent.click(screen.getByRole("button", { name: "السجل" }));
    expect(mocks.location).toHaveBeenCalledWith("/customers/12");
  });


  it("يرسل الفني والمبلغ المحصل عند حفظ الزيارة", () => {
    const mutate = vi.fn();
    mocks.visitUseMutation.mockReturnValue({ mutate, isPending: false });
    render(<Customers />);
    fireEvent.click(screen.getAllByRole("button", { name: "زيارة" })[0]);
    fireEvent.change(screen.getByLabelText("اسم الفني"), { target: { value: "أحمد" } });
    fireEvent.change(screen.getByLabelText("نتيجة الزيارة"), { target: { value: "تم تغيير الشمعات" } });
    expect(screen.getByLabelText("اسم الفني")).toBeTruthy();
    expect(screen.getByLabelText("المبلغ المحصل")).toBeTruthy();
    expect(screen.queryByText(/ريال سعودي|ر\.س/)).toBeNull();
    fireEvent.change(screen.getByLabelText("المبلغ المحصل"), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "حفظ الزيارة" }));
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ customerId: 12, technicianName: "أحمد", visitResult: "تم تغيير الشمعات", collectedAmount: 250 }));
  });

  it("يحدّث ملخص المخزن بعد نجاح تسجيل الزيارة", () => {
    render(<Customers />);
    expect(mocks.visitOptions?.onSuccess).toBeTruthy();
    mocks.visitOptions?.onSuccess?.({ reminderCreated: false });
    expect(mocks.inventoryInvalidate).toHaveBeenCalled();
  });

  it("يرسل خيار الفرز حسب أقرب موعد إلى قائمة العملاء", () => {
    render(<Customers />);
    fireEvent.change(screen.getByLabelText("ترتيب العملاء"), { target: { value: "next_asc" } });
    const latestInput = mocks.list.mock.calls.at(-1)?.[0];
    expect(latestInput.sortBy).toBe("next_asc");
    expect(latestInput.followUpStatus).toBe("all");
  });

  it("يعرض إجمالي المحصل ويتيح ترتيب الأعلى تحصيلًا مع رأس جدول مثبت", () => {
    mocks.list.mockReturnValue({
      data: [
        { id: 12, name: "عميل قديم", phone: "01000000000", address: "العنوان", latitude: null, longitude: null, notes: null, customerCode: "C-000012", totalCollectedAmount: 1250, collectedAmount: 250, followUp: null },
      ],
      isLoading: false,
      isError: false,
    });
    render(<Customers />);
    expect(screen.getAllByText("إجمالي المحصل")[0]).toBeTruthy();
    expect(screen.getAllByText("١٬٢٥٠")[0]).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "إجمالي المحصل" }).className).toContain("sticky");
    fireEvent.change(screen.getByLabelText("ترتيب العملاء"), { target: { value: "collected_desc" } });
    expect(mocks.list.mock.calls.at(-1)?.[0].sortBy).toBe("collected_desc");
  });

  it("يعرض القائمة المحلية عند فشل الاتصال بالخادم", () => {
    localStorage.setItem("purepoint-offline-customers", JSON.stringify([
      { id: 44, manualCode: "٤٤", name: "عميل محفوظ محليًا", phone: "0500000000", address: "عنوان محلي", latitude: null, longitude: null, notes: null },
    ]));
    mocks.list.mockReturnValue({ data: undefined, isLoading: false, isError: true });

    render(<Customers />);

    expect(screen.getAllByText("عميل محفوظ محليًا")[0]).toBeTruthy();
    expect(screen.getByText(/تُعرض آخر قائمة عملاء محفوظة/)).toBeTruthy();
    localStorage.removeItem("purepoint-offline-customers");
  });

  it("يمسح الكود اليدوي عند اختيار التوليد التلقائي", () => {
    render(<Customers />);
    fireEvent.click(screen.getByText("إضافة عميل"));
    const codeInput = screen.getByPlaceholderText("مثال: ١٠٠ أو 100");
    fireEvent.change(codeInput, { target: { value: "١٠٠" } });
    expect((codeInput as HTMLInputElement).value).toBe("١٠٠");
    fireEvent.click(screen.getByRole("button", { name: "تلقائي" }));
    expect((codeInput as HTMLInputElement).value).toBe("");
    expect(screen.getByText("سيُنشأ تلقائيًا بعد الحفظ")).toBeTruthy();
  });

  it("يسمح بتعديل تاريخ ووقت الخدمة ويرسلهما مع حفظ العميل", () => {
    const updateMutation = vi.fn();
    mocks.updateUseMutation.mockReturnValue({ mutate: updateMutation, isPending: false });
    render(<Customers />);
    fireEvent.click(screen.getByTitle("تعديل"));
    const dateInput = screen.getByDisplayValue("2026-08-01T09:00");
    fireEvent.change(dateInput, { target: { value: "2026-08-05T14:30" } });
    const amountInput = screen.getByPlaceholderText("مثال: 250");
    expect((amountInput as HTMLInputElement).disabled).toBe(false);
    fireEvent.change(amountInput, { target: { value: "275" } });
    fireEvent.submit(screen.getByText("حفظ البيانات").closest("form")!);
    fireEvent.change(screen.getByPlaceholderText("••••"), { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: "تأكيد" }));
    expect(updateMutation).toHaveBeenCalledWith(expect.objectContaining({ serviceDate: expect.any(Date), collectedAmount: 275 }));
    expect(screen.queryByText("عملة التحصيل")).toBeNull();
    expect((updateMutation.mock.calls[0][0].serviceDate as Date).toISOString()).toBe("2026-08-05T14:30:00.000Z");
  });

  it("يعيد جلب القائمة والملف واللوحة والتذكيرات بعد حفظ تعديل العميل", () => {
    render(<Customers />);
    fireEvent.click(screen.getByTitle("تعديل"));
    fireEvent.change(screen.getByDisplayValue("عميل قديم"), { target: { value: "عميل محدث" } });
    const form = screen.getByText("حفظ البيانات").closest("form");
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    mocks.updateOptions?.onSuccess?.();

    expect(mocks.listInvalidate).toHaveBeenCalled();
    expect(mocks.getInvalidate).toHaveBeenCalled();
    expect(mocks.dashboardInvalidate).toHaveBeenCalled();
    expect(mocks.remindersInvalidate).toHaveBeenCalled();
  });

  it("يبرز بطاقة الكل النشطة بإطار واضح عند فتح صفحة العملاء", () => {
    render(<Customers />);
    const allFilter = screen.getByRole("button", { name: /فلترة حالة العميل: الكل/ });
    expect(allFilter.getAttribute("aria-pressed")).toBe("true");
    expect(allFilter.className).toContain("ring-2");
    expect(allFilter.className).toContain("shadow-sm");
  });

  it("يستخدم كل العملاء كحالة افتراضية بعد إزالة الفلتر السريع", () => {
    render(<Customers />);
    const latestInput = mocks.list.mock.calls.at(-1)?.[0];
    expect(latestInput.followUpStatus).toBe("all");
  });

  it("يعرض بطاقات الحالات الأربع بجوار البحث", () => {
    mocks.list.mockReturnValue({
      data: [
        { id: 12, name: "عميل متأخر", phone: "01000000000", address: "العنوان", customerCode: "C-000012", followUp: { nextVisitDate: new Date("2026-08-10T09:00:00Z"), daysRemaining: -2 } },
        { id: 13, name: "عميل اليوم", phone: "01000000001", address: "العنوان", customerCode: "C-000013", followUp: { nextVisitDate: new Date("2026-08-17T09:00:00Z"), daysRemaining: 0 } },
        { id: 14, name: "عميل قريب", phone: "01000000002", address: "العنوان", customerCode: "C-000014", followUp: { nextVisitDate: new Date("2026-08-20T09:00:00Z"), daysRemaining: 3 } },
        { id: 15, name: "عميل منتظم", phone: "01000000003", address: "العنوان", customerCode: "C-000015", followUp: { nextVisitDate: new Date("2026-09-10T09:00:00Z"), daysRemaining: 26 } },
      ],
      isLoading: false,
      isError: false,
    });
    render(<Customers />);
    expect(screen.getByRole("button", { name: /فلترة حالة العميل: الكل/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /فلترة حالة العميل: متأخر/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /فلترة حالة العميل: اليوم/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /فلترة حالة العميل: خلال ٥ أيام/ })).toBeTruthy();
  });

  it("يمنع إضافة كمية تتجاوز الرصيد المتاح للصنف", () => {
    const item = { id: 41, name: "فلتر جامبو", currentBalance: 2 };
    const selected = addOrIncrementVisitItem([], item, 2);
    expect(selected).toEqual([{ inventoryItemId: 41, quantity: 2, source: "manual" }]);
    expect(addOrIncrementVisitItem(selected, item, 1)).toEqual(selected);
  });

  it("لا يضيف صنفًا عندما يكون رصيده صفرًا", () => {
    const item = { id: 42, name: "فلتر جامبو", currentBalance: 0 };
    expect(addOrIncrementVisitItem([], item, 1)).toEqual([]);
  });

  it("يبحث عن العميل بالاسم أو الهاتف أو الكود قبل فتح بطاقة الزيارة", () => {
    mocks.list.mockReturnValue({
      data: [
        { id: 12, name: "عميل قديم", phone: "01000000000", address: "العنوان", customerCode: "C-000012", followUp: null },
        { id: 13, name: "عميل آخر", phone: "0501234567", address: "عنوان آخر", customerCode: "C-000013", followUp: null },
      ],
      isLoading: false,
      isError: false,
    });
    render(<Customers />);
    fireEvent.click(screen.getByRole("button", { name: "تسجيل زيارة" }));
    const searchInput = screen.getByPlaceholderText("اكتب الاسم أو الهاتف أو كود العميل");
    fireEvent.change(searchInput, { target: { value: "0501234567" } });
    const customerOption = screen.getByRole("option", { name: /عميل آخر/ });
    expect(customerOption).toBeTruthy();
    fireEvent.click(customerOption);
    expect(screen.getByText(/للعميل: عميل آخر/)).toBeTruthy();
  });

  it("يفعّل فلتر الحالة عند النقر على أيقونة العميل", () => {
    mocks.list.mockReturnValue({
      data: [
        { id: 12, name: "عميل متأخر", phone: "01000000000", address: "العنوان", customerCode: "C-000012", followUp: { nextVisitDate: new Date("2026-08-10T09:00:00Z"), daysRemaining: -2 } },
        { id: 13, name: "عميل منتظم", phone: "01000000001", address: "العنوان", customerCode: "C-000013", followUp: { nextVisitDate: new Date("2026-09-10T09:00:00Z"), daysRemaining: 26 } },
      ],
      isLoading: false,
      isError: false,
    });
    render(<Customers />);
    fireEvent.click(screen.getByLabelText("فلترة حالة العميل: متأخر"));
    expect(screen.getByText("العملاء المتأخرون: 2")).toBeTruthy();
    expect(mocks.list.mock.calls.some(([input]) => input.followUpStatus === "overdue")).toBe(true);
  });
});

export {};

