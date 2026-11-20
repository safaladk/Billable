# Billable: Product & Engineering Specification

Master context file for the AI coding IDE. Treat this document as the source of truth.
Read it fully before doing anything. Do not build everything at once. Work phase by phase.

---

## 1. What we are building

**Billable** is a multi-tenant invoicing SaaS for freelancers and small agencies.

A user signs up, creates an **organization**, invites teammates with different **roles**, adds **clients**, creates and sends **invoices**, and upgrades from a **Free** to a **Pro** plan through **Stripe** (test mode). Every important action is recorded in an **audit log**.

"Multi-tenant" means many organizations share one application and one database, but each organization can only ever see its own data. Guaranteeing that is the most important engineering concern in this project.

### Purpose of this project
This is a portfolio project for a developer targeting mid-level full-stack roles (frontend-leaning). It must demonstrate:
- Authentication and role-based authorization enforced in the backend
- Tenant data isolation
- Real business logic (invoice totals, controlled status transitions)
- Third-party integration (Stripe subscriptions and webhooks)
- Plan limits and audit logging
- Server-side pagination, filtering and search
- Tests on the rules that matter
- A deployed, documented, working product

The goal is a **working MVP, not a feature-complete product**. A small thing that works and can be explained beats a large thing that is half-finished.

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Monorepo | npm workspaces: `apps/web`, `apps/api` |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query |
| Forms/validation (web) | React Hook Form + Zod |
| Backend | NestJS, TypeScript, REST API under `/api/v1` |
| Validation (api) | class-validator + class-transformer DTOs |
| Database | PostgreSQL (hosted: Neon or Supabase) |
| ORM | Prisma with migrations |
| Auth | Email + password, argon2 or bcrypt, JWT stored in an httpOnly cookie |
| Payments | Stripe (test mode): Checkout + webhooks |
| PDF (optional, last) | `@react-pdf/renderer` or pdfkit |
| Email (optional, last) | Resend. Until then, invites produce a copyable link |
| Testing | Jest + Supertest (API integration tests against a real test database) |
| CI | GitHub Actions: lint, typecheck, test |
| Deployment | Vercel (web), Render or Railway (api) |

Do not add dependencies that are not needed. Do not introduce Redis, queues, Docker or microservices. They are out of scope.

### Cookie / CORS note
The web app and API will be on different domains in production. To avoid cross-site cookie problems, the Next.js app should proxy API calls through `rewrites` (`/api/*` → the API URL) so the browser only ever talks to one origin. Cookies are then first-party.

---

## 3. Repository structure

```
billable/
  apps/
    api/
      prisma/            schema.prisma, migrations/, seed.ts
      src/
        auth/            register, login, logout, me, JWT strategy
        users/
        organizations/   create/list orgs, org settings
        memberships/     members, role changes, removal
        invites/         create/accept/revoke invites
        clients/
        invoices/        CRUD, items, status transitions, totals
        billing/         Stripe checkout, portal, webhook, plan limits
        audit/           audit log writing + listing
        common/          guards, decorators, filters, pipes, pagination helpers
        main.ts
      test/              integration tests
    web/
      src/
        app/             routes (App Router)
        components/      shared UI
        features/        auth, orgs, clients, invoices, billing, audit
        hooks/
        lib/             api client, utils
  docs/
    PROGRESS.md
    DECISIONS.md
  BILLABLE_SPEC.md
  README.md
  package.json
```

The API and web app stay clearly separated. The frontend never touches the database.

---

## 4. Core concepts and rules

### 4.1 Tenant isolation (the most important rule)
- Every business table has an `organizationId` column.
- All org-scoped routes include the org in the URL: `/api/v1/orgs/:orgId/...`
- A **single guard** (`OrgMemberGuard`) runs on every org-scoped route. It:
  1. Reads the authenticated user from the JWT
  2. Loads the user's membership for `:orgId`
  3. Rejects with 403 if there is no membership
  4. Attaches `{ orgId, role }` to the request
