# SupportDesk

Real-time customer support SaaS platform with embeddable chat widget, agent inbox, FAQ bot, analytics, and Stripe billing.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/support-desk run dev` — run the frontend (port 22289)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + Socket.io
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + Wouter + shadcn/ui + Tailwind CSS v4
- Payments: Stripe (apiVersion: `2026-04-22.dahlia`)

## Where things live

- `artifacts/api-server/src/` — Express server
  - `routes/auth.ts` — register, login, me, invite agent
  - `routes/conversations.ts` — CRUD + assign/status
  - `routes/messages.ts` — send, list, mark-read + bot reply
  - `routes/faqs.ts` — FAQ CRUD
  - `routes/canned.ts` — canned response CRUD
  - `routes/analytics.ts` — summary + agent activity
  - `routes/billing.ts` — Stripe checkout/portal/webhook
  - `routes/workspace.ts` — workspace info + public endpoint
  - `lib/socket.ts` — Socket.io event handlers
  - `lib/botReply.ts` — keyword-based FAQ bot
  - `lib/auth.ts` — JWT sign/verify + requireAuth middleware
- `artifacts/support-desk/src/` — React frontend
  - `pages/login.tsx` — login page
  - `pages/register.tsx` — register + workspace creation
  - `pages/dashboard.tsx` — agent inbox with real-time chat
  - `pages/analytics.tsx` — analytics dashboard (Recharts)
  - `pages/settings.tsx` — workspace/agents/FAQs/canned/billing
  - `pages/widget.tsx` — embeddable chat widget
  - `components/layout.tsx` — sidebar navigation
  - `lib/auth.tsx` — AuthContext + useAuth
  - `lib/socket.ts` — Socket.io client singleton
- `lib/db/src/schema/index.ts` — DB schema (users, workspaces, conversations, messages, faqs, canned_responses)
- `lib/api-spec/` — OpenAPI spec (source of truth for API contracts)
- `lib/api-client-react/src/generated/` — generated hooks + schemas

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → React Query hooks
- bcryptjs instead of bcrypt (native build blocked in Replit)
- Socket.io path `/api/socket.io` (goes through shared proxy)
- Auth token stored in `localStorage` as `support_desk_token`, injected via `setAuthTokenGetter` in main.tsx
- Conversation statuses: `open`, `in_progress`, `resolved` (NOT "pending")
- Message fields: `content`, `senderType` (`visitor`|`agent`|`bot`), `sender` (display name)

## Product

- **Login/Register** — JWT auth, admin creates workspace, agent is invited
- **Dashboard** — Inbox with status filters (Open/Active/Done/All), real-time messages via Socket.io, canned responses, assign & resolve
- **Widget** — Embeddable at `/widget/:workspaceId`, visitor fills name+email, messages auto-refresh + bot replies to keywords
- **Analytics** — Today/week stats, status pie chart, bot vs agent bar chart, agent activity list
- **Settings** — Workspace name, invite agents, embed widget snippet, FAQ CRUD, canned response CRUD, Stripe billing (free/pro)

## Demo credentials

- admin@acme.com / demo1234 (admin role)
- agent@acme.com / demo1234 (agent role)
- Workspace: Acme Corp (id=1)

## User preferences

- Use `content` (not `body`) for message text field
- Use `visitorName`/`visitorEmail` (not `customerName`/`customerEmail`) for conversation visitor fields

## Gotchas

- Always rebuild libs (`pnpm run typecheck:libs`) after changing DB schema or API spec before running frontend typecheck
- Stripe API version must match installed stripe package: `2026-04-22.dahlia` for stripe@22.1.1
- The bcrypt hash in seed data must be generated with bcryptjs (not bcrypt native)
- Socket.io emits `new_message` with `{ conversationId }` — agents listen for this to refresh
- Widget page fetches workspace info directly via `/api/workspace/:id/public` (unauthenticated)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
