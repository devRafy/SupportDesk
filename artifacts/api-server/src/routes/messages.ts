import { Router } from "express";
import { db, messagesTable, conversationsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { optionalAuth, type AuthRequest } from "../lib/auth.js";
import { getIo } from "../lib/socket.js";

const router = Router();

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));
  res.json(msgs);
});

router.post("/conversations/:id/messages", optionalAuth, async (req: AuthRequest, res): Promise<void> => {
  const conversationId = Number(req.params.id);
  const { content, senderType, sender } = req.body;
  if (content == null || !senderType) {
    res.status(400).json({ error: "content and senderType required" });
    return;
  }

  const [msg] = await db.insert(messagesTable).values({
    conversationId,
    sender: sender || senderType,
    senderType,
    content,
    seen: false,
  }).returning();

  await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));

  const io = getIo();

  // Emit to agents watching this specific conversation
  if (io) {
    io.to(`conversation:${conversationId}`).emit("message:receive", msg);
  }

  // Look up the conversation to get workspaceId and current assignment
  const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
  if (conv && io) {
    // Broadcast to all workspace agents so inboxes refresh
    io.to(`workspace:${conv.workspaceId}`).emit("new_message", { conversationId });

    // Auto-claim: if an authenticated agent replies to an unassigned conversation, assign it to them
    if (senderType === "agent" && req.user && !conv.assignedAgentId) {
      await db.update(conversationsTable)
        .set({ assignedAgentId: req.user.userId, status: "in_progress" })
        .where(eq(conversationsTable.id, conversationId));

      io.to(`workspace:${conv.workspaceId}`).emit("conversation:claimed", {
        conversationId,
        agentId: req.user.userId,
      });
    }
  }

  res.status(201).json(msg);
});

router.patch("/conversations/:id/messages/read", async (req, res): Promise<void> => {
  const conversationId = Number(req.params.id);
  await db.update(messagesTable).set({ seen: true }).where(
    and(eq(messagesTable.conversationId, conversationId), eq(messagesTable.seen, false))
  );
  res.json({ ok: true });
});

export default router;
