import { Router } from "express";
import { db, conversationsTable, messagesTable, usersTable, faqsTable } from "@workspace/db";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { botReply } from "../lib/botReply.js";
import { getIo } from "../lib/socket.js";

const router = Router();

router.get("/conversations", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { status } = req.query;
  const wid = req.user!.workspaceId;

  let rows = await db.select().from(conversationsTable)
    .where(status
      ? and(eq(conversationsTable.workspaceId, wid), eq(conversationsTable.status, status as string))
      : eq(conversationsTable.workspaceId, wid))
    .orderBy(desc(conversationsTable.updatedAt));

  const enriched = await Promise.all(rows.map(async (conv) => {
    const msgs = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, conv.id))
      .orderBy(desc(messagesTable.createdAt)).limit(1);
    const unreadCount = await db.select({ c: count() }).from(messagesTable)
      .where(and(eq(messagesTable.conversationId, conv.id), eq(messagesTable.seen, false)));
    let assignedAgent = null;
    if (conv.assignedAgentId) {
      const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, conv.assignedAgentId));
      if (agent) {
        const { password: _, ...safe } = agent;
        assignedAgent = safe;
      }
    }
    return {
      ...conv,
      lastMessage: msgs[0]?.content ?? null,
      unreadCount: unreadCount[0]?.c ?? 0,
      assignedAgent,
    };
  }));

  res.json(enriched);
});

router.post("/conversations", async (req, res): Promise<void> => {
  const { workspaceId, visitorName, visitorEmail, sourcePage, browser } = req.body;
  if (!workspaceId || !visitorName || !visitorEmail) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const [conv] = await db.insert(conversationsTable).values({
    workspaceId: Number(workspaceId),
    visitorName,
    visitorEmail,
    sourcePage: sourcePage || "",
    browser: browser || null,
    status: "open",
  }).returning();

  const io = getIo();
  if (io) {
    io.to(`workspace:${workspaceId}`).emit("conversation:new", {
      ...conv,
      lastMessage: null,
      unreadCount: 0,
    });
    io.to(`workspace:${workspaceId}`).emit("notify:new", conv);
  }

  res.status(201).json({ ...conv, lastMessage: null, unreadCount: 0, assignedAgent: null });
});

router.get("/conversations/:id", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const [conv] = await db.select().from(conversationsTable)
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.workspaceId, req.user!.workspaceId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  const msgs = await db.select().from(messagesTable)
    .where(eq(messagesTable.conversationId, id))
    .orderBy(desc(messagesTable.createdAt)).limit(1);
  const unreadCount = await db.select({ c: count() }).from(messagesTable)
    .where(and(eq(messagesTable.conversationId, id), eq(messagesTable.seen, false)));
  let assignedAgent = null;
  if (conv.assignedAgentId) {
    const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, conv.assignedAgentId));
    if (agent) { const { password: _, ...safe } = agent; assignedAgent = safe; }
  }

  res.json({ ...conv, lastMessage: msgs[0]?.content ?? null, unreadCount: unreadCount[0]?.c ?? 0, assignedAgent });
});

router.patch("/conversations/:id/status", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!status) { res.status(400).json({ error: "Status required" }); return; }

  const [conv] = await db.update(conversationsTable).set({ status }).where(
    and(eq(conversationsTable.id, id), eq(conversationsTable.workspaceId, req.user!.workspaceId))
  ).returning();
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  const io = getIo();
  if (io) io.to(`conversation:${id}`).emit("conversation:resolve", conv);

  res.json({ ...conv, lastMessage: null, unreadCount: 0, assignedAgent: null });
});

router.patch("/conversations/:id/assign", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const id = Number(req.params.id);
  const { agentId } = req.body;
  if (!agentId) { res.status(400).json({ error: "agentId required" }); return; }

  const [conv] = await db.update(conversationsTable)
    .set({ assignedAgentId: Number(agentId), status: "in_progress" })
    .where(and(eq(conversationsTable.id, id), eq(conversationsTable.workspaceId, req.user!.workspaceId)))
    .returning();
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }

  let assignedAgent = null;
  const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, Number(agentId)));
  if (agent) { const { password: _, ...safe } = agent; assignedAgent = safe; }

  res.json({ ...conv, lastMessage: null, unreadCount: 0, assignedAgent });
});

export default router;
