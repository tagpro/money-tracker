import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const transactions = sqliteTable("transactions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["deposit", "withdrawal", "interest"] }).notNull(),
  amount: real("amount").notNull(),
  date: text("date").notNull(),
  description: text("description"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const interestRates = sqliteTable("interest_rates", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rate: real("rate").notNull(),
  effectiveDate: text("effective_date").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const balanceSnapshots = sqliteTable("balance_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  date: text("date").notNull().unique(),
  balance: real("balance").notNull(),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
});

export const inviteCodes = sqliteTable("invite_codes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  email: text("email"),
  usedBy: text("used_by"),
  createdBy: text("created_by"),
  usedAt: text("used_at"),
  createdAt: text("created_at").default(sql`CURRENT_TIMESTAMP`),
  expiresAt: text("expires_at"),
});
