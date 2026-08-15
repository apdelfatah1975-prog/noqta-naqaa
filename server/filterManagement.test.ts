import { describe, expect, it, vi } from "vitest";
import { inventoryItems, inventoryMovements, reminders, visits } from "../drizzle/schema";
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
});
