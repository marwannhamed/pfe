-- White-label Power BI / Tableau embed config (URLs only; tokens stay with vendor).
ALTER TABLE "tenants" ADD COLUMN "reporting_embeds" JSONB;

-- Optional fields for predictive maintenance heuristics.
ALTER TABLE "maintenance_tickets" ADD COLUMN "equipment_installed_at" TIMESTAMP(3);
ALTER TABLE "maintenance_tickets" ADD COLUMN "usage_hours_estimate" DOUBLE PRECISION;
