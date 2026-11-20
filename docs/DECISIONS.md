# Architectural & Engineering Decisions

## 1. Monorepo Architecture
- **Decision**: Use native npm workspaces (`apps/*`) rather than Lerna, Turborepo, or Nx.
- **Reasoning**: Keeps tooling minimal, predictable, and aligned with standard Node.js without unnecessary abstraction layers.

## 2. API Proxy via Next.js Rewrites
- **Decision**: Configure Next.js rewrites in `apps/web` to proxy `/api/*` to the NestJS backend (`apps/api`).
- **Reasoning**: Ensures all browser requests communicate with a single origin (first-party domain), preventing cross-site cookie restrictions on httpOnly JWT auth cookies in production and local development.

## 3. Strict Layering & Separation of Concerns
- **Decision**: Keep `apps/api` and `apps/web` strictly separated. The web application never accesses database clients directly.
- **Reasoning**: Guarantees backend-enforced authorization, validation, and multi-tenant isolation.
