import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, inArray, like, lte } from "drizzle-orm";
import { z } from "zod";
import {
  customers,
  inventoryItems,
  inventoryMovements,
  reminders,
  visits,
} from "../../drizzle/schema";
import {
  calculateStockBalance,
  followUpDate,
  needsAutomaticReminder,
  visitTypes,
} from "../../shared/filterBusiness";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const customerInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم العميل").max(160),
  phone: z.string().trim().min(6, "أدخل رقم هاتف صحيح").max(32),
  address: z.string().trim().max(1000).optional().nullable(),
  latitude: z.string().trim().max(32).optional().nullable(),
  longitude: z.string().trim().max(32).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const visitInput = z.object({
  customerId: z.number().int().positive(),
  visitType: z.enum(visitTypes),
  visitDate: z.date(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const inventoryItemInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم الصنف").max(160),
  openingQuantity: z.number().int().min(0).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const inventoryMovementInput = z.object({
  inventoryItemId: z.number().int().positive(),
  movementType: z.enum(["incoming", "outgoing"]),
  quantity: z.number().int().positive("أدخل كمية أكبر من صفر"),
  movementDate: z.date(),
  technicianName: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الاتصال بقاعدة البيانات." });
  }
  return db;
}

async function getOwnedCustomer(ownerId: number, customerId: number) {
  const db = await databaseOrThrow();
  const customer = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.ownerId, ownerId)))
    .limit(1);
  if (!customer[0]) {
    throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على العميل." });
  }
  return customer[0];
}

async function inventorySummary(ownerId: number) {
  const db = await databaseOrThrow();
  const items = await db.select().from(inventoryItems).where(eq(inventoryItems.ownerId, ownerId)).orderBy(desc(inventoryItems.createdAt));
  if (items.length === 0) return { items: [], movements: [] };
  const itemIds = items.map(item => item.id);
  const movements = await db
    .select()
    .from(inventoryMovements)
    .where(and(eq(inventoryMovements.ownerId, ownerId), inArray(inventoryMovements.inventoryItemId, itemIds)))
    .orderBy(desc(inventoryMovements.movementDate));
  const itemBalances = items.map(item => ({
    ...item,
    currentBalance: calculateStockBalance(
      item.openingQuantity,
      movements.filter(movement => movement.inventoryItemId === item.id),
    ),
  }));
  return { items: itemBalances, movements };
}

async function remindersWithCustomers(ownerId: number, onlyDue: boolean) {
  const db = await databaseOrThrow();
  const filters = [eq(reminders.ownerId, ownerId), eq(reminders.status, "pending")];
  if (onlyDue) filters.push(lte(reminders.reminderDate, new Date()));
  const rows = await db.select().from(reminders).where(and(...filters)).orderBy(reminders.reminderDate);
  if (rows.length === 0) return [];
  const customerIds = Array.from(new Set(rows.map(row => row.customerId)));
  const customerRows = await db.select().from(customers).where(and(eq(customers.ownerId, ownerId), inArray(customers.id, customerIds)));
  const customerById = new Map(customerRows.map(customer => [customer.id, customer]));
  return rows.map(reminder => ({ ...reminder, customer: customerById.get(reminder.customerId) ?? null }));
}

