#!/usr/bin/env node
/**
 * Seed only when the database has no users yet.
 *
 * The dev container used to run `prisma db seed` on every start. The seed is
 * upsert-based so it did not destroy anything, but it rewrote demo rows over a
 * developer's own edits each time the container restarted. A first-run check
 * is what was actually wanted.
 *
 * Never throws: a seeding problem must not stop the API from booting.
 */
import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

try {
  const users = await prisma.user.count();
  if (users > 0) {
    console.log(`[seed-if-empty] ${users} user(s) present — leaving data alone.`);
  } else {
    console.log('[seed-if-empty] empty database — running the demo seed.');
    execSync('npx prisma db seed', { stdio: 'inherit' });
  }
} catch (err) {
  console.warn('[seed-if-empty] skipped:', err?.message ?? err);
} finally {
  await prisma.$disconnect().catch(() => {});
}