- **Every database query for org data must filter by `organizationId`.** Never fetch by ID alone. Use `findFirst({ where: { id, organizationId } })`, not `findUnique({ where: { id } })`.
- Accessing another org's resource returns **404** (not 403), so resource existence is not leaked.
- Do not duplicate this logic in each controller. Centralize it.

### 4.2 Roles and permissions
Roles: `OWNER`, `ADMIN`, `MEMBER`. Enforced in the backend with a `@Roles()` decorator and a `RolesGuard`. Hiding buttons in the UI is a convenience only.

| Action | Owner | Admin | Member |
|---|:-:|:-:|:-:|
| View clients / invoices | ✅ | ✅ | ✅ |
| Create / edit clients | ✅ | ✅ | ✅ |
| Create / edit draft invoices | ✅ | ✅ | ✅ |
| Send invoice (DRAFT → SENT) | ✅ | ✅ | ❌ |
| Mark invoice paid / void | ✅ | ✅ | ❌ |
| Delete client or invoice | ✅ | ✅ | ❌ |
| Invite / remove members | ✅ | ✅ | ❌ |
| Change member roles | ✅ | ❌ | ❌ |
| View audit log | ✅ | ✅ | ❌ |
| Manage billing / change plan | ✅ | ❌ | ❌ |
| Delete organization | ✅ | ❌ | ❌ |

Rules:
- Every organization has exactly one or more owners. The last owner cannot be removed or demoted.
- A user can belong to multiple organizations with a different role in each.

### 4.3 Invoices
- Money is stored as **integers in the smallest currency unit** (cents). Never floats.
- Fields: number, client, issue date, due date, currency, status, notes, items (description, quantity, unit price), tax rate, computed totals.
- Totals (subtotal, tax, total) are **computed in the backend** and stored. The client never sends totals.
- Invoice numbers are sequential per organization (e.g. `INV-0001`) and unique on `(organizationId, number)`. Generate safely under concurrency (transaction or per-org counter row).
- Status flow (transitions are controlled; arbitrary status changes through the API are not allowed):

```
DRAFT ──send──▶ SENT ──pay──▶ PAID
  │               │
  └──void──▶ VOID ◀──void──┘
```
  - `OVERDUE` is **derived** (status is SENT and dueDate is in the past), not stored.
  - Only DRAFT invoices can be edited or deleted.
  - PAID and VOID are terminal.
  - A dedicated function/service holds the allowed-transitions map. Controllers call it. Do not scatter status checks.

### 4.4 Plans and limits
| | Free | Pro |
|---|---|---|
| Invoices created per calendar month | 5 | Unlimited |
| Team members | 3 | Unlimited |

- Limits are enforced in the backend, in a single `PlanLimitsService`. Exceeding a limit returns `402` or `403` with a clear error code like `PLAN_LIMIT_REACHED`.
- The frontend shows an upgrade prompt when it receives that code.

