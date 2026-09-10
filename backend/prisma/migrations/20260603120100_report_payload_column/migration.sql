-- RenameReportDataColumn (avoid collision with API response wrapper `data`)
ALTER TABLE "reports" RENAME COLUMN "data" TO "payload";
