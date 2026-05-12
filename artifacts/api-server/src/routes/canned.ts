import { Router } from "express";
import { db, cannedResponsesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/canned", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const items = await db.select().from(cannedResponsesTable).where(eq(cannedResponsesTable.workspaceId, req.user!.workspaceId));
  res.json(items);
});

router.post("/canned", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { title, content } = req.body;
  if (!title || !content) { res.status(400).json({ error: "title and content required" }); return; }
  const [item] = await db.insert(cannedResponsesTable).values({
    workspaceId: req.user!.workspaceId,
    title,
    content,
  }).returning();
  res.status(201).json(item);
});

router.patch("/canned/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { title, content } = req.body;
  const updates: Record<string, string> = {};
  if (title) updates.title = title;
  if (content) updates.content = content;
  const [item] = await db.update(cannedResponsesTable).set(updates)
    .where(and(eq(cannedResponsesTable.id, id), eq(cannedResponsesTable.workspaceId, req.user!.workspaceId))).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json(item);
});

router.delete("/canned/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  await db.delete(cannedResponsesTable).where(
    and(eq(cannedResponsesTable.id, id), eq(cannedResponsesTable.workspaceId, req.user!.workspaceId))
  );
  res.sendStatus(204);
});

export default router;
