# Project Progress

## Current Status
- **Current Phase**: Phase 1: Foundation (Completed & Verified)
- **Next Phase**: Phase 2: Auth and Organizations

## Phases Summary
- [x] **Phase 1: Foundation**: Monorepo setup, NestJS `/api/v1` base, Next.js App router + Tailwind, Next.js rewrite proxy, health check endpoint.
- [ ] **Phase 2: Auth and Organizations**: User, Org, Membership schema, JWT httpOnly cookie auth, OrgMemberGuard, RolesGuard.
- [ ] **Phase 3: Clients and Invoices**: Clients & Invoices CRUD, computed totals, status transitions, server-side pagination/filtering/search.
- [ ] **Phase 4: Team, Roles, and Invites**: Member invites, hashed token flow, permissions matrix.
- [ ] **Phase 5: Audit Log**: AuditLog schema, append-only logger for critical actions, audit viewer.
- [ ] **Phase 6: Stripe Billing and Plan Limits**: Free vs Pro limits, Stripe checkout, webhooks, portal.
- [ ] **Phase 7: Tests and Hardening**: Integration tests, tenant isolation tests, GitHub Actions CI.
- [ ] **Phase 8: Deploy, Polish, Document**: Production deployment, seed scripts, docs and architectural writeups.

## Phase 1 Details
### Files Created / Modified
- `package.json`: Root npm workspaces configuration with unified `dev`, `build`, `lint` scripts.
- `.gitignore`: Standard monorepo ignore rules (node_modules, dist, .next, .env, etc.).
- `docs/PROGRESS.md`: Phase status tracking.
- `docs/DECISIONS.md`: Monorepo, rewrites proxy, and security architectural decisions.
- `apps/api/`:
  - `src/main.ts`: Configured `/api/v1` prefix, Helmet headers, CORS, global ValidationPipe (whitelist/transform), HttpExceptionFilter.
  - `src/app.module.ts`: Global ConfigModule and HealthModule.
  - `src/health/health.controller.ts`: Health check controller mapping `GET /api/v1/health`.
  - `src/health/health.service.ts`: Health check service returning uptime and timestamp.
  - `src/health/health.module.ts`: Health feature module.
  - `src/common/filters/http-exception.filter.ts`: Centralized exception filter formatting errors uniformly `{ statusCode, error, message, timestamp, path }`.
  - `prisma/schema.prisma`: Configured for PostgreSQL datasource with Prisma client generator.
  - `.env.example` & `.env`: Port (4000), database URL placeholder, CORS origins.
- `apps/web/`:
  - `next.config.ts`: Configured Next.js rewrites to proxy `/api/*` to NestJS on port 4000.
  - `src/app/page.tsx`: Client dashboard with live health verification status and architectural checklist.
  - `src/app/layout.tsx`: Root layout with font and metadata configurations.
  - `src/lib/utils.ts`: Tailwind CSS class-merge helper (`cn`).
  - `.env.example` & `.env.local`: App and internal API URLs.

### Verification Done
- Both `apps/api` and `apps/web` compile and build cleanly via `npm run build`.
- Direct endpoint check: `GET http://localhost:4000/api/v1/health` returns HTTP 200 with `{ status: "ok", service: "billable-api" }`.
- Proxy rewrite check: `GET http://localhost:3000/api/v1/health` forwards through Next.js to the API and returns identical HTTP 200 payload.
- Frontend rendering check: `GET http://localhost:3000` responds with HTTP 200 OK.

### Known Bugs / Notes
- None. Database connection string will be connected in Phase 2 when database is provisioned.

### Outstanding Tasks for Phase 2
- Provision hosted PostgreSQL database (Neon or Supabase).
- Define Prisma schema for `User`, `Organization`, `Membership`.
- Run first Prisma migration.
- Implement auth (register, login, logout, me) with argon2/bcrypt and httpOnly JWT cookies.
- Implement `OrgMemberGuard` and `RolesGuard`.
