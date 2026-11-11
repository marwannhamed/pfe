/** `YYYY-MM` for a date, in the viewer's time zone. */
export function monthKey(d: string | Date): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}`;
}

/** The last `n` calendar months, oldest first, ending with the current one. */
export function lastMonths(n: number, now = new Date()): { key: string; label: string }[] {
  const months: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: monthKey(d), label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) });
  }
  return months;
}

/**
 * Buckets items into the last `n` months for a chart, oldest first.
 *
 * The dashboards used to key buckets by label in the order rows arrived —
 * newest first from the API — and then keep `.slice(-6)`, so the charts ran
 * backwards and dropped the most recent months. Months with no rows are kept
 * so the axis is continuous.
 */
export function bucketByMonth<T, V extends Record<string, number>>(
  items: readonly T[],
  n: number,
  dateOf: (item: T) => string | Date | null | undefined,
  empty: () => V,
  add: (bucket: V, item: T) => void,
): ({ date: string } & V)[] {
  const months = lastMonths(n);
  const buckets = new Map(months.map((m) => [m.key, empty()]));
  for (const item of items) {
    const d = dateOf(item);
    if (!d) continue;
    const bucket = buckets.get(monthKey(d));
    if (bucket) add(bucket, item);
  }
  return months.map((m) => ({ date: m.label, ...(buckets.get(m.key) as V) }));
}

/** True when every numeric series in the buckets is zero. */
export function isEmptySeries(rows: readonly Record<string, unknown>[]): boolean {
  return rows.every((r) => Object.values(r).every((v) => typeof v !== 'number' || v === 0));
}
