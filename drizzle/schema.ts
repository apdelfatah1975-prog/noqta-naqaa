import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const visitTypeValues = [
  "installation",
  "maintenance",
  "cartridge_change",
  "follow_up",
  "other",
] as const;

export const customers = mysqlTable(
  "customers",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }).notNull(),
    address: text("address"),
    latitude: varchar("latitude", { length: 32 }),
    longitude: varchar("longitude", { length: 32 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("customers_owner_idx").on(table.ownerId), index("customers_phone_idx").on(table.phone)],
);

export const visits = mysqlTable(
  "visits",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    visitType: mysqlEnum("visitType", visitTypeValues).notNull(),
    visitDate: timestamp("visitDate").notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("visits_owner_date_idx").on(table.ownerId, table.visitDate),
    index("visits_customer_idx").on(table.customerId),
  ],
);

export const reminders = mysqlTable(
  "reminders",
  {
    id: int("id").autoincrement().primaryKey(),
    customerId: int("customerId").notNull().references(() => customers.id, { onDelete: "cascade" }),
    visitId: int("visitId").notNull().references(() => visits.id, { onDelete: "cascade" }),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    reminderDate: timestamp("reminderDate").notNull(),
    status: mysqlEnum("status", ["pending", "completed", "dismissed"]).default("pending").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("reminders_owner_status_date_idx").on(table.ownerId, table.status, table.reminderDate),
    index("reminders_customer_idx").on(table.customerId),
  ],
);

export const inventoryItems = mysqlTable(
  "inventoryItems",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    openingQuantity: int("openingQuantity").default(0).notNull(),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("inventory_items_owner_idx").on(table.ownerId)],
);

export const inventoryMovements = mysqlTable(
  "inventoryMovements",
  {
    id: int("id").autoincrement().primaryKey(),
    inventoryItemId: int("inventoryItemId").notNull().references(() => inventoryItems.id, { onDelete: "cascade" }),
    ownerId: int("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
    movementType: mysqlEnum("movementType", ["incoming", "outgoing"]).notNull(),
    quantity: int("quantity").notNull(),
    movementDate: timestamp("movementDate").notNull(),
    technicianName: varchar("technicianName", { length: 160 }),
    notes: text("notes"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("inventory_movements_item_idx").on(table.inventoryItemId),
    index("inventory_movements_owner_date_idx").on(table.ownerId, table.movementDate),
  ],
);
