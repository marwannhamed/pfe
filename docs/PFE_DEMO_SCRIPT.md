# PFE demo script — LeaseManager

Use this for your presentation or jury demo (~10 minutes).

## Before you start

1. **Postgres** running (Docker on port `5433`).
2. **Backend:** `cd backend` → `npm run start:dev` → http://localhost:6001/health OK
3. **Frontend:** `cd frontend` → `npm run dev` → http://localhost:5173

All demo passwords: **`Password123!`**

| Role | Email |
|------|--------|
| Super Admin | `admin@leasemanager.com` |
| Finance | `finance@leasemanager.com` |
| Site Manager | `manager@leasemanager.com` |
| Tenant Admin | `tenant.admin@acme-corp.test` |
| Employee | `employee@acme-corp.test` |

## Recommended demo flow (core features)

### 1. Super Admin — platform overview (2 min)

- Login → **Dashboard**
- **Sites** → Demo Office Paris
- **Spaces** → hot desk / office / meeting room
- **Tenants** → landlord + customer orgs
- **Users** → roles per user

### 2. Operations (3 min)

- **Bookings** → list / calendar
- **Contracts** → active lease `LC-DEMO-001`
- **Maintenance** → create or show a ticket

### 3. Finance (3 min)

- Login as **finance@leasemanager.com** (or stay Super Admin)
- **Billing & Payments**
  - Invoices tab
  - **Record Payment** on an unpaid invoice (`SENT` / `ISSUED`)
  - Payments tab grouped by tenant

### 4. Tenant portal (2 min)

- Login as **tenant.admin@acme-corp.test**
- **Dashboard** → bookings, billing (read-only), maintenance request

## Optional pages (not required for jury)

- Analytics, Export, Owner reports, Occupancy heat, Rev. forecast, Predictive MT
- Email, Audit Logs (Super Admin only)

## What was verified automatically (API)

- All 6 roles can log in
- Billing: list invoices, create invoice, record payment, refund
- Reports API fixed (no more 500 on `/reports`)
- Audit restricted to Super Admin
- Integrations module removed (optional feature)

## 2-minute manual check (recommended once)

Even if APIs pass, click once in the browser:

1. Super Admin → Billing → record a payment
2. Tenant Admin → portal dashboard loads
3. No red errors in browser console (F12)

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `ERR_CONNECTION_REFUSED` | Start backend `npm run start:dev` |
| Cannot login | Run `npx prisma migrate deploy` and `npx prisma db seed` in `backend/` |
| No unpaid invoices | Generate invoice with status `SENT`, then pay |
