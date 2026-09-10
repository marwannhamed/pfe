/**
 * Total cost for one unit of an add-on over a multi-month space lease.
 * Stored as unit_price on BookingAddOn; quantity is the user's selected count.
 */
export function addonUnitPriceForLease(
  basePrice: number,
  billingCycle: string,
  durationMonths: number,
): number {
  const months = Math.max(1, durationMonths);
  switch (billingCycle?.toUpperCase()) {
    case 'MONTHLY':
      return basePrice * months;
    case 'DAILY':
      return basePrice * months * 30;
    case 'HOURLY':
      return basePrice * months * 30 * 8;
    case 'ONE_TIME':
    default:
      return basePrice;
  }
}

export function addonLineTotal(quantity: number, unitPrice: number): number {
  return Number(quantity) * Number(unitPrice);
}
