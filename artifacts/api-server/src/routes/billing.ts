import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { db, workspacesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, type AuthRequest } from "../lib/auth.js";
import { logger } from "../lib/logger.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    features: ["1 agent", "100 conversations/month", "10 FAQ entries", "Chat widget", "Basic analytics"],
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    features: ["Unlimited agents", "Unlimited conversations", "Unlimited FAQ entries", "Priority support", "Advanced analytics", "Canned responses", "Custom widget color"],
  },
];

const router = Router();

router.get("/billing/plans", async (_req, res): Promise<void> => {
  res.json(PLANS);
});

router.post("/billing/checkout", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const { successUrl, cancelUrl } = req.body;
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, req.user!.workspaceId));
  if (!workspace) { res.status(404).json({ error: "Workspace not found" }); return; }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: "SupportDesk Pro" },
          unit_amount: 1900,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { workspaceId: String(workspace.id) },
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Stripe checkout error");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/billing/portal", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [workspace] = await db.select().from(workspacesTable).where(eq(workspacesTable.id, req.user!.workspaceId));
  if (!workspace?.stripeCustomerId) {
    res.status(400).json({ error: "No billing account found" });
    return;
  }
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: workspace.stripeCustomerId,
      return_url: req.headers.origin || "https://example.com",
    });
    res.json({ url: session.url });
  } catch (err) {
    logger.error({ err }, "Stripe portal error");
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

router.post("/billing/webhook", async (req: Request, res: Response): Promise<void> => {
  const sig = req.headers["stripe-signature"] as string;
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    logger.warn({ err }, "Invalid webhook signature");
    res.status(400).send("Webhook error");
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const workspaceId = Number(session.metadata?.workspaceId);
    if (workspaceId) {
      await db.update(workspacesTable).set({
        plan: "pro",
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
      }).where(eq(workspacesTable.id, workspaceId));
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const rows = await db.select().from(workspacesTable).where(eq(workspacesTable.stripeSubscriptionId, sub.id));
    if (rows[0]) {
      await db.update(workspacesTable).set({ plan: "free" }).where(eq(workspacesTable.id, rows[0].id));
    }
  }

  res.json({ received: true });
});

export default router;
