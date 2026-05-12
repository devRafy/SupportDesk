import { Router } from "express";
import { db, faqsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/faqs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const faqs = await db.select().from(faqsTable).where(eq(faqsTable.workspaceId, req.user!.workspaceId));
  res.json(faqs);
});

router.post("/faqs", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { question, answer, keywords } = req.body;
  if (!question || !answer) { res.status(400).json({ error: "question and answer required" }); return; }
  const [faq] = await db.insert(faqsTable).values({
    workspaceId: req.user!.workspaceId,
    question,
    answer,
    keywords: keywords || [],
  }).returning();
  res.status(201).json(faq);
});

router.patch("/faqs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { question, answer, keywords } = req.body;
  const updates: Record<string, unknown> = {};
  if (question) updates.question = question;
  if (answer) updates.answer = answer;
  if (keywords) updates.keywords = keywords;
  const [faq] = await db.update(faqsTable).set(updates)
    .where(and(eq(faqsTable.id, id), eq(faqsTable.workspaceId, req.user!.workspaceId))).returning();
  if (!faq) { res.status(404).json({ error: "Not found" }); return; }
  res.json(faq);
});

router.delete("/faqs/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(faqsTable).where(and(eq(faqsTable.id, id), eq(faqsTable.workspaceId, req.user!.workspaceId)));
  res.sendStatus(204);
});

export default router;
