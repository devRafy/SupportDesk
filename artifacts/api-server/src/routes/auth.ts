import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, workspacesTable, faqsTable, cannedResponsesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { signToken, requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const router = Router();

const DEFAULT_FAQS = [
  { question: "What are your business hours?", answer: "We are available Monday through Friday, 9am to 6pm EST.", keywords: ["business", "hours", "open", "available", "schedule"] },
  { question: "How do I reset my password?", answer: "Click 'Forgot Password' on the login page and follow the instructions sent to your email.", keywords: ["reset", "password", "forgot", "login", "email"] },
  { question: "How do I contact support?", answer: "You can reach us via this chat, email at support@example.com, or call 1-800-SUPPORT.", keywords: ["contact", "support", "reach", "help", "phone", "email"] },
  { question: "What is your refund policy?", answer: "We offer a full refund within 30 days of purchase. No questions asked.", keywords: ["refund", "money", "back", "return", "cancel", "policy"] },
  { question: "How long does shipping take?", answer: "Standard shipping takes 5-7 business days. Express shipping is 2-3 business days.", keywords: ["shipping", "delivery", "ship", "arrive", "days", "fast"] },
  { question: "Do you offer a free trial?", answer: "Yes! We offer a 14-day free trial on all plans. No credit card required.", keywords: ["free", "trial", "try", "test", "demo", "card"] },
  { question: "Can I cancel my subscription?", answer: "You can cancel your subscription at any time from your account settings. No cancellation fees.", keywords: ["cancel", "subscription", "stop", "end", "terminate"] },
  { question: "Is my data secure?", answer: "We use industry-standard encryption (AES-256) for all data at rest and in transit.", keywords: ["data", "secure", "security", "safe", "encryption", "privacy"] },
  { question: "Do you have a mobile app?", answer: "Yes, our mobile app is available for iOS and Android. Search 'SupportDesk' in your app store.", keywords: ["mobile", "app", "ios", "android", "phone", "download"] },
  { question: "How do I upgrade my plan?", answer: "Go to Settings > Billing to view available plans and upgrade. Changes take effect immediately.", keywords: ["upgrade", "plan", "billing", "pro", "premium", "account"] },
];

const DEFAULT_CANNED = [
  { title: "Greeting", content: "Hi! Thanks for reaching out to us. How can I assist you today?" },
  { title: "Follow up", content: "I'll look into this right away and get back to you shortly." },
  { title: "Closing", content: "Is there anything else I can help you with? Have a great day!" },
];

router.post("/auth/register", async (req, res): Promise<void> => {
  const { name, email, password, workspaceName } = req.body;
  if (!name || !email || !password || !workspaceName) {
    res.status(400).json({ error: "All fields required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const hashed = await bcrypt.hash(password, 10);

  const [workspace] = await db.insert(workspacesTable).values({
    name: workspaceName,
    ownerId: 0,
  }).returning();

  const [user] = await db.insert(usersTable).values({
    name,
    email,
    password: hashed,
    role: "admin",
    workspaceId: workspace.id,
    isOnline: false,
  }).returning();

  await db.update(workspacesTable).set({ ownerId: user.id }).where(eq(workspacesTable.id, workspace.id));

  await db.insert(faqsTable).values(
    DEFAULT_FAQS.map((f) => ({ ...f, workspaceId: workspace.id }))
  );
  await db.insert(cannedResponsesTable).values(
    DEFAULT_CANNED.map((c) => ({ ...c, workspaceId: workspace.id }))
  );

  const token = signToken({ userId: user.id, workspaceId: workspace.id, role: user.role });
  const { password: _, ...safeUser } = user;
  res.status(201).json({ token, user: { ...safeUser, isOnline: false } });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = signToken({ userId: user.id, workspaceId: user.workspaceId, role: user.role });
  const { password: _, ...safeUser } = user;
  res.json({ token, user: safeUser });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) { res.status(401).json({ error: "Not found" }); return; }
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

router.get("/auth/agents", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const agents = await db.select().from(usersTable).where(eq(usersTable.workspaceId, req.user!.workspaceId));
  res.json(agents.map(({ password: _, ...u }) => u));
});

router.post("/auth/invite", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ error: "All fields required" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    name, email, password: hashed, role: "agent",
    workspaceId: req.user!.workspaceId, isOnline: false,
  }).returning();
  const { password: _, ...safeUser } = user;
  res.status(201).json(safeUser);
});

export default router;
