import { TRPCError } from "@trpc/server";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { parse as parseCookie } from "cookie";
import { and, asc, desc, eq, gte, inArray, lte, ne } from "drizzle-orm";
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
import { calculateCashBreakdown, calculateCashSummaries, calculateCompanyFinancialOverview, calculatePurchaseBreakdown, cashCurrencies, cashTransactionTypes, matchesCashTransactionSearch } from "../../shared/cashBusiness";
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
import { createOwnerBackup, refreshOwnerBackup } from "../backup";
import { storageGet } from "../storage";

const customerInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم العميل").max(160),
  manualCode: z.string().trim().max(64).optional().nullable(),
  phone: z.string().trim().min(6, "أدخل رقم هاتف صحيح").max(32),
  address: z.string().trim().max(1000).optional().nullable(),
  latitude: z.string().trim().max(32).optional().nullable(),
  longitude: z.string().trim().max(32).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  clientOperationId: z.string().uuid().optional(),
  serviceDate: z.date().optional().nullable(),
  collectedAmount: z.number().int().nonnegative().optional().nullable(),
});

function normalizeCustomerName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ar");
}

const customerCreateInput = customerInput.extend({
  firstVisitType: z.enum(visitTypes).optional(),
  firstVisitDate: z.date().optional(),
  firstTechnicianName: z.string().trim().max(160).optional().nullable(),
  firstVisitNotes: z.string().trim().max(2000).optional().nullable(),
  firstVisitResult: z.string().trim().max(2000).optional().nullable(),
  firstCollectedAmount: z.number().int().nonnegative().optional().default(0),
  firstCollectedCurrency: z.enum(cashCurrencies).optional().default("SAR"),
});

const visitInput = z.object({
  customerId: z.number().int().positive(),
  visitType: z.enum(visitTypes),
  visitDate: z.date(),
  technicianName: z.string().trim().max(160).optional().nullable(),
  visitResult: z.string().trim().max(2000).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  collectedAmount: z.number().int().nonnegative().optional().default(0),
  collectedCurrency: z.enum(cashCurrencies).optional().default("SAR"),
  clientOperationId: z.string().uuid().optional(),
});

const inventoryItemInput = z.object({
  name: z.string().trim().min(2, "أدخل اسم الصنف").max(160),
  category: z.string().trim().min(2).max(120).default("عام"),
  unit: z.string().trim().min(1).max(40).default("قطعة"),
  reorderLevel: z.number().int().min(0).max(999999).default(2),
  defaultUnitCost: z.number().int().nonnegative().max(999999999).default(0),
  openingQuantity: z.number().int().min(0).default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
  clientOperationId: z.string().uuid().optional(),
});

const inventoryMovementInput = z.object({
  inventoryItemId: z.number().int().positive(),
  movementType: z.enum(["incoming", "outgoing"]),
  quantity: z.number().int().positive("أدخل كمية أكبر من صفر"),
  unitCost: z.number().int().nonnegative().optional().default(0),
  currency: z.enum(cashCurrencies).optional().default("SAR"),
  movementDate: z.date(),
  technicianName: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  clientOperationId: z.string().uuid().optional(),
});

const cashTransactionInput = z.object({
  transactionType: z.enum(cashTransactionTypes),
  currency: z.enum(cashCurrencies).optional().default("SAR"),
  amount: z.number().int().positive("أدخل مبلغًا أكبر من صفر"),
  category: z.string().trim().min(2, "أدخل تصنيف العملية").max(100),
  transactionDate: z.date(),
  recipientName: z.string().trim().max(160).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  clientOperationId: z.string().uuid().optional(),
});

const notificationSettingsInput = z.object({
  leadDays: z.number().int().min(1).max(14).default(DEFAULT_ALERT_LEAD_DAYS),
  alertHour: z.number().int().min(0).max(23).default(DEFAULT_ALERT_HOUR),
  alertMinute: z.number().int().min(0).max(59).default(DEFAULT_ALERT_MINUTE),
  timezoneOffsetMinutes: z.number().int().min(-720).max(840).default(DEFAULT_TIMEZONE_OFFSET_MINUTES),
});
const pinValue = z.string().trim().min(4, "الرقم السري يجب أن يتكون من 4 أحرف أو أرقام على الأقل.").max(64);
const notificationSettingsSaveInput = notificationSettingsInput.extend({ pin: pinValue.optional() });
const pinSetupInput = z.object({ newPin: pinValue, currentPin: pinValue.optional() });

const defaultNotificationSettings = {
  leadDays: DEFAULT_ALERT_LEAD_DAYS,
  alertHour: DEFAULT_ALERT_HOUR,
  alertMinute: DEFAULT_ALERT_MINUTE,
  timezoneOffsetMinutes: DEFAULT_TIMEZONE_OFFSET_MINUTES,
  pinHash: null,
};

const sensitivePinInput = z.object({ pin: z.string().trim().min(4, "الرقم السري يجب أن يتكون من 4 أحرف أو أرقام على الأقل.").max(64) });
const scryptAsync = promisify(scrypt);

