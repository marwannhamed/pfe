import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bucketByMonth, isEmptySeries, lastMonths } from './months';

describe('bucketByMonth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 12)); // 12 Oct 2026
  });
  afterEach(() => vi.useRealTimers());

  it('runs oldest to newest and ends on the current month', () => {
    expect(lastMonths(6).map((m) => m.label)).toEqual(['May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26']);
  });

  it('ignores the order rows arrive in', () => {
    // The API returns newest first; keying buckets in arrival order and
    // keeping .slice(-6) drew the chart backwards.
    const rows = [
      { at: new Date(2026, 9, 3) },
      { at: new Date(2026, 9, 1) },
      { at: new Date(2026, 7, 20) },
      { at: new Date(2026, 4, 2) },
      { at: new Date(2025, 11, 31) }, // outside the window
    ];
    const out = bucketByMonth(rows, 6, (r) => r.at, () => ({ n: 0 }), (b) => { b.n++; });
    expect(out.map((m) => [m.date, m.n])).toEqual([
      ['May 26', 1], ['Jun 26', 0], ['Jul 26', 0], ['Aug 26', 1], ['Sep 26', 0], ['Oct 26', 2],
    ]);
  });

  it('reports an all-zero series as empty', () => {
    const out = bucketByMonth([], 3, () => null, () => ({ a: 0, b: 0 }), () => {});
    expect(out).toHaveLength(3);
    expect(isEmptySeries(out)).toBe(true);
  });
});
