import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { and, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import {
  cashTransactions,
  customers,
  inventoryItems,
  inventoryMovements,
  notificationSettings,
  reminders,
  visits,
} from "../../drizzle/schema";
import { calculateCashSummary, cashTransactionTypes } from "../../shared/cashBusiness";
import {
  DEFAULT_ALERT_HOUR,
  DEFAULT_ALERT_LEAD_DAYS,
  DEFAULT_ALERT_MINUTE,
  DEFAULT_TIMEZONE_OFFSET_MINUTES,
  alertDateForReminder,
  calculateStockBalance,
  customerCode,
  daysUntilFollowUp,
  followUpDate,
  followUpSummaryFromVisits,
  isReminderAlertActive,
  needsAutomaticReminder,
  visitTypes,
} from "../../shared/filterBusiness";
import { getDb } from "../db";
import { createHeartbeatJob, updateHeartbeatJob } from "../_core/heartbeat";
import { COOKIE_NAME } from "../../shared/const";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

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
  clientOperationId: z.string().uuid().optional(),
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

const cashTransactionInput = z.object({
  transactionType: z.enum(cashTransactionTypes),
  amount: z.number().int().positive("أدخل مبلغًا أكبر من صفر"),
  category: z.string().trim().min(2, "أدخل تصنيف العملية").max(100),
  transactionDate: z.date(),
  recipientName: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

const notificationSettingsInput = z.object({
  leadDays: z.number().int().min(1).max(14).default(DEFAULT_ALERT_LEAD_DAYS),
  alertHour: z.number().int().min(0).max(23).default(DEFAULT_ALERT_HOUR),
  alertMinute: z.number().int().min(0).max(59).default(DEFAULT_ALERT_MINUTE),
  timezoneOffsetMinutes: z.number().int().min(-720).max(840).default(DEFAULT_TIMEZONE_OFFSET_MINUTES),
});

const defaultNotificationSettings = {
  leadDays: DEFAULT_ALERT_LEAD_DAYS,
  alertHour: DEFAULT_ALERT_HOUR,
  alertMinute: DEFAULT_ALERT_MINUTE,
  timezoneOffsetMinutes: DEFAULT_TIMEZONE_OFFSET_MINUTES,
};

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

function withCustomerFollowUp(
  customer: typeof customers.$inferSelect,
  customerVisits: Array<typeof visits.$inferSelect>,
  now = new Date(),
) {
  return {
    ...customer,
    customerCode: customerCode(customer.id),
    followUp: followUpSummaryFromVisits(customerVisits, now),
  };
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
  return {
    items: itemBalances,
    movements: movements.map(movement => ({
      ...movement,
      inventoryItemName: items.find(item => item.id === movement.inventoryItemId)?.name ?? "صنف غير معروف",
    })),
  };
}

async function cashSummary(ownerId: number) {
  const db = await databaseOrThrow();
  const transactions = await db
    .select()
    .from(cashTransactions)
    .where(eq(cashTransactions.ownerId, ownerId))
    .orderBy(desc(cashTransactions.transactionDate));
  return { transactions, ...calculateCashSummary(transactions) };
}

async function remindersWithCustomers(ownerId: number, onlyDue: boolean) {
  const db = await databaseOrThrow();
  const filters = [eq(reminders.ownerId, ownerId), eq(reminders.status, "pending")];
  if (onlyDue) filters.push(lte(reminders.reminderDate, new Date()));
  const rows = await db.select().from(reminders).where(and(...filters)).orderBy(reminders.reminderDate);
  if (rows.length === 0) return [];
  const customerIds = Array.from(new Set(rows.map(row => row.customerId)));
  const visitIds = Array.from(new Set(rows.map(row => row.visitId)));
  const [customerRows, sourceVisits] = await Promise.all([
    db.select().from(customers).where(and(eq(customers.ownerId, ownerId), inArray(customers.id, customerIds))),
    db.select().from(visits).where(and(eq(visits.ownerId, ownerId), inArray(visits.id, visitIds))),
  ]);
  const customerById = new Map(customerRows.map(customer => [customer.id, customer]));
  const visitById = new Map(sourceVisits.map(visit => [visit.id, visit]));
  const now = new Date();
  return rows.map(reminder => {
    const customer = customerById.get(reminder.customerId);
    const sourceVisit = visitById.get(reminder.visitId);
    const daysRemaining = daysUntilFollowUp(reminder.reminderDate, now);
    return {
      ...reminder,
      lastServiceVisitType: sourceVisit?.visitType ?? null,
      lastServiceVisitDate: sourceVisit?.visitDate ?? null,
      daysOverdue: Math.max(0, -daysRemaining),
      customer: customer
        ? {
            ...customer,
            customerCode: customerCode(customer.id),
            followUp: { nextVisitDate: reminder.reminderDate, daysRemaining },
          }
        : null,
    };
  });
}

async function getNotificationSettings(ownerId: number) {
  const db = await databaseOrThrow();
  const rows = await db.select().from(notificationSettings).where(eq(notificationSettings.ownerId, ownerId)).limit(1);
  return rows[0] ?? { ownerId, ...defaultNotificationSettings, scheduleCronTaskUid: null };
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
    const [todayVisits, upcomingVisits, dueReminders, inventory, cash] = await Promise.all([
      db.select().from(visits).where(and(eq(visits.ownerId, ownerId), gte(visits.visitDate, startOfToday), lte(visits.visitDate, endOfToday))).orderBy(visits.visitDate),
      db.select().from(visits).where(and(eq(visits.ownerId, ownerId), gte(visits.visitDate, now))).orderBy(visits.visitDate).limit(5),
      remindersWithCustomers(ownerId, true),
      inventorySummary(ownerId),
      cashSummary(ownerId),
    ]);
    const visitCustomerIds = Array.from(new Set([...todayVisits, ...upcomingVisits].map(visit => visit.customerId)));
    const visitCustomers = visitCustomerIds.length
      ? await db.select().from(customers).where(and(eq(customers.ownerId, ownerId), inArray(customers.id, visitCustomerIds)))
      : [];
    const customerById = new Map(visitCustomers.map(customer => [customer.id, customer]));
    const lowStock = inventory.items.filter(item => item.currentBalance <= 2);
    return {
      todayVisits: todayVisits.map(visit => {
        const customer = customerById.get(visit.customerId);
        return { ...visit, customer: customer ? { ...customer, customerCode: customerCode(customer.id) } : null };
      }),
      upcomingVisits: upcomingVisits.map(visit => {
        const customer = customerById.get(visit.customerId);
        return { ...visit, customer: customer ? { ...customer, customerCode: customerCode(customer.id) } : null };
      }),
      dueReminders,
      inventory: {
        totalItems: inventory.items.length,
        lowStockCount: lowStock.length,
        lowStock,
        items: inventory.items.map(item => ({ id: item.id, name: item.name, currentBalance: item.currentBalance })),
      },
      cash: { incomeTotal: cash.incomeTotal, expenseTotal: cash.expenseTotal, balance: cash.balance },
    };
  }),

  customers: router({
    list: protectedProcedure.input(z.object({
      search: z.string().trim().max(160).optional(),
      followUpStatus: z.enum(["all", "overdue", "today", "upcoming", "none"]).default("all"),
      followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    })).query(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const ownerFilter = eq(customers.ownerId, ctx.user.id);
      const [customerRows, ownerVisits] = await Promise.all([
        db.select().from(customers).where(ownerFilter).orderBy(desc(customers.createdAt)),
        db.select().from(visits).where(eq(visits.ownerId, ctx.user.id)).orderBy(desc(visits.visitDate)),
      ]);
      const visitsByCustomer = new Map<number, Array<typeof visits.$inferSelect>>();
      ownerVisits.forEach(visit => visitsByCustomer.set(visit.customerId, [...(visitsByCustomer.get(visit.customerId) ?? []), visit]));
      const search = input.search?.toLocaleLowerCase("ar-EG");
      return customerRows
        .map(customer => withCustomerFollowUp(customer, visitsByCustomer.get(customer.id) ?? []))
        .filter(customer => {
          const matchesSearch = !search || customer.name.toLocaleLowerCase("ar-EG").includes(search) || customer.phone.includes(search) || customerCode(customer.id).toLowerCase().includes(search);
          const followUp = customer.followUp;
          const matchesStatus = input.followUpStatus === "all"
            || (input.followUpStatus === "none" && !followUp)
            || (input.followUpStatus === "overdue" && Boolean(followUp && followUp.daysRemaining < 0))
            || (input.followUpStatus === "today" && Boolean(followUp && followUp.daysRemaining === 0))
            || (input.followUpStatus === "upcoming" && Boolean(followUp && followUp.daysRemaining > 0));
          const matchesDate = !input.followUpDate || Boolean(followUp && followUp.nextVisitDate.toISOString().slice(0, 10) === input.followUpDate);
          return matchesSearch && matchesStatus && matchesDate;
        });
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const customer = await getOwnedCustomer(ctx.user.id, input.id);
      const [customerVisits, customerReminders] = await Promise.all([
        db.select().from(visits).where(and(eq(visits.ownerId, ctx.user.id), eq(visits.customerId, input.id))).orderBy(desc(visits.visitDate)),
        db.select().from(reminders).where(and(eq(reminders.ownerId, ctx.user.id), eq(reminders.customerId, input.id))).orderBy(desc(reminders.reminderDate)),
      ]);
      return { customer: withCustomerFollowUp(customer, customerVisits), visits: customerVisits, reminders: customerReminders };
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
      if (input.clientOperationId) {
        const existing = await db.select().from(visits).where(and(
          eq(visits.ownerId, ctx.user.id),
          eq(visits.clientOperationId, input.clientOperationId),
        )).limit(1);
        if (existing[0]) {
          return {
            id: existing[0].id,
            reminderCreated: needsAutomaticReminder(existing[0].visitType),
            alreadySynced: true,
          };
        }
      }
      await getOwnedCustomer(ctx.user.id, input.customerId);
      const visitResult = await db.insert(visits).values({ ...input, ownerId: ctx.user.id });
      const visitId = Number(visitResult[0].insertId);
      // تسجيل الزيارة يعني أن متابعة العميل تمت؛ لا نُبقي أي تذكير سابق معلقًا.
      await db.update(reminders)
        .set({ status: "completed" })
        .where(and(
          eq(reminders.ownerId, ctx.user.id),
          eq(reminders.customerId, input.customerId),
          eq(reminders.status, "pending"),
        ));
      if (needsAutomaticReminder(input.visitType)) {
        await db.insert(reminders).values({
          customerId: input.customerId,
          visitId,
          ownerId: ctx.user.id,
          reminderDate: followUpDate(input.visitDate),
        });
      }
      return { id: visitId, reminderCreated: needsAutomaticReminder(input.visitType), alreadySynced: false };
    }),
  }),

  reminders: router({
    due: protectedProcedure.query(({ ctx }) => remindersWithCustomers(ctx.user.id, true)),
    alerts: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getNotificationSettings(ctx.user.id);
      const pending = await remindersWithCustomers(ctx.user.id, false);
      return pending
        .filter(reminder => isReminderAlertActive(reminder.reminderDate, settings))
        .map(reminder => ({ ...reminder, alertDate: alertDateForReminder(reminder.reminderDate, settings) }));
    }),
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

  notifications: router({
    settings: protectedProcedure.query(({ ctx }) => getNotificationSettings(ctx.user.id)),
    nextAlert: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getNotificationSettings(ctx.user.id);
      const pending = await remindersWithCustomers(ctx.user.id, false);
      const upcoming = pending
        .filter(reminder => !reminder.alertedAt)
        .map(reminder => ({ ...reminder, alertDate: alertDateForReminder(reminder.reminderDate, settings) }))
        .sort((first, second) => first.alertDate.getTime() - second.alertDate.getTime());
      return upcoming[0] ?? null;
    }),
    saveSettings: protectedProcedure.input(notificationSettingsInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      await db.insert(notificationSettings).values({ ownerId: ctx.user.id, ...input }).onDuplicateKeyUpdate({ set: input });
      return getNotificationSettings(ctx.user.id);
    }),
    enableScheduledAlerts: protectedProcedure.input(notificationSettingsInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "سجّل الدخول لتفعيل التنبيهات التلقائية." });
      }
      await db.insert(notificationSettings).values({ ownerId: ctx.user.id, ...input }).onDuplicateKeyUpdate({ set: input });
      const settings = await getNotificationSettings(ctx.user.id);
      const cron = "0 */5 * * * *";
      if (settings.scheduleCronTaskUid) {
        const result = await updateHeartbeatJob(settings.scheduleCronTaskUid, { cron, enable: true, description: "فحص تنبيهات مواعيد فلاتر المياه كل خمس دقائق" }, sessionToken);
        return { active: true, nextExecutionAt: result.nextExecutionAt ?? null };
      }
      const job = await createHeartbeatJob({
        name: `water-filter-reminders-${ctx.user.id}`,
        cron,
        path: "/api/scheduled/reminder-alerts",
        description: "إرسال تنبيه قبل مواعيد متابعة فلاتر المياه",
      }, sessionToken);
      await db.update(notificationSettings).set({ scheduleCronTaskUid: job.taskUid }).where(eq(notificationSettings.ownerId, ctx.user.id));
      return { active: true, nextExecutionAt: job.nextExecutionAt ?? null };
    }),
  }),

  inventory: router({
    summary: adminProcedure.query(({ ctx }) => inventorySummary(ctx.user.id)),
    createItem: adminProcedure.input(inventoryItemInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const result = await db.insert(inventoryItems).values({ ...input, ownerId: ctx.user.id });
      return { id: Number(result[0].insertId) };
    }),
    createMovement: adminProcedure.input(inventoryMovementInput).mutation(async ({ ctx, input }) => {
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

  cash: router({
    summary: adminProcedure.query(({ ctx }) => cashSummary(ctx.user.id)),
    create: adminProcedure.input(cashTransactionInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const result = await db.insert(cashTransactions).values({ ...input, ownerId: ctx.user.id });
      return { id: Number(result[0].insertId) };
    }),
  }),
});
