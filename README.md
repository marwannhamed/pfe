<div align="center">

# LeaseManager

**A multi-tenant SaaS platform for managing office space — from the first enquiry to the signed lease, the monthly invoice and the maintenance ticket.**

[![CI](https://github.com/marwannhamed/pfe/actions/workflows/ci.yml/badge.svg)](https://github.com/marwannhamed/pfe/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-13-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

</div>

---

## What this is

Office landlords and coworking operators juggle buildings, floors, desks and meeting rooms across
several client companies, each with their own staff, bookings, contracts and invoices. LeaseManager
is the system that holds all of it: one platform, many client organisations, strictly separated.

The interesting part is the **three-level tenancy model**. Most SaaS products have one notion of
"tenant". This one has two, stacked:

```
Level 1 — Platform owner  (SUPER_ADMIN)
          the company that operates LeaseManager itself
                    │
                    ▼
Level 2 — Client organisation  (CLIENT)
          a property manager: owns buildings, floors, spaces, price lists
                    │  rents space to
                    ▼
Level 3 — Renter organisation  (RENTER)
          a company leasing desks or offices, with its own employees
```

A `Tenant` row is either a **CLIENT** (a property manager) or a **RENTER** (a company renting from
one), distinguished by `organization_type`. Every user belongs to a tenant, and every query that
touches tenant-owned data is scoped by it — centralised in
[`AccessPolicyService`](backend/src/common/services/access-policy.service.ts) rather than
re-implemented per module.

## Features

| Area | What it does |
|---|---|
| **Property** | Buildings → floors → spaces, with per-space features, photos, virtual tours and map coordinates |
| **Booking** | Availability checks, booking applications with approval workflow, a reception desk view, calendar and floor-map booking |
| **Leasing** | Lease contracts generated from approved bookings, with line items and expiry tracking |
| **Billing** | Invoices, line items, payments, cheque documents, and tenant-scoped promotion codes |
| **Maintenance** | Tickets with category, priority, assignment and status workflow |
| **Analytics** | Occupancy heatmaps, revenue and utilisation reporting, optional Power BI / Tableau embeds |
| **Notifications** | In-app, email and WebSocket delivery with per-user channel and category preferences |
| **Audit** | Every sensitive action recorded with actor, IP, user agent and severity |
| **Public site** | Marketing pages, a searchable space map and a guest booking flow that needs no account |

### Roles

| Level | Role | Scope |
|---|---|---|
| 1 | `SUPER_ADMIN` | Platform owner — reads across all organisations |
| 2 | `CLIENT_ADMIN` | Owns a client organisation and its users |
| 2 | `MANAGER` | Spaces, bookings, contracts |
| 2 | `FINANCE` | Invoicing and payments |
| 2 | `MAINTENANCE` | Maintenance tickets |
| 2 | `RECEPTIONIST` | Front-desk check-in, supervised by a manager |
| 3 | `TENANT_ADMIN` | Renter company admin — books space, manages their staff |
| 3 | `TENANT_EMPLOYEE` | Books space for themselves |
| — | `GUEST` | Public map and guest booking applications |

Role groupings live in [`role-groups.ts`](backend/src/constants/role-groups.ts) so controllers
declare intent (`CLIENT_BILLING`) rather than listing roles by hand.

## Tech stack

| | |
|---|---|
| **Backend** | NestJS 10 · Prisma 5 · PostgreSQL 13 · Passport JWT · Socket.IO · Swagger |
| **Frontend** | React 19 · Vite 7 · TypeScript · Ant Design 6 · TanStack Query · Zustand · Recharts · React-Leaflet |
| **Tooling** | Docker Compose · ESLint · Prettier · Jest · Vitest · GitHub Actions |

## Quick start — everything in Docker

**Prerequisites:** Docker Desktop. Nothing else.

```bash
git clone https://github.com/marwannhamed/pfe.git
cd pfe
cp backend/.env.example backend/.env

docker compose up -d --build
```

| | |
|---|---|
| App | http://localhost:5173 |
| Swagger | http://localhost:5173/api |
| Adminer (DB UI) | http://localhost:8081 |

Four containers: PostgreSQL, the NestJS API, nginx serving the built React app,
and Adminer. nginx proxies the API routes, so the browser talks to a single
origin and no CORS configuration is involved. Each service waits for the one
below it to report healthy, and the database is seeded **only when empty** — a
restart never overwrites your data.

```bash
docker compose logs -f api     # follow the API
docker compose down            # stop (the database volume survives)
```

`backend/docker-compose.yaml` still runs the API and database on their own for
backend-only work. Run that **or** the root stack, not both — they bind the
same ports.

## Quick start — running locally without containers

**Prerequisites:** Node.js 20+, Docker Desktop (for PostgreSQL only).

```bash
git clone https://github.com/marwannhamed/pfe.git
cd pfe

# 1. Install
npm install --prefix backend
npm install --prefix frontend

# 2. Configure — the defaults work for local development
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Start PostgreSQL (port 5433) and apply migrations
npm run db:up

# 4. Seed demo data
npm run db:seed --prefix backend

# 5. Run both apps
npm run dev
```

| | |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:6001 |
| Swagger | http://localhost:6001/api |
| Health | http://localhost:6001/health |
| Adminer (DB UI) | http://localhost:8081 |

The Vite dev server proxies API routes to the backend, so the frontend makes same-origin requests
and you do not need CORS configured for local work.

### Demo accounts

All seeded users share the password `Password123!`.

`npm run db:seed` upserts a minimal set and leaves existing rows alone.
`npm run db:seed:full` **empties every table** and rebuilds the full demo
dataset below — one platform owner, three property companies and six renter
companies, with every model populated.

| Email | Role | Organisation | Level |
|---|---|---|---|
| `admin@leasemanager.com` | `SUPER_ADMIN` | LeaseManager Platform | 1 |
| `admin@msheireb.test` | `CLIENT_ADMIN` | Msheireb Properties | 2 |
| `manager@msheireb.test` | `MANAGER` | Msheireb Properties | 2 |
| `finance@msheireb.test` | `FINANCE` | Msheireb Properties | 2 |
| `tech@msheireb.test` | `MAINTENANCE` | Msheireb Properties | 2 |
| `reception@msheireb.test` | `RECEPTIONIST` | Msheireb Properties | 2 |
| `tenant.admin@acme-corp.test` | `TENANT_ADMIN` | Acme Corp | 3 |
| `employee@acme-corp.test` | `TENANT_EMPLOYEE` | Acme Corp | 3 |

The other two property companies follow the same pattern at `@west-bay.test`
and `@lusail-hub.test`; the other five renters at `@qfintech.test`,
`@gulfco.test`, `@dohadesign.test`, `@pearllog.test` and `@arlegal.test`.

Signing in as a level-2 role and then a level-3 role is the quickest way to see the tenancy
boundary in action — the same pages expose different data and different actions. Comparing
two level-2 accounts from *different* property companies shows the other boundary: each
manager sees only the buildings, bookings, tickets and revenue of their own portfolio.

## Project structure

```
├── backend/                 NestJS API
│   ├── prisma/
│   │   ├── schema.prisma    25 models
│   │   ├── migrations/      replayable from empty — see note below
│   │   └── seed.ts
│   └── src/
│       ├── auth/            JWT strategy, sessions, password reset
│       ├── common/          guards, interceptors, filters, access policy
│       ├── config/          typed configuration with startup validation
│       ├── constants/       roles, enums, role groups
│       └── <domain>/        one module per domain: building, space, booking,
│                            billing, maintenance, analytics, …
├── frontend/                React SPA
│   └── src/
│       ├── api/             axios client, interceptors, service layer
│       ├── components/      shared UI
│       ├── pages/           one folder per feature area
│       ├── permissions/     client-side role gating
│       └── store/           Zustand auth and theme state
└── docs/                    runbook, workflow, demo script
```

### Request pipeline

Every API request passes through the same chain, wired in
[`main.ts`](backend/src/main.ts):

```
Helmet → compression → CORS → rate limit → JwtAuthGuard → RolesGuard
       → ValidationPipe (whitelist + forbidNonWhitelisted)
       → controller → service → Prisma
       → ResponseInterceptor → HttpExceptionFilter
```

Responses are wrapped in a `{ success, data }` envelope, which the frontend axios client unwraps
transparently.

## Scripts

Run from the repository root:

| Command | Does |
|---|---|
| `npm run dev` | Backend and frontend together, colour-tagged |
| `npm run dev:api` | Backend only |
| `npm run dev:web` | Frontend only |
| `npm run db:up` | Start PostgreSQL and apply migrations |

From `backend/`:

| Command | Does |
|---|---|
| `npm run db:seed` | Seed demo organisations, users and spaces |
| `npm run db:migrate` | Create a migration from schema changes |
| `npm run db:migrate:deploy` | Apply pending migrations (CI / production) |
| `npm run db:studio` | Prisma Studio |
| `npm run db:down` | Stop the database container |
| `npm run test:cov` | Jest with coverage |
| `npm run lint` | ESLint — **note: runs with `--fix`, so it rewrites files** |

From `frontend/`:

| Command | Does |
|---|---|
| `npm run build` | Type-check (`tsc -b`) then bundle |
| `npm run test:coverage` | Vitest with coverage |
| `npm run lint` | ESLint |

## Configuration

`backend/.env.example` documents every variable. The defaults run the app locally without any
external account. Required in production: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`,
`SESSION_SECRET` — the app refuses to boot if a secret is left at its placeholder value.

Optional integrations stay dormant until their keys are present:

| Integration | Variables | Falls back to |
|---|---|---|
| Email | `MAIL_HOST`, `MAIL_USER`, `MAIL_PASSWORD` | Logging the message to the console |
| Brevo | `BREVO_API_KEY` | Skipping contact sync |
| Crisp chat | `CRISP_WEBHOOK_SECRET` | Disabled |
| Typeform | `TYPEFORM_FORM_ID`, `TYPEFORM_WEBHOOK_SECRET` | Disabled |
| AI assistant | `OPENAI_API_KEY`, `OPENAI_MODEL` | Disabled |
| Marketplaces | `LIQUIDSPACE_API_TOKEN`, `COWORKER_API_TOKEN` | Disabled |
| Media uploads | `CLOUDINARY_*` | Local disk under `UPLOAD_DIR` — every upload kind, not just avatars |

All three webhook endpoints verify an HMAC signature with `timingSafeEqual` before doing any work.

Email picks its route at request time and falls back on failure: in development it prefers SMTP so
mail lands in the Mailtrap inbox, otherwise Brevo, otherwise SMTP, and finally the log. `GET
/mail/settings` reports which provider is active and why, which is the quickest way to tell whether
a missing email is a configuration problem or a code one.

A note on model names: `OPENAI_MODEL` points at whatever your provider still serves. Groq retires
models fairly often, and when that happens every AI route answers 502 `model_not_found` — list what
a key can still reach with
`curl -s $OPENAI_BASE_URL/models -H "Authorization: Bearer $OPENAI_API_KEY"`.

## Testing and CI

[GitHub Actions](.github/workflows/ci.yml) runs on every push and pull request: lint, type check,
tests with coverage, and a production build for both projects, plus a dependency audit.

```bash
npm run test:cov        --prefix backend     # Jest
npm run test:coverage   --prefix frontend    # Vitest
```

Two notes on the current state, so the numbers are not mistaken for more than they are:

- **Coverage is scoped, not global.** It is measured over the modules that have meaningful tests —
  `auth.service` and `promotion-code.service` on the backend, the API client on the frontend —
  rather than reported across untested code.
- **Lint rules are staged.** `no-explicit-any` and `no-unused-vars` have several hundred
  pre-existing violations and currently report as warnings, so genuine correctness rules are the
  ones that fail a build. The config notes say to burn them down and promote them back to errors.

### A note on migrations

The migration chain replays cleanly onto an empty database, and `prisma migrate diff` against
`schema.prisma` afterwards reports no difference. If you are bringing an **existing** database that
was built with `prisma db push` under migration control, baseline it rather than migrating it:

```bash
npx prisma migrate resolve --applied <migration_name>   # for each existing migration
```

## Documentation

| Document | Contents |
|---|---|
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Lease lifecycle and status transitions |
| [docs/RUNBOOK.md](docs/RUNBOOK.md) | Production operations |
| [docs/MANUAL_STEPS.md](docs/MANUAL_STEPS.md) | Local setup steps done by hand |
| [docs/PFE_DEMO_SCRIPT.md](docs/PFE_DEMO_SCRIPT.md) | Walkthrough for the demo |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Branching and commit conventions |
| [CHANGELOG.md](CHANGELOG.md) | Notable changes |

## About

Final-year engineering project (*Projet de Fin d'Études*) by
[**@marwannhamed**](https://github.com/marwannhamed).

## License

[MIT](LICENSE)
