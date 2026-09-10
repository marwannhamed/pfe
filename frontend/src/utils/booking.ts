import type { Booking } from '../types';

/** Normalize API booking rows (start_time vs start_datetime) for the UI. */
export function mapBooking(raw: Record<string, unknown>): Booking {
  const start = (raw.start_datetime ?? raw.start_time) as string;
  const end = (raw.end_datetime ?? raw.end_time) as string;
  return {
    ...(raw as unknown as Booking),
    start_datetime: start,
    end_datetime: end,
    created_by_user_id: (raw.created_by_user_id ?? raw.user_id) as string,
    attendee_count: Number(raw.attendee_count ?? 1),
    currency: (raw.currency as string) ?? 'QAR',
    total_price: String(raw.total_price ?? raw.total_amount ?? 0),
  };
}

export function mapBookings(raw: unknown): Booking[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.data) ? (raw as any).data : [];
  return list.map((b) => mapBooking(b as Record<string, unknown>));
}