export const filterManagementRouter = router({
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    const db = await databaseOrThrow();
    const ownerId = ctx.user.id;
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(startOfToday);
    endOfToday.setDate(endOfToday.getDate() + 1);
    const [todayVisits, upcomingVisits, dueReminders, inventory] = await Promise.all([
      db.select().from(visits).where(and(eq(visits.ownerId, ownerId), gte(visits.visitDate, startOfToday), lte(visits.visitDate, endOfToday))).orderBy(visits.visitDate),
      db.select().from(visits).where(and(eq(visits.ownerId, ownerId), gte(visits.visitDate, now))).orderBy(visits.visitDate).limit(5),
      remindersWithCustomers(ownerId, true),
      inventorySummary(ownerId),
    ]);
    const visitCustomerIds = Array.from(new Set([...todayVisits, ...upcomingVisits].map(visit => visit.customerId)));
    const visitCustomers = visitCustomerIds.length
      ? await db.select().from(customers).where(and(eq(customers.ownerId, ownerId), inArray(customers.id, visitCustomerIds)))
      : [];
    const customerById = new Map(visitCustomers.map(customer => [customer.id, customer]));
    const lowStock = inventory.items.filter(item => item.currentBalance <= 2);
    return {
      todayVisits: todayVisits.map(visit => ({ ...visit, customer: customerById.get(visit.customerId) ?? null })),
      upcomingVisits: upcomingVisits.map(visit => ({ ...visit, customer: customerById.get(visit.customerId) ?? null })),
      dueReminders,
      inventory: { totalItems: inventory.items.length, lowStockCount: lowStock.length, lowStock },
    };
  }),

  customers: router({
    list: protectedProcedure.input(z.object({ search: z.string().trim().max(160).optional() })).query(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const ownerFilter = eq(customers.ownerId, ctx.user.id);
      const query = input.search
        ? db.select().from(customers).where(and(ownerFilter, like(customers.name, `%${input.search}%`))).orderBy(desc(customers.createdAt))
        : db.select().from(customers).where(ownerFilter).orderBy(desc(customers.createdAt));
      return query;
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const customer = await getOwnedCustomer(ctx.user.id, input.id);
      const [customerVisits, customerReminders] = await Promise.all([
        db.select().from(visits).where(and(eq(visits.ownerId, ctx.user.id), eq(visits.customerId, input.id))).orderBy(desc(visits.visitDate)),
        db.select().from(reminders).where(and(eq(reminders.ownerId, ctx.user.id), eq(reminders.customerId, input.id))).orderBy(desc(reminders.reminderDate)),
      ]);
      return { customer, visits: customerVisits, reminders: customerReminders };
    }),
    create: protectedProcedure.input(customerInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const result = await db.insert(customers).values({ ...input, ownerId: ctx.user.id });
      return { id: Number(result[0].insertId) };
    }),
    update: protectedProcedure.input(customerInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      await getOwnedCustomer(ctx.user.id, input.id);
      const { id, ...data } = input;
      await db.update(customers).set(data).where(and(eq(customers.id, id), eq(customers.ownerId, ctx.user.id)));
      return { success: true };
    }),
  }),

  visits: router({
    create: protectedProcedure.input(visitInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      await getOwnedCustomer(ctx.user.id, input.customerId);
      const visitResult = await db.insert(visits).values({ ...input, ownerId: ctx.user.id });
      const visitId = Number(visitResult[0].insertId);
      if (needsAutomaticReminder(input.visitType)) {
        await db.insert(reminders).values({
          customerId: input.customerId,
          visitId,
          ownerId: ctx.user.id,
          reminderDate: followUpDate(input.visitDate),
        });
      }
      return { id: visitId, reminderCreated: needsAutomaticReminder(input.visitType) };
    }),
  }),

  reminders: router({
    due: protectedProcedure.query(({ ctx }) => remindersWithCustomers(ctx.user.id, true)),
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["completed", "dismissed"]) })).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const reminder = await db.select().from(reminders).where(and(eq(reminders.id, input.id), eq(reminders.ownerId, ctx.user.id))).limit(1);
      if (!reminder[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على التذكير." });
      }
      await db.update(reminders).set({ status: input.status }).where(and(eq(reminders.id, input.id), eq(reminders.ownerId, ctx.user.id)));
      return { success: true };
    }),
  }),

  inventory: router({
    summary: protectedProcedure.query(({ ctx }) => inventorySummary(ctx.user.id)),
    createItem: protectedProcedure.input(inventoryItemInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const result = await db.insert(inventoryItems).values({ ...input, ownerId: ctx.user.id });
      return { id: Number(result[0].insertId) };
    }),
    createMovement: protectedProcedure.input(inventoryMovementInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const item = await db.select().from(inventoryItems).where(and(eq(inventoryItems.id, input.inventoryItemId), eq(inventoryItems.ownerId, ctx.user.id))).limit(1);
      if (!item[0]) throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على الصنف." });
      const itemMovements = await db
        .select()
        .from(inventoryMovements)
        .where(and(eq(inventoryMovements.inventoryItemId, input.inventoryItemId), eq(inventoryMovements.ownerId, ctx.user.id)));
      const currentBalance = calculateStockBalance(item[0].openingQuantity, itemMovements);
      if (input.movementType === "outgoing" && input.quantity > currentBalance) {
        throw new TRPCError({ code: "BAD_REQUEST", message: `لا يمكن صرف ${input.quantity}؛ الرصيد المتاح هو ${currentBalance}.` });
      }
      await db.insert(inventoryMovements).values({ ...input, ownerId: ctx.user.id });
      return { success: true };
    }),
  }),
});