async function hashPin(pin: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scryptAsync(pin, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString("hex")}`;
}

async function verifyPin(pin: string, encodedHash: string) {
  const [salt, storedHex] = encodedHash.split(":");
  if (!salt || !storedHex) return false;
  const stored = Buffer.from(storedHex, "hex");
  const derived = (await scryptAsync(pin, salt, stored.length)) as Buffer;
  return stored.length === derived.length && timingSafeEqual(stored, derived);
}

async function databaseOrThrow() {
  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر الاتصال بقاعدة البيانات." });
  }
  return db;
}

function compareCustomersByCreation(left: typeof customers.$inferSelect, right: typeof customers.$inferSelect) {
  const leftTime = left.createdAt instanceof Date ? left.createdAt.getTime() : 0;
  const rightTime = right.createdAt instanceof Date ? right.createdAt.getTime() : 0;
  return leftTime - rightTime || left.id - right.id;
}

function customerNumberMap(customerRows: Array<typeof customers.$inferSelect>) {
  return new Map(customerRows.map((customer, index) => [customer.id, index + 1]));
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
  customerNumber = customer.id,
  now = new Date(),
) {
  return {
    ...customer,
    customerCode: customer.manualCode?.trim() || customerCode(customerNumber),
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

type CashIncomeFilter = "all" | "service" | "installation" | "maintenance";
export type CashPartyType = "all" | "technician" | "customer" | "entity";
type CashDateFilter = { month?: string; startDate?: string; endDate?: string };
type CashCategoryFilter = { category?: string; technician?: string; itemName?: string; partyType?: CashPartyType };

export function classifyCashParty(transaction: { sourceVisitId?: number | null; category: string; recipientName?: string | null; notes?: string | null }): Exclude<CashPartyType, "all"> {
  if (transaction.sourceVisitId || transaction.category.startsWith("تحصيل")) return "customer";
  const searchable = `${transaction.category} ${transaction.recipientName ?? ""} ${transaction.notes ?? ""}`;
  if (/فني|راتب|عمولة/.test(searchable)) return "technician";
  return "entity";
}

function matchesCashDateFilter(date: Date, dateFilter?: CashDateFilter) {
  if (!dateFilter?.month && !dateFilter?.startDate && !dateFilter?.endDate) return true;
  const dateKey = date.toISOString().slice(0, 10);
  if (dateFilter.month && dateKey.slice(0, 7) !== dateFilter.month) return false;
  if (dateFilter.startDate && dateKey < dateFilter.startDate) return false;
  if (dateFilter.endDate && dateKey > dateFilter.endDate) return false;
  return true;
}

async function cashSummary(ownerId: number, incomeFilter: CashIncomeFilter = "all", dateFilter?: CashDateFilter, search?: string, categoryFilter: CashCategoryFilter = {}) {
  const db = await databaseOrThrow();
  const filters = [eq(cashTransactions.ownerId, ownerId)];
  if (incomeFilter === "service") {
    filters.push(eq(cashTransactions.transactionType, "income"));
  }
  const transactions = await db
    .select()
    .from(cashTransactions)
    .where(and(...filters))
    .orderBy(desc(cashTransactions.transactionDate));
  const sourceVisitIds = Array.from(new Set(transactions.map(transaction => transaction.sourceVisitId).filter((id): id is number => Boolean(id))));
  const sourceVisits = sourceVisitIds.length
    ? await db.select({ id: visits.id, technicianName: visits.technicianName }).from(visits).where(and(eq(visits.ownerId, ownerId), inArray(visits.id, sourceVisitIds)))
    : [];
  const technicianByVisitId = new Map(sourceVisits.map(visit => [visit.id, visit.technicianName]));
  const displayTransactions = transactions.map(transaction => {
    const technicianName = transaction.sourceVisitId ? technicianByVisitId.get(transaction.sourceVisitId) : undefined;
    return technicianName !== undefined ? { ...transaction, recipientName: technicianName } : transaction;
  });
  const filteredTransactions = displayTransactions.filter(transaction => {
    const isInstallationIncome = transaction.category === "تحصيل تركيب";
    const isMaintenanceIncome = transaction.category === "تحصيل صيانة";
    const isServiceIncome = isInstallationIncome || isMaintenanceIncome;
    const matchesIncome = incomeFilter === "all"
      || (incomeFilter === "service" && transaction.transactionType === "income" && isServiceIncome)
      || (incomeFilter === "installation" && transaction.transactionType === "income" && isInstallationIncome)
      || (incomeFilter === "maintenance" && transaction.transactionType === "income" && isMaintenanceIncome);
    const matchesCategory = !categoryFilter.category || transaction.category === categoryFilter.category;
    const matchesTechnician = !categoryFilter.technician || transaction.recipientName === categoryFilter.technician;
    const matchesPartyType = !categoryFilter.partyType || categoryFilter.partyType === "all" || classifyCashParty(transaction) === categoryFilter.partyType;
    return matchesIncome && matchesCategory && matchesTechnician && matchesPartyType
      && matchesCashDateFilter(new Date(transaction.transactionDate), dateFilter)
      && matchesCashTransactionSearch(transaction, search);
  });
  const [purchaseItems, purchaseMovements] = await Promise.all([
    db.select({ id: inventoryItems.id, name: inventoryItems.name }).from(inventoryItems).where(eq(inventoryItems.ownerId, ownerId)),
    db.select().from(inventoryMovements).where(eq(inventoryMovements.ownerId, ownerId)),
  ]);
  const itemNames = new Map(purchaseItems.map(item => [item.id, item.name]));
  const filteredPurchaseMovements = purchaseMovements
    .map(movement => ({ ...movement, itemName: itemNames.get(movement.inventoryItemId) ?? "صنف غير معروف" }))
    .filter(movement => !categoryFilter.itemName || movement.itemName === categoryFilter.itemName)
    .filter(movement => matchesCashDateFilter(new Date(movement.movementDate), dateFilter))
    .filter(movement => matchesCashTransactionSearch({ category: movement.itemName, notes: movement.notes, recipientName: movement.technicianName }, search));
  const summaries = calculateCashSummaries(filteredTransactions);
  const breakdown = calculateCashBreakdown(filteredTransactions);
  const financialOverview = calculateCompanyFinancialOverview(filteredTransactions);
  const purchases = calculatePurchaseBreakdown(filteredPurchaseMovements);
  const availableCategories = Array.from(new Set(transactions.map(transaction => transaction.category).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ar"));
  const availableTechnicians = Array.from(new Set(displayTransactions.map(transaction => transaction.recipientName).filter((name): name is string => Boolean(name?.trim())))).sort((a, b) => a.localeCompare(b, "ar"));
  const availableItemNames = Array.from(new Set(itemNames.values())).sort((a, b) => a.localeCompare(b, "ar"));
  return { transactions: filteredTransactions, ...summaries.SAR, summaries, breakdown, financialOverview, purchases, incomeFilter, categoryFilter, availableCategories, availableTechnicians, availablePartyTypes: ["technician", "customer", "entity"] as const, availableItemNames, search: search?.trim() ?? "" };
}

async function remindersWithCustomers(ownerId: number, onlyDue: boolean, withinDays?: number) {
  const db = await databaseOrThrow();
  const filters = [eq(reminders.ownerId, ownerId), eq(reminders.status, "pending")];
  if (onlyDue) filters.push(lte(reminders.reminderDate, new Date()));
  if (withinDays !== undefined) filters.push(lte(reminders.reminderDate, new Date(Date.now() + withinDays * 86400000)));
  const rows = await db.select().from(reminders).where(and(...filters)).orderBy(reminders.reminderDate);
  if (rows.length === 0) return [];
  const customerIds = Array.from(new Set(rows.map(row => row.customerId)));
  const visitIds = Array.from(new Set(rows.map(row => row.visitId)));
  const [customerRows, sourceVisits, allCustomers] = await Promise.all([
    db.select().from(customers).where(and(eq(customers.ownerId, ownerId), inArray(customers.id, customerIds))),
    db.select().from(visits).where(and(eq(visits.ownerId, ownerId), inArray(visits.id, visitIds))),
    db.select().from(customers).where(eq(customers.ownerId, ownerId)),
  ]);
  const customerById = new Map(customerRows.map(customer => [customer.id, customer]));
  const customerNumbers = customerNumberMap([...allCustomers].sort(compareCustomersByCreation));
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
            customerCode: customer.manualCode?.trim() || customerCode(customerNumbers.get(customer.id) ?? customer.id),
            followUp: { nextVisitDate: reminder.reminderDate, daysRemaining },
          }
        : null,
    };
  });
}

async function getNotificationSettingsRow(ownerId: number) {
  const db = await databaseOrThrow();
  const rows = await db.select().from(notificationSettings).where(eq(notificationSettings.ownerId, ownerId)).limit(1);
  return rows[0] ?? { ownerId, ...defaultNotificationSettings, scheduleCronTaskUid: null, id: 0, backupFileKey: null, backupGeneratedAt: null, createdAt: new Date(), updatedAt: new Date() };
}

async function getNotificationSettings(ownerId: number) {
  const { pinHash: _pinHash, ...safeSettings } = await getNotificationSettingsRow(ownerId);
  return safeSettings;
}

async function requirePin(ownerId: number, pin: string) {
  const settings = await getNotificationSettingsRow(ownerId);
  if (!settings.pinHash) {
    throw new TRPCError({ code: "FORBIDDEN", message: "لم يتم ضبط رقم سري بعد. افتح الإعدادات وأنشئ رقمًا سريًا أولًا." });
  }
  if (!(await verifyPin(pin, settings.pinHash))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "الرقم السري غير صحيح." });
  }
}

async function requirePinIfConfigured(ownerId: number, pin?: string) {
  const settings = await getNotificationSettingsRow(ownerId);
  if (settings.pinHash) {
    if (!pin) throw new TRPCError({ code: "FORBIDDEN", message: "أدخل الرقم السري لتعديل الإعدادات." });
    await requirePin(ownerId, pin);
  }
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
    const endOfUpcomingWindow = new Date(startOfToday);
    endOfUpcomingWindow.setDate(endOfUpcomingWindow.getDate() + 6);
    endOfUpcomingWindow.setMilliseconds(-1);
    const [todayVisits, upcomingVisits, upcomingFollowUps, dueReminders, inventory, cash, chartTransactions] = await Promise.all([
      db.select().from(visits).where(and(eq(visits.ownerId, ownerId), gte(visits.visitDate, startOfToday), lte(visits.visitDate, endOfToday))).orderBy(visits.visitDate),
      db.select().from(visits).where(and(eq(visits.ownerId, ownerId), gte(visits.visitDate, endOfToday), lte(visits.visitDate, endOfUpcomingWindow))).orderBy(visits.visitDate).limit(20),
      remindersWithCustomers(ownerId, false, 5),
      remindersWithCustomers(ownerId, true),
      inventorySummary(ownerId),
      cashSummary(ownerId),
      db.select().from(cashTransactions).where(eq(cashTransactions.ownerId, ownerId)),
    ]);
    const visitCustomerIds = Array.from(new Set([...todayVisits, ...upcomingVisits].map(visit => visit.customerId)));
    const [visitCustomers, allCustomers] = await Promise.all([
      visitCustomerIds.length
        ? db.select().from(customers).where(and(eq(customers.ownerId, ownerId), inArray(customers.id, visitCustomerIds)))
        : Promise.resolve([]),
      db.select().from(customers).where(eq(customers.ownerId, ownerId)),
    ]);
    const customerById = new Map(visitCustomers.map(customer => [customer.id, customer]));
    const customerNumbers = customerNumberMap([...allCustomers].sort(compareCustomersByCreation));
    const chartDays = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startOfToday);
      date.setDate(date.getDate() - (6 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      return { date: key, expenses: 0, newCustomers: 0 };
    });
    const chartByDate = new Map(chartDays.map(day => [day.date, day]));
    for (const customer of allCustomers) {
      const createdAt = new Date(customer.createdAt);
      const key = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}-${String(createdAt.getDate()).padStart(2, "0")}`;
      const day = chartByDate.get(key);
      if (day) day.newCustomers += 1;
    }
    for (const transaction of chartTransactions) {
      if (transaction.transactionType !== "expense") continue;
      const transactionDate = new Date(transaction.transactionDate);
      const key = `${transactionDate.getFullYear()}-${String(transactionDate.getMonth() + 1).padStart(2, "0")}-${String(transactionDate.getDate()).padStart(2, "0")}`;
      const day = chartByDate.get(key);
      if (day) day.expenses += transaction.amount;
    }
    const lowStock = inventory.items.filter(item => item.currentBalance <= 2);
    return {
      todayVisits: todayVisits.map(visit => {
        const customer = customerById.get(visit.customerId);
        return { ...visit, customer: customer ? { ...customer, customerCode: customerCode(customerNumbers.get(customer.id) ?? customer.id) } : null };
      }),
      upcomingVisits: upcomingVisits.map(visit => {
        const customer = customerById.get(visit.customerId);
        return { ...visit, customer: customer ? { ...customer, customerCode: customerCode(customerNumbers.get(customer.id) ?? customer.id) } : null };
      }),
      upcomingFollowUps,
      dueReminders,
      inventory: {
        totalItems: inventory.items.length,
        lowStockCount: lowStock.length,
        lowStock,
        items: inventory.items.map(item => ({ id: item.id, name: item.name, currentBalance: item.currentBalance })),
      },
      cash: { incomeTotal: cash.incomeTotal, expenseTotal: cash.expenseTotal, balance: cash.balance, summaries: cash.summaries },
      chart: { days: chartDays, generatedAt: new Date() },
    };
  }),

  reports: router({
    monthly: protectedProcedure.input(z.object({
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })).query(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const from = new Date(`${input.dateFrom}T00:00:00`);
      const to = new Date(`${input.dateTo}T23:59:59.999`);
      if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "الفترة الزمنية غير صحيحة." });
      }
      const ownerId = ctx.user.id;
      const [periodVisits, periodCash, periodMovements, pendingReminders, inventory] = await Promise.all([
        db.select().from(visits).where(and(eq(visits.ownerId, ownerId), gte(visits.visitDate, from), lte(visits.visitDate, to))).orderBy(desc(visits.visitDate)),
        db.select().from(cashTransactions).where(and(eq(cashTransactions.ownerId, ownerId), gte(cashTransactions.transactionDate, from), lte(cashTransactions.transactionDate, to))).orderBy(desc(cashTransactions.transactionDate)),
        db.select().from(inventoryMovements).where(and(eq(inventoryMovements.ownerId, ownerId), gte(inventoryMovements.movementDate, from), lte(inventoryMovements.movementDate, to))).orderBy(desc(inventoryMovements.movementDate)),
        db.select().from(reminders).where(and(eq(reminders.ownerId, ownerId), eq(reminders.status, "pending"), lte(reminders.reminderDate, to))).orderBy(asc(reminders.reminderDate)),
        inventorySummary(ownerId),
      ]);
      const customerIds = Array.from(new Set(periodVisits.map(visit => visit.customerId)));
      const periodCustomers = customerIds.length ? await db.select().from(customers).where(and(eq(customers.ownerId, ownerId), inArray(customers.id, customerIds))) : [];
      const customerNames = new Map(periodCustomers.map(customer => [customer.id, customer.name]));
      const income = periodCash.filter(transaction => transaction.transactionType === "income").reduce((sum, transaction) => sum + transaction.amount, 0);
      const expense = periodCash.filter(transaction => transaction.transactionType === "expense").reduce((sum, transaction) => sum + transaction.amount, 0);
      const financial = calculateCompanyFinancialOverview(periodCash);
      const groupMoney = (rows: typeof periodCash, key: (row: typeof periodCash[number]) => string) => Array.from(rows.reduce((map, row) => map.set(key(row) || "غير مصنف", (map.get(key(row) || "غير مصنف") ?? 0) + row.amount), new Map<string, number>())).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
      const groupVisits = Array.from(periodVisits.reduce((map, visit) => map.set(visit.visitType, (map.get(visit.visitType) ?? 0) + 1), new Map<string, number>())).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
      const technicianVisits = Array.from(periodVisits.reduce((map, visit) => { const label = visit.technicianName?.trim() || "غير محدد"; return map.set(label, (map.get(label) ?? 0) + 1); }, new Map<string, number>())).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total);
      return {
        period: { dateFrom: input.dateFrom, dateTo: input.dateTo },
        summary: { visits: periodVisits.length, customers: customerIds.length, income, expense, balance: income - expense, pendingReminders: pendingReminders.length, lowStock: inventory.items.filter(item => item.currentBalance <= 2).length },
        financial: { serviceIncome: financial.serviceIncome, externalIncome: financial.externalIncome, totalIncome: financial.totalIncome, technicianPayments: financial.technicianPayments, technicianRequired: financial.technicianRequired, technicianRemaining: financial.technicianRemaining, otherExpenses: financial.otherExpenses, companyNet: financial.companyNet, technicianPaymentsByName: financial.technicianPaymentsByName },
        incomeByCategory: groupMoney(periodCash.filter(transaction => transaction.transactionType === "income"), row => row.category),
        expenseByCategory: groupMoney(periodCash.filter(transaction => transaction.transactionType === "expense"), row => row.category),
        visitsByType: groupVisits,
        visitsByTechnician: technicianVisits,
        inventory: { incomingQuantity: periodMovements.filter(movement => movement.movementType === "incoming").reduce((sum, movement) => sum + movement.quantity, 0), outgoingQuantity: periodMovements.filter(movement => movement.movementType === "outgoing").reduce((sum, movement) => sum + movement.quantity, 0), purchaseCost: periodMovements.filter(movement => movement.movementType === "incoming").reduce((sum, movement) => sum + movement.quantity * movement.unitCost, 0), items: inventory.items.map(item => ({ name: item.name, currentBalance: item.currentBalance })) },
        recentVisits: periodVisits.slice(0, 12).map(visit => ({ date: visit.visitDate, type: visit.visitType, technician: visit.technicianName || "غير محدد", customer: customerNames.get(visit.customerId) || "عميل غير معروف" })),
      };
    }),
  }),

  customers: router({
    list: protectedProcedure.input(z.object({
      search: z.string().trim().max(160).optional(),
      followUpStatus: z.enum(["all", "overdue", "today", "upcoming", "regular", "none"]).default("all"),
      followUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      visitDateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      visitDateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      collectedAmountMin: z.number().int().nonnegative().optional(),
      collectedAmountMax: z.number().int().nonnegative().optional(),
      sortBy: z.enum(["created_desc", "next_asc", "next_desc", "status", "collected_desc", "collected_asc"]).default("created_desc"),
    })).query(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const ownerFilter = eq(customers.ownerId, ctx.user.id);
      const [customerRows, ownerVisits] = await Promise.all([
        db.select().from(customers).where(ownerFilter).orderBy(desc(customers.createdAt)),
        db.select().from(visits).where(eq(visits.ownerId, ctx.user.id)).orderBy(desc(visits.visitDate)),
      ]);
      const visitIds = ownerVisits.map(visit => visit.id);
      const ownerIncome = visitIds.length
        ? await db.select().from(cashTransactions).where(and(eq(cashTransactions.ownerId, ctx.user.id), eq(cashTransactions.transactionType, "income"), inArray(cashTransactions.sourceVisitId, visitIds)))
        : [];
      const customerNumbers = customerNumberMap([...customerRows].sort(compareCustomersByCreation));
      const visitsByCustomer = new Map<number, Array<typeof visits.$inferSelect>>();
      ownerVisits.forEach(visit => visitsByCustomer.set(visit.customerId, [...(visitsByCustomer.get(visit.customerId) ?? []), visit]));
      const incomeByVisit = new Map(ownerIncome.map(transaction => [transaction.sourceVisitId, transaction]));
      const totalIncomeByCustomer = new Map<number, number>();
      ownerIncome.forEach(transaction => {
        if (transaction.sourceVisitId === null) return;
        const visit = ownerVisits.find(item => item.id === transaction.sourceVisitId);
        if (visit) totalIncomeByCustomer.set(visit.customerId, (totalIncomeByCustomer.get(visit.customerId) ?? 0) + transaction.amount);
      });
      const search = input.search?.toLocaleLowerCase("ar-EG");
      return customerRows
        .map(customer => {
          const shaped = withCustomerFollowUp(customer, visitsByCustomer.get(customer.id) ?? [], customerNumbers.get(customer.id) ?? customer.id);
          const latestVisit = (visitsByCustomer.get(customer.id) ?? [])[0];
          const latestIncome = latestVisit ? incomeByVisit.get(latestVisit.id) : undefined;
          return {
            ...shaped,
            lastVisitDate: latestVisit?.visitDate ?? null,
            latestTechnicianName: latestVisit?.technicianName ?? null,
            collectedAmount: latestIncome?.amount ?? 0,
            totalCollectedAmount: totalIncomeByCustomer.get(customer.id) ?? 0,
            collectedCurrency: latestIncome?.currency ?? "SAR",
          };
        })
        .filter(customer => {
          const matchesSearch = !search || customer.name.toLocaleLowerCase("ar-EG").includes(search) || customer.phone.includes(search) || (customer.customerCode ?? "").toLowerCase().includes(search);
          const followUp = customer.followUp;
          const matchesStatus = input.followUpStatus === "all"
            || (input.followUpStatus === "none" && !followUp)
            || (input.followUpStatus === "overdue" && Boolean(followUp && followUp.daysRemaining < 0))
            || (input.followUpStatus === "today" && Boolean(followUp && followUp.daysRemaining === 0))
            || (input.followUpStatus === "upcoming" && Boolean(followUp && followUp.daysRemaining <= 5))
            || (input.followUpStatus === "regular" && Boolean(followUp && followUp.daysRemaining > 5));
          const lastVisitDate = customer.lastVisitDate?.toISOString().slice(0, 10);
          const matchesDate = !input.followUpDate || Boolean(followUp && followUp.nextVisitDate.toISOString().slice(0, 10) === input.followUpDate);
          const matchesVisitDateFrom = !input.visitDateFrom || Boolean(lastVisitDate && lastVisitDate >= input.visitDateFrom);
          const matchesVisitDateTo = !input.visitDateTo || Boolean(lastVisitDate && lastVisitDate <= input.visitDateTo);
          const matchesCollectedMin = input.collectedAmountMin === undefined || customer.totalCollectedAmount >= input.collectedAmountMin;
          const matchesCollectedMax = input.collectedAmountMax === undefined || customer.totalCollectedAmount <= input.collectedAmountMax;
          return matchesSearch && matchesStatus && matchesDate && matchesVisitDateFrom && matchesVisitDateTo && matchesCollectedMin && matchesCollectedMax;
        })
        .sort((left, right) => {
          if (input.sortBy === "next_asc" || input.sortBy === "next_desc") {
            const leftDate = left.followUp?.nextVisitDate.getTime();
            const rightDate = right.followUp?.nextVisitDate.getTime();
            if (leftDate === undefined || rightDate === undefined) return leftDate === rightDate ? 0 : leftDate === undefined ? 1 : -1;
            return (input.sortBy === "next_asc" ? 1 : -1) * (leftDate - rightDate);
          }
          if (input.sortBy === "status") {
            const statusRank = (customer: typeof left) => !customer.followUp ? 4 : customer.followUp.daysRemaining < 0 ? 1 : customer.followUp.daysRemaining === 0 ? 2 : 3;
            return statusRank(left) - statusRank(right) || left.name.localeCompare(right.name, "ar-EG");
          }
          if (input.sortBy === "collected_desc" || input.sortBy === "collected_asc") {
            const difference = left.totalCollectedAmount - right.totalCollectedAmount;
            return (input.sortBy === "collected_desc" ? -1 : 1) * difference || left.name.localeCompare(right.name, "ar-EG");
          }
          return left.createdAt.getTime() - right.createdAt.getTime() || left.id - right.id;
        });
    }),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      const customer = await getOwnedCustomer(ctx.user.id, input.id);
      const allCustomers = await db.select().from(customers).where(eq(customers.ownerId, ctx.user.id));
      const customerNumbers = customerNumberMap((Array.isArray(allCustomers) ? allCustomers : [customer]).slice().sort(compareCustomersByCreation));
      const [customerVisits, customerReminders] = await Promise.all([
        db.select().from(visits).where(and(eq(visits.ownerId, ctx.user.id), eq(visits.customerId, input.id))).orderBy(desc(visits.visitDate)),
        db.select().from(reminders).where(and(eq(reminders.ownerId, ctx.user.id), eq(reminders.customerId, input.id))).orderBy(desc(reminders.reminderDate)),
      ]);
      return { customer: withCustomerFollowUp(customer, customerVisits, customerNumbers.get(customer.id) ?? customer.id), visits: customerVisits, reminders: customerReminders };
    }),
    create: protectedProcedure.input(customerCreateInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      if (input.clientOperationId) {
        const existing = await db.select().from(customers).where(and(
          eq(customers.ownerId, ctx.user.id),
          eq(customers.clientOperationId, input.clientOperationId),
        )).limit(1);
        if (existing[0]) return { id: existing[0].id, alreadySynced: true };
      }
      const { clientOperationId, firstVisitType, firstVisitDate, firstTechnicianName, firstVisitResult, firstVisitNotes, firstCollectedAmount, firstCollectedCurrency, ...data } = input;
      const existingNames = await db.select({ id: customers.id, name: customers.name }).from(customers).where(eq(customers.ownerId, ctx.user.id)).limit(100000);
      if (existingNames.some(customer => normalizeCustomerName(customer.name) === normalizeCustomerName(data.name))) {
        throw new TRPCError({ code: "CONFLICT", message: "اسم العميل موجود بالفعل، استخدم اسمًا مختلفًا." });
      }
      if (data.manualCode) {
        const duplicate = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.ownerId, ctx.user.id), eq(customers.manualCode, data.manualCode))).limit(1);
        if (duplicate[0]) throw new TRPCError({ code: "CONFLICT", message: "كود العميل مستخدم بالفعل، اختر كودًا مختلفًا." });
      }
      const result = await db.insert(customers).values({ ...data, clientOperationId, ownerId: ctx.user.id });
      const customerId = Number(result[0].insertId);
      if (!firstVisitType) {
        await refreshOwnerBackup(ctx.user.id);
        return { id: customerId, alreadySynced: false, firstVisitCreated: false };
      }
      const visitDate = firstVisitDate ?? new Date();
      const visitResult = await db.insert(visits).values({ customerId, ownerId: ctx.user.id, visitType: firstVisitType, visitDate, technicianName: firstTechnicianName ?? null, visitResult: firstVisitResult ?? null, notes: firstVisitNotes ?? null });
      const visitId = Number(visitResult[0].insertId);
      if (needsAutomaticReminder(firstVisitType)) {
        await db.insert(reminders).values({ customerId, visitId, ownerId: ctx.user.id, reminderDate: followUpDate(visitDate) });
      }
      if (firstCollectedAmount > 0) {
        const category = firstVisitType === "installation" ? "تحصيل تركيب" : firstVisitType === "maintenance" ? "تحصيل صيانة" : firstVisitType === "cartridge_change" ? "تحصيل تغيير شمعات" : "تحصيل زيارة";
        await db.insert(cashTransactions).values({ ownerId: ctx.user.id, transactionType: "income", currency: firstCollectedCurrency, amount: firstCollectedAmount, category, transactionDate: visitDate, sourceVisitId: visitId, recipientName: firstTechnicianName ?? null, notes: firstTechnicianName ? `العميل: ${input.name} | إيراد أُنشئ تلقائيًا من أول زيارة بواسطة ${firstTechnicianName}` : `العميل: ${input.name} | إيراد أُنشئ تلقائيًا من أول زيارة` });
      }
      await refreshOwnerBackup(ctx.user.id);
      return { id: customerId, alreadySynced: false, firstVisitCreated: true, reminderCreated: needsAutomaticReminder(firstVisitType) };
    }),
    update: protectedProcedure.input(customerInput.extend({ id: z.number().int().positive(), pin: sensitivePinInput.shape.pin })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      const customer = await getOwnedCustomer(ctx.user.id, input.id);
      const { id, serviceDate, collectedAmount, pin: _pin, ...data } = input;
      const existingNames = await db.select({ id: customers.id, name: customers.name }).from(customers).where(and(eq(customers.ownerId, ctx.user.id), ne(customers.id, id))).limit(100000);
      if (existingNames.some(customer => normalizeCustomerName(customer.name) === normalizeCustomerName(data.name))) {
        throw new TRPCError({ code: "CONFLICT", message: "اسم العميل موجود بالفعل، استخدم اسمًا مختلفًا." });
      }
      if (data.manualCode) {
        const duplicate = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.ownerId, ctx.user.id), eq(customers.manualCode, data.manualCode), ne(customers.id, id))).limit(1);
        if (duplicate[0]) throw new TRPCError({ code: "CONFLICT", message: "كود العميل مستخدم بالفعل، اختر كودًا مختلفًا." });
      }
      await db.update(customers).set(data).where(and(eq(customers.id, id), eq(customers.ownerId, ctx.user.id)));
      if (collectedAmount !== undefined && collectedAmount !== null) {
        const latestForAmount = await db.select().from(visits).where(and(eq(visits.customerId, id), eq(visits.ownerId, ctx.user.id))).orderBy(desc(visits.visitDate)).limit(1);
        if (latestForAmount[0]) {
          const linkedIncome = await db.select().from(cashTransactions).where(and(eq(cashTransactions.sourceVisitId, latestForAmount[0].id), eq(cashTransactions.ownerId, ctx.user.id))).limit(1);
          if (linkedIncome[0]) {
            await db.update(cashTransactions).set({ amount: collectedAmount }).where(and(eq(cashTransactions.id, linkedIncome[0].id), eq(cashTransactions.ownerId, ctx.user.id)));
          } else if (collectedAmount > 0) {
            const category = latestForAmount[0].visitType === "installation" ? "تحصيل تركيب" : latestForAmount[0].visitType === "maintenance" ? "تحصيل صيانة" : latestForAmount[0].visitType === "cartridge_change" ? "تحصيل تغيير شمعات" : "تحصيل زيارة";
            await db.insert(cashTransactions).values({ ownerId: ctx.user.id, transactionType: "income", currency: "SAR", amount: collectedAmount, category, transactionDate: latestForAmount[0].visitDate, sourceVisitId: latestForAmount[0].id, recipientName: latestForAmount[0].technicianName ?? null, notes: latestForAmount[0].technicianName ? `العميل: ${customer.name} | إيراد أُنشئ من تعديل مبلغ الخدمة بواسطة ${latestForAmount[0].technicianName}` : `العميل: ${customer.name} | إيراد أُنشئ من تعديل مبلغ الخدمة` });
          }
        }
      }
      if (serviceDate) {
        const latestVisit = await db.select().from(visits).where(and(eq(visits.customerId, id), eq(visits.ownerId, ctx.user.id))).orderBy(desc(visits.visitDate)).limit(1);
        if (latestVisit[0]) {
          await db.update(visits).set({ visitDate: serviceDate }).where(and(eq(visits.id, latestVisit[0].id), eq(visits.ownerId, ctx.user.id)));
          if (needsAutomaticReminder(latestVisit[0].visitType)) {
            await db.update(reminders).set({ reminderDate: followUpDate(serviceDate) }).where(and(eq(reminders.visitId, latestVisit[0].id), eq(reminders.ownerId, ctx.user.id), eq(reminders.status, "pending")));
          }
          await db.update(cashTransactions).set({ transactionDate: serviceDate }).where(and(eq(cashTransactions.sourceVisitId, latestVisit[0].id), eq(cashTransactions.ownerId, ctx.user.id)));
        }
      }
      await refreshOwnerBackup(ctx.user.id);
      return { success: true };
    }),
    delete: protectedProcedure.input(sensitivePinInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      await getOwnedCustomer(ctx.user.id, input.id);
      await db.delete(customers).where(and(eq(customers.id, input.id), eq(customers.ownerId, ctx.user.id)));
      await refreshOwnerBackup(ctx.user.id);
      return { success: true };
    }),
  }),

  visits: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const db = await databaseOrThrow();
      const [visitRows, customerRows, incomeRows] = await Promise.all([
        db.select().from(visits).where(eq(visits.ownerId, ctx.user.id)).orderBy(desc(visits.visitDate)),
        db.select().from(customers).where(eq(customers.ownerId, ctx.user.id)),
        db.select().from(cashTransactions).where(and(eq(cashTransactions.ownerId, ctx.user.id), eq(cashTransactions.transactionType, "income"))),
      ]);
      const customerById = new Map(customerRows.map(customer => [customer.id, customer]));
      const incomeByVisit = new Map(incomeRows.filter(row => row.sourceVisitId).map(row => [row.sourceVisitId!, row]));
      return visitRows.map(visit => {
        const customer = customerById.get(visit.customerId);
        const income = incomeByVisit.get(visit.id);
        return {
          ...visit,
          customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone, address: customer.address, latitude: customer.latitude, longitude: customer.longitude, manualCode: customer.manualCode } : null,
          collectedAmount: income?.amount ?? 0,
          collectedCurrency: income?.currency ?? "SAR",
        };
      });
    }),
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
      const customer = await getOwnedCustomer(ctx.user.id, input.customerId);
      const { clientOperationId, collectedAmount, collectedCurrency, ...visitData } = input;
      const visitResult = await db.insert(visits).values({ ...visitData, ownerId: ctx.user.id, clientOperationId });
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
      if (collectedAmount && collectedAmount > 0) {
        const existingIncome = await db.select().from(cashTransactions).where(and(eq(cashTransactions.ownerId, ctx.user.id), eq(cashTransactions.sourceVisitId, visitId))).limit(1);
        if (!existingIncome[0]) {
          const category = input.visitType === "installation" ? "تحصيل تركيب" : input.visitType === "maintenance" ? "تحصيل صيانة" : input.visitType === "cartridge_change" ? "تحصيل تغيير شمعات" : "تحصيل زيارة";
          await db.insert(cashTransactions).values({ ownerId: ctx.user.id, transactionType: "income", currency: collectedCurrency, amount: collectedAmount, category, transactionDate: input.visitDate, sourceVisitId: visitId, recipientName: input.technicianName ?? null, notes: input.technicianName ? `العميل: ${customer.name} | إيراد أُنشئ تلقائيًا من تسجيل الزيارة بواسطة ${input.technicianName}` : `العميل: ${customer.name} | إيراد أُنشئ تلقائيًا من تسجيل الزيارة` });
        }
      }
      await refreshOwnerBackup(ctx.user.id);
      return { id: visitId, reminderCreated: needsAutomaticReminder(input.visitType), alreadySynced: false };
    }),
    updateDate: protectedProcedure.input(z.object({ visitId: z.number().int().positive(), visitDate: z.date(), pin: sensitivePinInput.shape.pin })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      const existing = await db.select().from(visits).where(and(eq(visits.id, input.visitId), eq(visits.ownerId, ctx.user.id))).limit(1);
      if (!existing[0]) throw new TRPCError({ code: "NOT_FOUND", message: "الزيارة غير موجودة" });
      await db.update(visits).set({ visitDate: input.visitDate }).where(and(eq(visits.id, input.visitId), eq(visits.ownerId, ctx.user.id)));
      if (needsAutomaticReminder(existing[0].visitType)) {
        const pending = await db.select().from(reminders).where(and(eq(reminders.visitId, input.visitId), eq(reminders.ownerId, ctx.user.id), eq(reminders.status, "pending"))).limit(1);
        if (pending[0]) {
          await db.update(reminders).set({ reminderDate: followUpDate(input.visitDate) }).where(eq(reminders.id, pending[0].id));
        }
      }
      await db.update(cashTransactions).set({ transactionDate: input.visitDate }).where(and(eq(cashTransactions.sourceVisitId, input.visitId), eq(cashTransactions.ownerId, ctx.user.id)));
      await refreshOwnerBackup(ctx.user.id);
      return { success: true };
    }),
    delete: protectedProcedure.input(sensitivePinInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      await db.delete(visits).where(and(eq(visits.id, input.id), eq(visits.ownerId, ctx.user.id)));
      await refreshOwnerBackup(ctx.user.id);
      return { success: true };
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
    updateStatus: protectedProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["completed", "dismissed"]), pin: sensitivePinInput.shape.pin })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      const reminder = await db.select().from(reminders).where(and(eq(reminders.id, input.id), eq(reminders.ownerId, ctx.user.id))).limit(1);
      if (!reminder[0]) {
        throw new TRPCError({ code: "NOT_FOUND", message: "لم يتم العثور على التذكير." });
      }

      if (input.status === "completed") {
        const sourceVisit = await db.select().from(visits).where(and(
          eq(visits.id, reminder[0].visitId),
          eq(visits.ownerId, ctx.user.id),
        )).limit(1);
        if (sourceVisit[0] && needsAutomaticReminder(sourceVisit[0].visitType)) {
          const completedAt = new Date();
          const visitResult = await db.insert(visits).values({
            customerId: reminder[0].customerId,
            ownerId: ctx.user.id,
            visitType: sourceVisit[0].visitType,
            visitDate: completedAt,
            technicianName: sourceVisit[0].technicianName ?? null,
            notes: "تم تسجيل الزيارة من قائمة المتابعة.",
          });
          const visitId = Number(visitResult[0].insertId);
          await db.insert(reminders).values({
            customerId: reminder[0].customerId,
            visitId,
            ownerId: ctx.user.id,
            reminderDate: followUpDate(completedAt),
          });
        }
      }

      await db.update(reminders).set({ status: input.status }).where(and(eq(reminders.id, input.id), eq(reminders.ownerId, ctx.user.id)));
      await refreshOwnerBackup(ctx.user.id);
      return { success: true, nextVisitCreated: input.status === "completed" };
    }),
    delete: protectedProcedure.input(sensitivePinInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      await db.delete(reminders).where(and(eq(reminders.id, input.id), eq(reminders.ownerId, ctx.user.id)));
      await refreshOwnerBackup(ctx.user.id);
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
    saveSettings: protectedProcedure.input(notificationSettingsSaveInput).mutation(async ({ ctx, input }) => {
      await requirePinIfConfigured(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      const { pin: _pin, ...settingsInput } = input;
      await db.insert(notificationSettings).values({ ownerId: ctx.user.id, ...settingsInput }).onDuplicateKeyUpdate({ set: settingsInput });
      await refreshOwnerBackup(ctx.user.id);
      return getNotificationSettings(ctx.user.id);
    }),
    setPin: protectedProcedure.input(pinSetupInput).mutation(async ({ ctx, input }) => {
      const settings = await getNotificationSettingsRow(ctx.user.id);
      if (settings.pinHash) {
        if (!input.currentPin) throw new TRPCError({ code: "FORBIDDEN", message: "أدخل الرقم السري الحالي لتغييره." });
        await requirePin(ctx.user.id, input.currentPin);
      }
      const db = await databaseOrThrow();
      const pinHash = await hashPin(input.newPin);
      await db.insert(notificationSettings).values({ ownerId: ctx.user.id, ...defaultNotificationSettings, pinHash }).onDuplicateKeyUpdate({ set: { pinHash } });
      await refreshOwnerBackup(ctx.user.id);
      return { success: true };
    }),
    enableScheduledAlerts: protectedProcedure.input(notificationSettingsSaveInput).mutation(async ({ ctx, input }) => {
      await requirePinIfConfigured(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      const { pin: _pin, ...settingsInput } = input;
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      if (!sessionToken) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "سجّل الدخول لتفعيل التنبيهات التلقائية." });
      }
      await db.insert(notificationSettings).values({ ownerId: ctx.user.id, ...settingsInput }).onDuplicateKeyUpdate({ set: settingsInput });
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
      if (input.clientOperationId) {
        const existing = await db.select({ id: inventoryItems.id }).from(inventoryItems).where(and(eq(inventoryItems.ownerId, ctx.user.id), eq(inventoryItems.clientOperationId, input.clientOperationId))).limit(1);
        if (existing[0]) return { id: existing[0].id };
      }
      const result = await db.insert(inventoryItems).values({ ...input, ownerId: ctx.user.id });
      await refreshOwnerBackup(ctx.user.id);
      return { id: Number(result[0].insertId) };
    }),
    createMovement: adminProcedure.input(inventoryMovementInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      if (input.clientOperationId) {
        const existing = await db.select({ id: inventoryMovements.id }).from(inventoryMovements).where(and(eq(inventoryMovements.ownerId, ctx.user.id), eq(inventoryMovements.clientOperationId, input.clientOperationId))).limit(1);
        if (existing[0]) return { success: true, movementId: existing[0].id };
      }
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
      const movementResult = await db.insert(inventoryMovements).values({ ...input, ownerId: ctx.user.id });
      const movementId = Number(movementResult[0].insertId);
      if (input.movementType === "incoming" && input.unitCost > 0) {
        const purchaseAmount = input.quantity * input.unitCost;
        const existingPurchase = await db.select({ id: cashTransactions.id }).from(cashTransactions).where(and(eq(cashTransactions.ownerId, ctx.user.id), eq(cashTransactions.sourceInventoryMovementId, movementId))).limit(1);
        if (!existingPurchase[0]) {
          await db.insert(cashTransactions).values({
            ownerId: ctx.user.id,
            transactionType: "expense",
            currency: input.currency,
            amount: purchaseAmount,
            category: `شراء مخزون - ${item[0].name}`,
            transactionDate: input.movementDate,
            sourceInventoryMovementId: movementId,
            recipientName: "مشتريات",
            notes: input.notes || `شراء ${input.quantity} من ${item[0].name}`,
          });
        }
      }
      await refreshOwnerBackup(ctx.user.id);
      return { success: true, movementId };
    }),
    deleteItem: adminProcedure.input(sensitivePinInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      await db.delete(inventoryItems).where(and(eq(inventoryItems.id, input.id), eq(inventoryItems.ownerId, ctx.user.id)));
      await refreshOwnerBackup(ctx.user.id);
      return { success: true };
    }),
    deleteMovement: adminProcedure.input(sensitivePinInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      await db.delete(cashTransactions).where(and(eq(cashTransactions.sourceInventoryMovementId, input.id), eq(cashTransactions.ownerId, ctx.user.id)));
      await db.delete(inventoryMovements).where(and(eq(inventoryMovements.id, input.id), eq(inventoryMovements.ownerId, ctx.user.id)));
      await refreshOwnerBackup(ctx.user.id);
      return { success: true };
    }),
  }),

  backup: router({
    status: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getNotificationSettings(ctx.user.id);
      const stored = settings.backupFileKey ? await storageGet(settings.backupFileKey) : null;
      return { generatedAt: settings.backupGeneratedAt ?? null, downloadUrl: stored?.url ?? null };
    }),
    createNow: protectedProcedure.mutation(async ({ ctx }) => {
      const backup = await createOwnerBackup(ctx.user.id);
      if (!backup) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إنشاء النسخة الاحتياطية الآن." });
      return { generatedAt: backup.generatedAt, downloadUrl: backup.url, counts: backup.counts };
    }),
  }),

  cash: router({
    summary: adminProcedure.input(z.object({ incomeFilter: z.enum(["all", "service", "installation", "maintenance"]).default("all"), category: z.string().max(100).optional(), technician: z.string().max(160).optional(), partyType: z.enum(["all", "technician", "customer", "entity"]).default("all").optional(), itemName: z.string().max(160).optional(), month: z.string().regex(/^\d{4}-\d{2}$/).optional(), startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), search: z.string().max(160).optional() }).optional()).query(({ ctx, input }) => cashSummary(ctx.user.id, input?.incomeFilter ?? "all", input ? { month: input.month, startDate: input.startDate, endDate: input.endDate } : undefined, input?.search, { category: input?.category, technician: input?.technician, partyType: input?.partyType, itemName: input?.itemName })),
    create: adminProcedure.input(cashTransactionInput).mutation(async ({ ctx, input }) => {
      const db = await databaseOrThrow();
      if (input.clientOperationId) {
        const existing = await db.select({ id: cashTransactions.id }).from(cashTransactions).where(and(eq(cashTransactions.ownerId, ctx.user.id), eq(cashTransactions.clientOperationId, input.clientOperationId))).limit(1);
        if (existing[0]) return { id: existing[0].id };
      }
      const result = await db.insert(cashTransactions).values({ ...input, ownerId: ctx.user.id });
      await refreshOwnerBackup(ctx.user.id);
      return { id: Number(result[0].insertId) };
    }),
    delete: adminProcedure.input(sensitivePinInput.extend({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      await requirePin(ctx.user.id, input.pin);
      const db = await databaseOrThrow();
      await db.delete(cashTransactions).where(and(eq(cashTransactions.id, input.id), eq(cashTransactions.ownerId, ctx.user.id)));
      await refreshOwnerBackup(ctx.user.id);
      return { success: true };
    }),
  }),
});
