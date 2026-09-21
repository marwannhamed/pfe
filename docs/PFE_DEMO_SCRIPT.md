# Demo script

Walked end to end against the current build on 21 Sept 2026. Every step below
was verified; page loads average under 2 seconds, so the whole walk is about
12 minutes with talking.

## Before the room

```bash
docker compose up -d --build     # four containers; wait for all healthy
```

| | |
|---|---|
| App | http://localhost:5173 |
| Swagger | http://localhost:5173/api |
| Adminer | http://localhost:8081 |

Check `docker compose ps` shows **api** and **postgres** as `healthy` before
you start. If the data looks wrong, `npm run db:seed:full` in `backend/`
rebuilds it in about 20 seconds.

**Open two browser tabs.** Sessions are per-tab by design, so you can hold a
property manager in one and a renter in the other and switch without logging
out. This matters for Act 3.

All accounts use `Password123!`.

---

## Act 1 — The platform owner (2 min)

**`admin@leasemanager.com`**

| Go to | Say |
|---|---|
| **Dashboard** | "One deployment, nine active organisations, 72 spaces, 43,500 QAR collected." |
| **Clients** | "Three property companies and six renter companies. They are competitors." |
| **Audit** | "Every privileged action is recorded with actor, IP and severity." |

This is the only account that reads across organisations. Say that out loud —
it sets up Act 3.

## Act 2 — A property manager (4 min)

**`manager@msheireb.test`** — Msheireb Properties

| Go to | Say |
|---|---|
| **Dashboard** | "24 spaces, not 72. Same screen as the owner, different scope." |
| **Buildings** | "Two towers. They own these; the other four are invisible." |
| **Tenant Applications** | "Najma Architects applied. Approving creates their organisation and their first admin, and sends a password-reset — no temporary password is ever shown." |
| **Contracts** | "Two leases. A contract belongs to the renter, so reaching it as the landlord runs through the building." |
| **Maintenance** | "18 tickets, out of 54 on the platform." |
| **Promo Codes** | "Discount codes, unique per company — two landlords can both run SUMMER25." |

### The AI moment — do this live

On **Maintenance** → **Submit Ticket**, type:

> **Title:** Socket sparked when I plugged in the kettle
> **What is happening:** There was a bang and a burning smell. We unplugged everything.

Click outside the box. A suggestion appears: **Electrical / Emergency**, with a
reason, a named technician, and past fixes in their buildings.

The point to make: *"Category and priority come from the model. The technician
does not — that comes from ticket history, because a model asked to name a
person invents staff who don't work here, and a manager has to defend the
choice. '2 electrical tickets resolved, 2 open now' is a reason."*

## Act 3 — The isolation proof (2 min)

**This is the centrepiece.** In the second tab, log in as
**`manager@west-bay.test`** and open **Maintenance**.

Same screen. Different 18 tickets. No overlap. Msheireb's towers are not there.

Then say what it cost: *"Four leaks at this level were invisible while the demo
data had one landlord — with one company, 'show everything' and 'show my
portfolio' return the same rows. Rebuilding the seed with three competitors
exposed all four the same afternoon. Test data shape is part of the security
surface."*

If asked how it's checked: `npm run audit:access` — 37 live probes against a
running server, including nine landlord-versus-landlord checks.

## Act 4 — The renter (2 min)

**`tenant.admin@acme-corp.test`** — Acme Corp

| Go to | Say |
|---|---|
| **Dashboard** | "Their own view: 3 bookings, 1 lease, 2 pending invoices." |
| **Contracts** | "One lease — LC-2026-100. The same lease the Msheireb manager saw, from the other side." |
| **Billing** | "Cash, bank transfer or cheque. No card processor: in this market rent is not paid online, so a finance officer records the payment." |

That last point is worth dwelling on — it's a requirement taken from the market,
not a missing feature.

---

## If there is time

- **Notifications** — the bell is live over a websocket, not polling. The green
  dot in the dropdown says so.
- **Swagger** at `/api` — 218 routes.
- **Document extraction** — `POST /ai/documents/extract` reads a trade licence
  PDF and returns the fields a manager would retype. Works on documents with a
  text layer; scans need an image-capable model, which this deployment's
  provider does not offer.

## Questions to expect

**"What stops one company seeing another's data?"**
Five stages on every request: JWT guard, roles guard, validation pipe, a
`*ForUser` service method, then `AccessPolicyService` turning the caller into a
Prisma `where`. `isCrossTenantReader` is true for the platform owner alone.

**"How do you know it works?"**
Each landlord's figures sum *exactly* to the platform totals — revenue,
bookings, spaces, tickets. Correct scoping partitions the data; if anything
leaked or double-counted, the sums would not close.

**"What was the hardest bug?"**
The ticket detail check compared `tenant_id`, which on a ticket is the
*renter's* organisation. It refused staff every ticket on their own buildings
while allowing a rival's — wrong in both directions at once, from one
comparison.

**"Is the AI reliable?"**
It isn't trusted. Any value outside the project's own enum discards the whole
answer and a keyword classifier takes over, as does a missing key or an
unreachable provider. Submitting a ticket never depends on a third party.

## If something breaks

| Problem | Fix |
|---|---|
| Page won't load | `docker compose ps` — is **web** healthy? |
| Login fails | `docker compose logs api --tail 30` |
| Data looks wrong | `npm run db:seed:full` in `backend/` |
| Both tabs logged out together | You used two windows of the same profile; open a second tab instead |
