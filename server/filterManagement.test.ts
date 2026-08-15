import { describe, expect, it, vi } from "vitest";
import { cashTransactions, customers, inventoryItems, inventoryMovements, notificationSettings, reminders, visits } from "../drizzle/schema";
import { appRouter } from "./routers";
import { getDb } from "./db";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", () => ({ getDb: vi.fn() }));

function createContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      name: "مدير الاختبار",
      email: "test@example.com",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("واجهات إدارة فلاتر المياه", () => {
  it("ينشئ تذكيرًا بعد 120 يومًا عند تسجيل تركيب أو صيانة فقط", async () => {
    const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const reminderUpdates: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [{ id: 7, ownerId: 1, name: "عميل اختبار" }] }),
        }),
      }),
      insert: (table: unknown) => ({
        values: async (values: Record<string, unknown>) => {
          insertCalls.push({ table, values });
          return [{ insertId: table === visits ? 55 : 0 }];
        },
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => { reminderUpdates.push({ table, values }); },
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());
    const visitDate = new Date("2026-01-01T09:00:00.000Z");

    await expect(caller.filters.visits.create({ customerId: 7, visitType: "installation", visitDate }))
      .resolves.toMatchObject({ id: 55, reminderCreated: true });
    await expect(caller.filters.visits.create({ customerId: 7, visitType: "maintenance", visitDate }))
      .resolves.toMatchObject({ id: 55, reminderCreated: true });
    await expect(caller.filters.visits.create({ customerId: 7, visitType: "cartridge_change", visitDate }))
      .resolves.toMatchObject({ id: 55, reminderCreated: false });

    const reminderCalls = insertCalls.filter(call => call.table === reminders);
    expect(reminderCalls).toHaveLength(2);
    expect(reminderCalls.every(call => call.values.visitId === 55)).toBe(true);
    expect(reminderCalls.every(call => (call.values.reminderDate as Date).toISOString() === "2026-05-01T09:00:00.000Z")).toBe(true);
    expect(reminderUpdates).toEqual([
      { table: reminders, values: { status: "completed" } },
      { table: reminders, values: { status: "completed" } },
      { table: reminders, values: { status: "completed" } },
    ]);
  });

  it("يعيد ملف العميل بملخص متابعة موحد بعد تسجيل زيارة تركيب", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T09:00:00.000Z"));
    const installationVisit = { id: 55, ownerId: 1, customerId: 7, visitType: "installation" as const, visitDate: new Date("2026-01-01T09:00:00.000Z") };
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === customers) return { limit: async () => [{ id: 7, ownerId: 1, name: "عميل اختبار" }] };
            if (table === visits) return { orderBy: async () => [installationVisit] };
            if (table === reminders) return { orderBy: async () => [] };
            return [];
          },
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    try {
      await expect(caller.filters.customers.get({ id: 7 })).resolves.toMatchObject({
        customer: {
          id: 7,
          customerCode: "١",
          followUp: {
            lastServiceVisitType: "installation",
            nextVisitDate: new Date("2026-05-01T09:00:00.000Z"),
            daysRemaining: 0,
          },
        },
        visits: [installationVisit],
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("يعيد قائمة العملاء بكود العميل وملخص الموعد المشتق من آخر خدمة", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T09:00:00.000Z"));
    const installationVisit = { id: 55, ownerId: 1, customerId: 7, visitType: "installation" as const, visitDate: new Date("2026-01-01T09:00:00.000Z") };
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === customers) return { orderBy: async () => [{ id: 7, ownerId: 1, name: "عميل اختبار" }] };
            if (table === visits) return { orderBy: async () => [installationVisit] };
            return [];
          },
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);

    try {
      await expect(appRouter.createCaller(createContext()).filters.customers.list({})).resolves.toMatchObject([{
        id: 7,
        customerCode: "١",
        followUp: { nextVisitDate: new Date("2026-05-01T09:00:00.000Z"), daysRemaining: 0 },
      }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("يفلتر العملاء حسب حالة وموعد المتابعة", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-01T09:00:00.000Z"));
    const customersRows = [
      { id: 7, ownerId: 1, name: "عميل بموعد", phone: "01000000000", address: null, latitude: null, longitude: null, notes: null },
      { id: 8, ownerId: 1, name: "عميل بلا موعد", phone: "01111111111", address: null, latitude: null, longitude: null, notes: null },
    ];
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === customers) return { orderBy: async () => customersRows };
            if (table === visits) return { orderBy: async () => [{ id: 55, ownerId: 1, customerId: 7, visitType: "installation" as const, visitDate: new Date("2026-01-01T09:00:00.000Z") }] };
            return [];
          },
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());
    try {
      await expect(caller.filters.customers.list({ followUpStatus: "today" })).resolves.toHaveLength(1);
      await expect(caller.filters.customers.list({ followUpStatus: "none" })).resolves.toMatchObject([{ id: 8 }]);
      await expect(caller.filters.customers.list({ followUpDate: "2026-05-01" })).resolves.toMatchObject([{ id: 7 }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("يعيد التذكير المستحق بآخر خدمة وأيام التأخر والعميل المرتبط", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T09:00:00.000Z"));
    const installationVisit = { id: 55, ownerId: 1, customerId: 7, visitType: "installation" as const, visitDate: new Date("2026-01-01T09:00:00.000Z") };
    const dueReminder = { id: 14, ownerId: 1, customerId: 7, visitId: 55, status: "pending" as const, reminderDate: new Date("2026-05-01T09:00:00.000Z") };
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === reminders) return { orderBy: async () => [dueReminder] };
            if (table === customers) return [{ id: 7, ownerId: 1, name: "عميل اختبار" }];
            if (table === visits) return [installationVisit];
            return [];
          },
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);

    try {
      await expect(appRouter.createCaller(createContext()).filters.reminders.due()).resolves.toMatchObject([{
        id: 14,
        lastServiceVisitType: "installation",
        lastServiceVisitDate: installationVisit.visitDate,
        daysOverdue: 1,
        customer: { customerCode: "١", followUp: { nextVisitDate: dueReminder.reminderDate, daysRemaining: -1 } },
      }]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("ينشر تعديل بيانات العميل فعليًا في القائمة وملفه", async () => {
    const customer = { id: 7, ownerId: 1, name: "قبل التعديل", phone: "01000000000", address: "العنوان القديم", latitude: null, longitude: null, notes: null };
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === customers) return { limit: async () => [customer], orderBy: async () => [customer] };
            if (table === visits) return { orderBy: async () => [] };
            if (table === reminders) return { orderBy: async () => [] };
            return [];
          },
        }),
      }),
      update: (_table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => {
            Object.assign(customer, values);
          },
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    await caller.filters.customers.update({ id: 7, name: "بعد التعديل", phone: "01111111111", address: "العنوان الجديد", latitude: null, longitude: null, notes: "ملاحظة جديدة" });

    await expect(caller.filters.customers.list({})).resolves.toMatchObject([{
      id: 7,
      name: "بعد التعديل",
      phone: "01111111111",
      address: "العنوان الجديد",
    }]);
    await expect(caller.filters.customers.get({ id: 7 })).resolves.toMatchObject({
      customer: {
        name: "بعد التعديل",
        phone: "01111111111",
        address: "العنوان الجديد",
      },
    });
  });

  it("ينشر تعديل العميل إلى التذكيرات ولوحة التحكم من المصدر نفسه", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T09:00:00.000Z"));
    const customer = { id: 7, ownerId: 1, name: "قبل التعديل", phone: "01000000000", address: "العنوان القديم", latitude: null, longitude: null, notes: null };
    const upcomingVisit = { id: 55, ownerId: 1, customerId: 7, visitType: "maintenance" as const, visitDate: new Date("2026-05-03T09:00:00.000Z") };
    const dueReminder = { id: 14, ownerId: 1, customerId: 7, visitId: 55, status: "pending" as const, alertedAt: null, reminderDate: new Date("2026-05-01T09:00:00.000Z") };
    const chain = (rows: unknown[]) => {
      const query = {
        orderBy: () => query,
        limit: () => query,
        then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      };
      return query;
    };
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === customers) return chain([customer]);
            if (table === visits) return chain([upcomingVisit]);
            if (table === reminders) return chain([dueReminder]);
            if (table === inventoryItems || table === inventoryMovements || table === cashTransactions) return chain([]);
            return chain([]);
          },
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => ({
          where: async () => { Object.assign(customer, values); },
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    try {
      await caller.filters.customers.update({ id: 7, name: "بعد التعديل", phone: "01111111111", address: "العنوان الجديد", latitude: null, longitude: null, notes: "ملاحظة جديدة" });
      const dashboard = await caller.filters.dashboard();
      expect(dashboard.dueReminders[0]?.customer).toMatchObject({ name: "بعد التعديل", phone: "01111111111", address: "العنوان الجديد" });
      expect(dashboard.upcomingVisits[0]?.customer).toMatchObject({ name: "بعد التعديل", phone: "01111111111", address: "العنوان الجديد" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("يوقف ظهور التذكير في التنبيهات بعد تسجيل زيارة للعميل", async () => {
    let reminderStatus = "pending";
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === customers) return { limit: async () => [{ id: 7, ownerId: 1, name: "عميل اختبار" }] };
            if (table === notificationSettings) return { limit: async () => [{ ownerId: 1, leadDays: 1, alertHour: 9, alertMinute: 0, timezoneOffsetMinutes: 0, scheduleCronTaskUid: null }] };
            if (table === reminders) return { orderBy: async () => reminderStatus === "pending" ? [{ id: 14, ownerId: 1, customerId: 7, status: "pending", alertedAt: null, reminderDate: new Date("2026-01-01T09:00:00.000Z") }] : [] };
            return [];
          },
        }),
      }),
      insert: () => ({ values: async () => [{ insertId: 71 }] }),
      update: () => ({
        set: (values: { status: string }) => ({
          where: async () => { reminderStatus = values.status; },
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    await caller.filters.visits.create({ customerId: 7, visitType: "follow_up", visitDate: new Date("2026-01-02T09:00:00.000Z") });
    await expect(caller.filters.reminders.alerts()).resolves.toEqual([]);
  });

  it("لا ينشئ زيارة مكررة عند إعادة مزامنة معرف العملية نفسه", async () => {
    const insert = vi.fn();
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () => table === visits
            ? { limit: async () => [{ id: 99, ownerId: 1, visitType: "maintenance" }] }
            : { limit: async () => [] },
        }),
      }),
      insert,
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.filters.visits.create({
      customerId: 7,
      visitType: "maintenance",
      visitDate: new Date("2026-01-02T09:00:00.000Z"),
      clientOperationId: "26c4b0f0-e34e-4a89-8d6f-4dbdfd34403e",
    })).resolves.toEqual({ id: 99, reminderCreated: true, alreadySynced: true });

    expect(insert).not.toHaveBeenCalled();
  });

  it("يرفض صرف المخزون عندما لا يكفي الرصيد", async () => {
    const db = {
      select: () => ({
        from: (table: unknown) => ({
          where: () =>
            table === inventoryItems
              ? { limit: async () => [{ id: 7, ownerId: 1, openingQuantity: 3 }] }
              : [{ inventoryItemId: 7, movementType: "outgoing", quantity: 1 }],
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.filters.inventory.createMovement({
      inventoryItemId: 7,
      movementType: "outgoing",
      quantity: 3,
      movementDate: new Date(),
    })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("يعيد خطأ عدم العثور عند تحديث تذكير غير موجود", async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({ limit: async () => [] }),
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.filters.reminders.updateStatus({ id: 404, status: "completed" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("يمنع تحديث تذكير مملوك لمستخدم آخر", async () => {
    const otherOwnersReminder = { id: 19, ownerId: 2, status: "pending" };
    const db = {
      select: () => ({
        from: () => ({
          // الاستعلام يقيّد النتيجة بـ ownerId للمستخدم الحالي، لذا لا يظهر تذكير المستخدم الآخر.
          where: () => ({ limit: async () => otherOwnersReminder.ownerId === 1 ? [otherOwnersReminder] : [] }),
        }),
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.filters.reminders.updateStatus({ id: 19, status: "dismissed" }))
      .rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("يسجل المبلغ المحصل من الزيارة كإيراد مرتبط بها وبالعملة المختارة", async () => {
    const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const customer = { id: 7, ownerId: 1, name: "عميل التحصيل" };
    const db = {
      select: () => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => table === customers ? [customer] : [] }) }) }),
      insert: (table: unknown) => ({ values: async (values: Record<string, unknown>) => { insertCalls.push({ table, values }); return [{ insertId: table === visits ? 123 : 456 }]; } }),
      update: () => ({ set: () => ({ where: async () => undefined }) }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.filters.visits.create({
      customerId: 7,
      visitType: "follow_up",
      visitDate: new Date("2026-08-15T09:00:00.000Z"),
      collectedAmount: 27500,
      collectedCurrency: "SAR",
    })).resolves.toEqual({ id: 123, reminderCreated: false, alreadySynced: false });

    expect(insertCalls).toEqual(expect.arrayContaining([
      expect.objectContaining({ table: cashTransactions, values: expect.objectContaining({ ownerId: 1, transactionType: "income", amount: 27500, currency: "SAR", sourceVisitId: 123, recipientName: "عميل التحصيل" }) }),
    ]));
  });

  it("يسجل عملية خزينة ضمن مالك الحساب الحالي", async () => {
    const insertCalls: Array<{ table: unknown; values: Record<string, unknown> }> = [];
    const db = {
      insert: (table: unknown) => ({
        values: async (values: Record<string, unknown>) => {
          insertCalls.push({ table, values });
          return [{ insertId: 91 }];
        },
      }),
    };
    vi.mocked(getDb).mockResolvedValue(db as never);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.filters.cash.create({
      transactionType: "expense",
      amount: 350,
      category: "مستلزمات تشغيل",
      transactionDate: new Date("2026-08-15T09:00:00.000Z"),
      recipientName: "فني الصيانة",
    })).resolves.toEqual({ id: 91 });

		expect(insertCalls).toEqual([expect.objectContaining({
			table: cashTransactions,
			values: expect.objectContaining({ ownerId: 1, amount: 350, transactionType: "expense" }),
		})]);
	});

	it("يعيد حساب وقت الإشعار القادم فور حفظ وقت تنبيه جديد", async () => {
		let savedSettings = {
			ownerId: 1,
			leadDays: 1,
			alertHour: 9,
			alertMinute: 0,
			timezoneOffsetMinutes: 180,
			scheduleCronTaskUid: null,
		};
		const pendingReminder = {
			id: 23,
			ownerId: 1,
			customerId: 7,
			status: "pending" as const,
			alertedAt: null,
			reminderDate: new Date("2026-05-10T21:00:00.000Z"),
		};
		const db = {
			select: () => ({
				from: (table: unknown) => ({
					where: () => {
						if (table === notificationSettings) return { limit: async () => [savedSettings] };
						if (table === reminders) return { orderBy: async () => [pendingReminder] };
						if (table === customers) return [{ id: 7, ownerId: 1, name: "عميل الاختبار" }];
						return [];
					},
				}),
			}),
			insert: () => ({
				values: (values: Record<string, unknown>) => ({
					onDuplicateKeyUpdate: async () => {
						savedSettings = { ...savedSettings, ...values } as typeof savedSettings;
					},
				}),
			}),
		};
		vi.mocked(getDb).mockResolvedValue(db as never);
		const caller = appRouter.createCaller(createContext());

		const beforeSave = await caller.filters.notifications.nextAlert();
		expect(beforeSave?.alertDate.toISOString()).toBe("2026-05-10T06:00:00.000Z");

		await caller.filters.notifications.saveSettings({
			leadDays: 1,
			alertHour: 14,
			alertMinute: 30,
			timezoneOffsetMinutes: 180,
		});

		const afterSave = await caller.filters.notifications.nextAlert();
		expect(afterSave?.alertDate.toISOString()).toBe("2026-05-10T11:30:00.000Z");
	});

	it("يوفر التذكير المستحق والقريب للمصادر التي يعرضها بانر لوحة التحكم", async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-08-15T12:00:00.000Z"));
		const dueReminder = {
			id: 81,
			ownerId: 1,
			customerId: 7,
			status: "pending" as const,
			alertedAt: null,
			reminderDate: new Date("2026-08-14T12:00:00.000Z"),
		};
		const upcomingReminder = {
			id: 82,
			ownerId: 1,
			customerId: 7,
			status: "pending" as const,
			alertedAt: null,
			reminderDate: new Date("2026-08-16T15:00:00.000Z"),
		};
		let reminderQueryCount = 0;
		const db = {
			select: () => ({
				from: (table: unknown) => ({
					where: () => {
						if (table === notificationSettings) {
							return { limit: async () => [{ ownerId: 1, leadDays: 1, alertHour: 9, alertMinute: 0, timezoneOffsetMinutes: 0, scheduleCronTaskUid: null }] };
						}
						if (table === reminders) {
							const rows = reminderQueryCount++ === 0 ? [dueReminder] : [upcomingReminder];
							return { orderBy: async () => rows };
						}
						if (table === customers) return [{ id: 7, ownerId: 1, name: "عميل الاختبار" }];
						return [];
					},
				}),
			}),
		};
		vi.mocked(getDb).mockResolvedValue(db as never);
		const caller = appRouter.createCaller(createContext());

		try {
			await expect(caller.filters.reminders.due()).resolves.toMatchObject([{ id: 81 }]);
			await expect(caller.filters.reminders.alerts()).resolves.toMatchObject([{ id: 82, alertDate: new Date("2026-08-15T09:00:00.000Z") }]);
		} finally {
			vi.useRealTimers();
		}
	});
});


describe("صلاحيات الفني والإدارة", () => {
  function createTechnicianContext(): TrpcContext {
    return {
      ...createContext(),
      user: { ...createContext().user!, role: "user" },
    };
  }

  it("يمنع الفني من قراءة وتعديل المخزن والخزينة", async () => {
    const caller = appRouter.createCaller(createTechnicianContext());
    await expect(caller.filters.inventory.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.filters.cash.summary()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.filters.inventory.createItem({ name: "صنف فني", openingQuantity: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(caller.filters.cash.create({
      transactionType: "expense",
      amount: 1000,
      category: "مصروف",
      transactionDate: new Date("2026-08-15T09:00:00.000Z"),
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
