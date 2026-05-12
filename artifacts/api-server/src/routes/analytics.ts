import { Router } from "express";
import { db, conversationsTable, messagesTable, usersTable } from "@workspace/db";
import { eq, and, gte, count, sql } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/analytics/summary", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const wid = req.user!.workspaceId;
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 7);

  const allConvs = await db.select().from(conversationsTable).where(eq(conversationsTable.workspaceId, wid));

  const totalToday = allConvs.filter((c) => c.createdAt >= todayStart).length;
  const totalThisWeek = allConvs.filter((c) => c.createdAt >= weekStart).length;
  const resolved = allConvs.filter((c) => c.status === "resolved").length;
  const resolutionRate = allConvs.length > 0 ? (resolved / allConvs.length) * 100 : 0;

  const byStatusMap: Record<string, number> = {};
  for (const conv of allConvs) {
    byStatusMap[conv.status] = (byStatusMap[conv.status] || 0) + 1;
  }
  const byStatus = Object.entries(byStatusMap).map(([status, count]) => ({ status, count }));

  const allMessages = await db.select().from(messagesTable)
    .where(sql`${messagesTable.conversationId} IN (SELECT id FROM conversations WHERE workspace_id = ${wid})`);

  const botCount = allMessages.filter((m) => m.senderType === "bot").length;
  const agentCount = allMessages.filter((m) => m.senderType === "agent").length;
  const botVsAgent = [
    { type: "Bot", count: botCount },
    { type: "Agent", count: agentCount },
  ];

  const firstMessages = await db.select().from(messagesTable)
    .where(sql`${messagesTable.conversationId} IN (SELECT id FROM conversations WHERE workspace_id = ${wid}) AND ${messagesTable.senderType} = 'agent'`);

  let avgFirstResponseMs: number | null = null;
  if (firstMessages.length > 0) {
    const convFirstResponse: Record<number, Date> = {};
    for (const msg of firstMessages) {
      if (!convFirstResponse[msg.conversationId] || msg.createdAt < convFirstResponse[msg.conversationId]) {
        convFirstResponse[msg.conversationId] = msg.createdAt;
      }
    }
    const convFirstVisitor: Record<number, Date> = {};
    const visitorMsgs = allMessages.filter((m) => m.senderType === "visitor");
    for (const msg of visitorMsgs) {
      if (!convFirstVisitor[msg.conversationId] || msg.createdAt < convFirstVisitor[msg.conversationId]) {
        convFirstVisitor[msg.conversationId] = msg.createdAt;
      }
    }
    const diffs: number[] = [];
    for (const [convId, agentTime] of Object.entries(convFirstResponse)) {
      const visitorTime = convFirstVisitor[Number(convId)];
      if (visitorTime) {
        diffs.push(agentTime.getTime() - visitorTime.getTime());
      }
    }
    if (diffs.length > 0) {
      avgFirstResponseMs = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    }
  }

  res.json({ totalToday, totalThisWeek, avgFirstResponseMs, resolutionRate, byStatus, botVsAgent });
});

router.get("/analytics/agents", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const wid = req.user!.workspaceId;
  const agents = await db.select().from(usersTable).where(eq(usersTable.workspaceId, wid));
  const convs = await db.select().from(conversationsTable).where(eq(conversationsTable.workspaceId, wid));

  const result = agents.map((agent) => ({
    agentId: agent.id,
    name: agent.name,
    email: agent.email,
    conversationCount: convs.filter((c) => c.assignedAgentId === agent.id).length,
    isOnline: agent.isOnline,
  }));

  res.json(result);
});

export default router;
