/** Doha is UTC+3 all year (no daylight saving). */
const DOHA_OFFSET_MS = 3 * 3_600_000;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Spaces are bookable from 08:00 to 22:00: offices by day, events into the evening. */
export const OPEN_HOUR = 8;
export const CLOSE_HOUR = 22;

/** Hours of [from, to) that fall within 08:00–22:00 Doha time, on any day. */
export function bookableHoursBetween(from: Date, to: Date): number {
  const a = from.getTime();
  const b = to.getTime();
  if (!(b > a)) return 0;
  // Midnight of the first Doha day, written as a UTC timestamp so getUTC*
  // reads Doha wall-clock values.
  const first = new Date(a + DOHA_OFFSET_MS);
  let day = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), first.getUTCDate());
  let total = 0;
  for (; day - DOHA_OFFSET_MS < b; day += DAY) {
    const open = day + OPEN_HOUR * HOUR - DOHA_OFFSET_MS;
    const close = day + CLOSE_HOUR * HOUR - DOHA_OFFSET_MS;
    const start = Math.max(open, a);
    const end = Math.min(close, b);
    if (end > start) total += (end - start) / HOUR;
  }
  return total;
}
