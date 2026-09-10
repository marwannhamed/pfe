/** Safe display helpers — Prisma allows null first_name / last_name. */

export function getUserInitials(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const a = firstName?.trim()?.[0] ?? '';
  const b = lastName?.trim()?.[0] ?? '';
  const fromNames = `${a}${b}`.toUpperCase();
  if (fromNames) return fromNames;
  const e = email?.trim()?.[0];
  return e ? e.toUpperCase() : '?';
}

export function formatUserName(
  firstName?: string | null,
  lastName?: string | null,
  email?: string | null,
): string {
  const full = [firstName, lastName].filter(Boolean).join(' ').trim();
  if (full) return full;
  return email?.trim() || 'Unknown user';
}
