import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cannedResponsesTable = pgTable("canned_responses", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCannedResponseSchema = createInsertSchema(cannedResponsesTable).omit({ id: true, createdAt: true });
export type InsertCannedResponse = z.infer<typeof insertCannedResponseSchema>;
export type CannedResponse = typeof cannedResponsesTable.$inferSelect;
