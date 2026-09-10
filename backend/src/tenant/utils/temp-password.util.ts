import { randomBytes } from 'crypto';

/** Generates a readable temporary password (16 chars, mixed case + digit + symbol). */
export function generateTemporaryPassword(): string {
  const base = randomBytes(9).toString('base64url').replace(/[^a-zA-Z0-9]/g, '');
  const upper = 'A';
  const lower = 'b';
  const digit = String(Math.floor(Math.random() * 10));
  const symbol = '!';
  return `${base}${upper}${lower}${digit}${symbol}`.slice(0, 16);
}
