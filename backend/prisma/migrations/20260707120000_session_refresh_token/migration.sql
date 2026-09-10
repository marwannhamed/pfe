-- AlterTable
-- The User model maps to "users"; the original statement referenced the model
-- name and failed on a clean database with 42P01.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "session_refresh_token" TEXT;
