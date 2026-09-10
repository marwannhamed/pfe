# Lease workflow (statuses)

This describes the intended **happy path** and how API/UI statuses align.

## 1. Space

| Status        | Meaning                          |
|---------------|----------------------------------|
| `AVAILABLE`   | Bookable                         |
| `OCCUPIED`    | Under lease / not bookable     |
| `RESERVED`    | Held                             |
| `MAINTENANCE` | Blocked for work               |

## 2. Booking

| Status               | Next step                                      |
|----------------------|------------------------------------------------|
| `DRAFT`              | User completes and submits                     |
| `PENDING_APPROVAL`   | `PATCH /bookings/:id/approve` (admin)        |
| `CONFIRMED`          | Billing / contract; `check-in` when on site  |
| `CHECKED_IN`         | `PATCH .../check-out` → completed            |
| `COMPLETED`          | Terminal                                       |
| `CANCELLED`          | Terminal                                       |

**Create:** `POST /bookings` — body must use the caller’s tenant (except `SUPER_ADMIN` / `FINANCE`). Dates: `start_datetime` / `end_datetime`.

## 3. Contract

Lease contracts use `status`: `DRAFT` → `ACTIVE` → `EXPIRED` / `TERMINATED` (via lease-contract endpoints).

## 4. Invoice & payment

1. Invoice: `DRAFT` → `ISSUED` / `SENT` → `PAID` or `OVERDUE` (billing module).  
2. Payment: `POST /billing/payments` links to invoice and booking where applicable.

## 5. Authorization

- **JWT** identifies the user.  
- **`@Roles()` + `RolesGuard`** enforce which roles can hit each route.  
- **Tenant scope:** `SITE_MANAGER`, `TENANT_ADMIN`, `EMPLOYEE`, `MAINTENANCE` are limited to `user.tenant_id` on sites/buildings/floors/booking lists.  
- **`SUPER_ADMIN`** and **`FINANCE`** can read across tenants where explicitly allowed (e.g. tenant list for finance).

For a full audit, align each remaining controller with the same pattern as `sites`, `buildings`, `floors`, `bookings`, and `tenants`.
