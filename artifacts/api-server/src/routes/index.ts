import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import conversationsRouter from "./conversations.js";
import messagesRouter from "./messages.js";
import workspaceRouter from "./workspace.js";
import faqsRouter from "./faqs.js";
import cannedRouter from "./canned.js";
import analyticsRouter from "./analytics.js";
import billingRouter from "./billing.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(conversationsRouter);
router.use(messagesRouter);
router.use(workspaceRouter);
router.use(faqsRouter);
router.use(cannedRouter);
router.use(analyticsRouter);
router.use(billingRouter);

export default router;