### 4.5 Stripe billing
- Stripe **test mode only**.
- Owner clicks Upgrade → API creates a Stripe Checkout Session (subscription) → redirect → Stripe redirects back.
- **Never trust the redirect.** Plan changes happen only from webhooks.
- Webhook endpoint must: use the raw request body, verify the Stripe signature, and be **idempotent** (store processed event IDs, ignore repeats).
- Handle at minimum: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`.
- Provide a Stripe Customer Portal link for managing/cancelling.

### 4.6 Invites
- Admin/Owner creates an invite (email + role). A random token is generated; **store only its hash**.
- The invite URL is shown for copying (email sending is optional, later).
- Invites expire after 7 days and can be revoked.
- Accepting requires login (or registration) and adds a Membership. An invite can be used once.
- Cannot invite someone to the OWNER role through invites (ownership transfer is out of scope).

### 4.7 Audit log
Record: organizationId, actorUserId, action, entityType, entityId, metadata (JSON), createdAt.

Log at minimum: invoice created/updated/sent/paid/voided/deleted, client created/updated/deleted, member invited/joined/removed/role changed, plan changed.

Audit log is append-only. Never log passwords, tokens or full card data.

### 4.8 Lists: pagination, filtering, search
- All list endpoints use **server-side** pagination. Never return all rows.
- Query params: `page`, `pageSize` (max 100), `sort`, `order`, plus filters.
- Always include a stable tiebreaker in sorting (e.g. `createdAt desc, id desc`).
- Response shape: `{ data: [...], meta: { page, pageSize, total, totalPages } }`
- Invoice filters: `status`, `clientId`, `from`/`to` (issue date), `q` (search by number or client name).

---

## 5. Data model (conceptual: refine when writing the Prisma schema)

- **User**: id, email (unique), passwordHash, name, createdAt
- **Organization**: id, name, slug (unique), plan (FREE | PRO), stripeCustomerId?, stripeSubscriptionId?, createdAt
- **Membership**: id, userId, organizationId, role. Unique on `(userId, organizationId)`
- **Invite**: id, organizationId, email, role, tokenHash (unique), expiresAt, acceptedAt?, revokedAt?, invitedById, createdAt
- **Client**: id, organizationId, name, email, company?, address?, createdAt. Index `(organizationId, createdAt)`
- **Invoice**: id, organizationId, clientId, number, status, currency, issueDate, dueDate, taxRateBps, subtotalCents, taxCents, totalCents, notes?, createdById, createdAt, updatedAt, sentAt?, paidAt?. Unique `(organizationId, number)`. Indexes on `(organizationId, status)` and `(organizationId, createdAt)`
- **InvoiceItem**: id, invoiceId, description, quantity, unitPriceCents, position
- **StripeEvent**: id (Stripe event id, primary key), processedAt (for webhook idempotency)
- **AuditLog**: id, organizationId, actorUserId, action, entityType, entityId, metadata (Json), createdAt. Index `(organizationId, createdAt)`

Use proper foreign keys, appropriate `onDelete` behavior, indexes, unique constraints and timestamps.

---

## 6. API endpoints (adjust if needed, but keep the conventions)

All under `/api/v1`. Consistent error shape: `{ statusCode, error, message, code? }`.

**Auth**
- `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`

**Organizations & members**
- `GET /orgs`, `POST /orgs`
- `GET /orgs/:orgId`, `PATCH /orgs/:orgId`, `DELETE /orgs/:orgId`
- `GET /orgs/:orgId/members`, `PATCH /orgs/:orgId/members/:memberId` (role), `DELETE /orgs/:orgId/members/:memberId`

**Invites**
- `POST /orgs/:orgId/invites`, `GET /orgs/:orgId/invites`, `DELETE /orgs/:orgId/invites/:inviteId`
- `POST /invites/accept` (body: token)

**Clients**
- `GET/POST /orgs/:orgId/clients`, `GET/PATCH/DELETE /orgs/:orgId/clients/:clientId`

**Invoices**
- `GET/POST /orgs/:orgId/invoices`
- `GET/PATCH/DELETE /orgs/:orgId/invoices/:invoiceId`
- `POST /orgs/:orgId/invoices/:invoiceId/send`
- `POST /orgs/:orgId/invoices/:invoiceId/pay`
- `POST /orgs/:orgId/invoices/:invoiceId/void`

**Audit**
- `GET /orgs/:orgId/audit-logs`

**Billing**
- `POST /orgs/:orgId/billing/checkout`, `POST /orgs/:orgId/billing/portal`
- `POST /billing/webhook` (public, signature-verified)
- `GET /orgs/:orgId/billing` (current plan + usage)

---

## 7. Security requirements
- Hash passwords with argon2 or bcrypt. Never store or log plaintext.
- JWT in an **httpOnly, Secure, SameSite** cookie. Short-ish expiry.
- Validate every request body, query param and ID (DTOs + `ParseUUIDPipe`).
- Whitelist DTO fields (`whitelist: true`, `forbidNonWhitelisted: true`).
- Rate limit auth endpoints (`@nestjs/throttler`).
- Configure CORS explicitly. Use `helmet`.
- Do not leak internal errors. Use a global exception filter.
- Never commit secrets. Provide `.env.example` files documenting every variable.
- Never log passwords, tokens, or Stripe secrets.

---

## 8. Testing requirements
Write meaningful tests against a real test database. Do not mock everything.

Must-have tests:
1. A user in org A **cannot** read, update or delete org B's clients or invoices (expect 404/403).
2. A MEMBER cannot send, delete, invite or view the audit log (expect 403).
3. An ADMIN cannot change roles or manage billing.
4. The last OWNER cannot be removed or demoted.
5. Invoice totals are calculated correctly (including tax and rounding).
6. Invalid invoice status transitions are rejected (e.g. PAID → DRAFT, editing a SENT invoice).
7. Free plan blocks the 6th invoice in a month; Pro does not.
8. An invite token works once, expires, and cannot be reused.
9. Stripe webhook with an invalid signature is rejected; a repeated event ID is processed only once.
10. Invoice list pagination, filtering and search return correct results scoped to the org.

---

## 9. Out of scope (do NOT build)
Real-time features, WebSockets, queues/Redis, microservices, multi-currency conversion, recurring invoices, payment collection from clients (Stripe is only for the SaaS subscription), file uploads, SSO, mobile apps, i18n, complex analytics, ownership transfer.

Optional later extras, only after everything above works: invoice PDF export, public shareable invoice link, invite emails via Resend, dashboard charts.

---

## 10. Development phases

Complete and verify each phase before starting the next.

### Phase 1: Foundation
- Create the monorepo (npm workspaces) with `apps/api` (NestJS) and `apps/web` (Next.js + Tailwind + shadcn/ui).
- Configure Prisma and connect to the hosted PostgreSQL database.
- `.env.example` for both apps. Global validation pipe, exception filter, `/api/v1` prefix, helmet, CORS.
- Next.js rewrites to proxy `/api/*` to the API.
- Health endpoint `GET /api/v1/health`, and a web page that calls it.
- **Done when:** both apps start with one command and the web page shows a successful health check.

### Phase 2: Auth and organizations
- Prisma schema for User, Organization, Membership. First migration.
- Register, login, logout, me. JWT cookie, password hashing, throttling on auth routes.
- Create organization (creator becomes OWNER). List my organizations.
- `OrgMemberGuard`, `RolesGuard`, `@Roles()` decorator.
- Web: register/login pages, protected layout, org switcher, create-org flow.
- **Done when:** a user can register, log in, create two orgs, switch between them, and gets 403 for an org they don't belong to.

### Phase 3: Clients and invoices (core product)
- Schema: Client, Invoice, InvoiceItem. Migration.
- Clients CRUD. Invoices CRUD with items, backend-computed totals, per-org sequential numbers.
- Status transitions via one service (send / pay / void). Edit/delete only for DRAFT.
- Paginated, filterable, searchable list endpoints.
- Web: clients page, invoices list (filters, search, pagination, loading/empty/error states), invoice form, invoice detail with status actions.
- **Done when:** a full invoice can be created, sent and marked paid, and the list filters work server-side.

### Phase 4: Team, roles and invites
- Schema: Invite. Members list, role change, removal (with last-owner protection).
- Create/revoke/accept invites with hashed tokens and expiry.
- Enforce the permission matrix on every relevant route.
- Web: members page, invite dialog with copyable link, accept-invite page, UI hides actions the role can't perform.
- **Done when:** a second account joins via an invite and its permissions match its role, verified at the API level.

### Phase 5: Audit log
- Schema: AuditLog. `AuditService.record(...)` called from services (not controllers).
- Log the events listed in section 4.7.
- Paginated audit log endpoint (Owner/Admin only) with filters by action and actor.
- Web: audit log page.
- **Done when:** actions across invoices, clients and members show up with the correct actor.

### Phase 6: Stripe billing and plan limits
- Schema additions: plan fields on Organization, StripeEvent.
- `PlanLimitsService` enforcing invoice/month and member limits.
- Checkout session, customer portal, webhook (raw body, signature check, idempotency).
- Web: billing page with current plan and usage, upgrade button, upgrade prompt when a limit is hit.
- Test locally with the Stripe CLI (`stripe listen --forward-to ...`).
- **Done when:** upgrading with a Stripe test card flips the org to PRO via the webhook and the limits lift.

### Phase 7: Tests and hardening
- Write the tests listed in section 8.
- Review: every org-scoped query filters by `organizationId`; every DTO validates; no secrets in logs.
- GitHub Actions workflow: install, lint, typecheck, test.
- **Done when:** CI is green and the isolation and permission tests pass.

### Phase 8: Deploy, polish, document
- Deploy the API (Render/Railway) and web (Vercel). Set environment variables. Run migrations on deploy.
- Seed script with a demo org, demo users per role, and sample clients/invoices.
- Responsive pass, consistent loading/empty/error states.
- README: what it is, screenshots, architecture diagram, feature list, how to run locally, env variables, demo credentials, **"Design decisions"** section (tenant isolation, money as cents, webhook idempotency, derived overdue status).
- Optional extras if time remains (see section 9).
- **Done when:** a stranger can open the live link, log in with demo credentials, and see a working product.

---

## 11. Working rules for the AI IDE

1. Work in small milestones. Do not generate the whole app at once.
2. Before each phase: explain what you will build, list files to create or change, and list commands to run.
3. Use **Windows PowerShell-compatible** commands.
4. Strict TypeScript. Avoid `any`.
5. Follow NestJS conventions (modules, controllers, services, DTOs, guards) and Next.js App Router conventions.
6. **No business logic in controllers.** Put it in services. Do not duplicate it.
7. Use Prisma migrations. Never edit the database manually.
8. Use transactions where multiple writes must succeed together (invoice + items, number generation, accepting invites).
9. Respect tenant isolation in every query. This is non-negotiable.
10. Do not build anything listed as out of scope.
11. Do not add dependencies without saying why.
12. Never fabricate data in dashboards or lists. Everything comes from the backend.
13. Explain important engineering decisions briefly, and append them to `docs/DECISIONS.md`.
14. Make sure the code runs and typechecks before moving on. Do not claim something works unless it was verified.
15. After each phase, update `docs/PROGRESS.md` with: completed phases, current phase, files created/modified, tests added, known bugs, outstanding tasks.
16. Prefer simple solutions that can be improved later.

---

## 12. First instruction to give the IDE

Paste this as your first message after saving this file as `BILLABLE_SPEC.md` in an empty project folder:

> Read BILLABLE_SPEC.md in its entirety. It defines the product, scope, rules and phases for the project we are building from scratch.
>
> Do not generate the whole application. Start with **Phase 1 only**.
>
> Before writing any code, give me:
> 1. The exact folder structure you will create.
> 2. The tools and dependencies you will use, and why.
> 3. The commands I need to run (PowerShell-compatible), and what each does.
> 4. The files you will create or modify.
> 5. How we will verify Phase 1 works.
>
> Wait for my approval before running or writing anything. Do not start Phase 2 until I confirm Phase 1 is verified.

For each later phase, use:

> Phase N is verified. Move on to Phase N+1 only. Before coding, explain the plan, the files you'll touch, and any decisions I should understand. Afterwards, update docs/PROGRESS.md and docs/DECISIONS.md.
