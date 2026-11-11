import { bookableHoursBetween } from './working-hours';

// Times written in Doha local time (UTC+3).
const doha = (iso: string) => new Date(`${iso}+03:00`);

describe('bookableHoursBetween', () => {
  it('counts 14 bookable hours (08:00–22:00) a day, weekends included', () => {
    expect(bookableHoursBetween(doha('2026-10-11T00:00:00'), doha('2026-10-18T00:00:00'))).toBe(98);
  });

  it('clips a booking to the bookable window', () => {
    // 07:00–12:30 counts from 08:00
    expect(bookableHoursBetween(doha('2026-10-12T07:00:00'), doha('2026-10-12T12:30:00'))).toBe(4.5);
    // an evening event, 17:00–23:00, counts until 22:00
    expect(bookableHoursBetween(doha('2026-10-12T17:00:00'), doha('2026-10-12T23:00:00'))).toBe(5);
  });

  it('counts a month-long lease as fully booked', () => {
    const from = doha('2026-10-01T00:00:00');
    const to = doha('2026-11-01T00:00:00');
    expect(bookableHoursBetween(from, to)).toBe(31 * 14);
  });

  it('is zero for an empty or reversed window', () => {
    const t = doha('2026-10-12T10:00:00');
    expect(bookableHoursBetween(t, t)).toBe(0);
    expect(bookableHoursBetween(doha('2026-10-13T10:00:00'), t)).toBe(0);
  });
});
