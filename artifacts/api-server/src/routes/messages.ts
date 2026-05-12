import { Router } from "express";
import { db, messagesTable, conversationsTable, usersTable, faqsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { botReply } from "../lib/botReply.js";
import { getIo } from "../lib/socket.js";

const router = Router();

router.get("/conversations/:id/messages", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(asc(messagesTable.createdAt));
  res.json(msgs);
});

router.post("/conversations/:id/messages", async (req, res): Promise<void> => {
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
  if (io) {
    io.to(`conversation:${conversationId}`).emit("message:receive", msg);
  }

  if (senderType === "visitor") {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, conversationId));
    if (conv) {
      const agents = await db.select().from(usersTable)
        .where(and(eq(usersTable.workspaceId, conv.workspaceId), eq(usersTable.isOnline, true)));
      const hasOnlineAgent = agents.length > 0;

      if (!hasOnlineAgent || !conv.assignedAgentId) {
        const faqs = await db.select().from(faqsTable).where(eq(faqsTable.workspaceId, conv.workspaceId));
        const botAnswer = botReply(content, faqs);
        const [botMsg] = await db.insert(messagesTable).values({
          conversationId,
          sender: "bot",
          senderType: "bot",
          content: botAnswer,
          seen: false,
        }).returning();
        if (io) {
          io.to(`conversation:${conversationId}`).emit("message:receive", botMsg);
        }
      }
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
