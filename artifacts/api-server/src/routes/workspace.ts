import { Router } from "express";
import { db, workspacesTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";

const router = Router();

router.get("/workspace", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, req.user!.workspaceId));
  if (!workspace) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json(workspace);
});

router.patch("/workspace", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { name, widgetColor, greetingMessage, botName } = req.body;
  const updates: Record<string, string> = {};
  if (name) updates.name = name;
  if (widgetColor) updates.widgetColor = widgetColor;
  if (greetingMessage) updates.greetingMessage = greetingMessage;
  if (botName) updates.botName = botName;

  const [workspace] = await db.update(workspacesTable).set(updates)
    .where(eq(workspacesTable.id, req.user!.workspaceId)).returning();
  if (!workspace) { res.status(404).json({ error: "Workspace not found" }); return; }
  res.json(workspace);
});

router.get("/workspace/public/:workspaceId", async (req, res): Promise<void> => {
  const workspaceId = Number(req.params.workspaceId);
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, workspaceId));
  if (!workspace) { res.status(404).json({ error: "Workspace not found" }); return; }

  const agents = await db.select().from(usersTable)
    .where(eq(usersTable.workspaceId, workspaceId));
  const agentsOnline = agents.some((a) => a.isOnline);

  res.json({
    id: workspace.id,
    name: workspace.name,
    widgetColor: workspace.widgetColor,
    greetingMessage: workspace.greetingMessage,
    botName: workspace.botName,
    agentsOnline,
  });
});

export default router;
