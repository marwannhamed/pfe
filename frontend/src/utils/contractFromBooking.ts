import type { Booking } from '../types';
import { DEFAULT_CURRENCY } from '../constants/qatar';

export interface ContractPrefillFromBooking {
  tenant_id: string;
  start_date: string;
  end_date: string;
  currency: string;
  space_name: string;
  booking_number: string;
  monthly_rent?: string;
  booking_id?: string;
}

export const CONTRACT_BOOKING_STATUSES = new Set([
  'ACTIVE',
  'DOCUMENTS_PENDING_UPLOAD',
  'CONFIRMED',
  'CHECKED_IN',
  'COMPLETED',
]);

function bookingMonthlyRent(b: Booking): string {
  const total = Number(b.total_price ?? 0);
  const start = new Date(b.start_datetime);
  const end = new Date(b.end_datetime);
  const months = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (86400000 * 30)));
  const spaceMonthly = Number(
    (b as Booking & { space?: { price_per_month?: number; monthly_rate?: number } }).space?.price_per_month
      ?? (b as Booking & { space?: { monthly_rate?: number } }).space?.monthly_rate
      ?? 0,
  );
  if (spaceMonthly > 0) return String(spaceMonthly);
  if (total > 0) return String(Math.round((total / months) * 100) / 100);
  return '';
}

export function prefillFromBooking(b: Booking): ContractPrefillFromBooking {
  const start = b.start_datetime?.includes('T') ? b.start_datetime.split('T')[0] : b.start_datetime;
  const end = b.end_datetime?.includes('T') ? b.end_datetime.split('T')[0] : b.end_datetime;
  const space = (b as Booking & { space?: { name?: string; currency?: string } }).space;
  return {
    booking_id: b.id,
    tenant_id: b.tenant_id,
    start_date: start ?? '',
    end_date: end ?? '',
    currency: b.currency ?? space?.currency ?? DEFAULT_CURRENCY,
    space_name: space?.name ?? 'Space',
    booking_number: b.booking_number,
    monthly_rent: bookingMonthlyRent(b),
  };
}
