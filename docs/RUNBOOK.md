# Production Runbook

## Deployment Readiness Checklist

- Required environment variables are set (no placeholder secrets).
- Database migrations are reviewed and ready.
- CI pipeline is green on target commit.
- Rollback target/version is identified.

## Deploy Steps

1. Pull latest image/version to production host.
2. Apply migrations:
   - `npx prisma migrate deploy`
3. Start services:
   - `docker compose -f backend/docker-compose.prod.yaml up -d --build`
4. Verify health endpoint:
   - `GET /health`
5. Verify API docs endpoint:
   - `GET /api`

## Post-Deploy Validation

- Auth login and token refresh work.
- Core flows work: bookings, invoices, notifications.
- Error logs do not show startup or migration failures.
- CPU/memory/response-time are within expected range.

## Rollback Plan

1. Stop current app containers.
2. Start previous stable image/tag.
3. Confirm `/health` and critical user flows.
4. Document incident details in release notes.

## Incident Quick Actions

- If app is unhealthy: check container logs and DB connectivity first.
- If DB errors appear: confirm migration state and `DATABASE_URL`.
- If auth fails: verify JWT env values and expiration settings.
