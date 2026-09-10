export const PENDING_BOOKING_SPACE_KEY = 'pending_booking_space_id';

export function setPendingBookingSpace(spaceId: string) {
  localStorage.setItem(PENDING_BOOKING_SPACE_KEY, spaceId);
}

export function getPendingBookingSpace(): string | null {
  return localStorage.getItem(PENDING_BOOKING_SPACE_KEY);
}

export function clearPendingBookingSpace() {
  localStorage.removeItem(PENDING_BOOKING_SPACE_KEY);
}
