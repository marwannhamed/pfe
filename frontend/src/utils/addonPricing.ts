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
    default:
      return basePrice;
  }
}

export function addonLineTotal(quantity: number, unitPrice: number): number {
  return quantity * unitPrice;
}

export function cycleSuffix(cycle: string) {
  switch (cycle?.toUpperCase()) {
    case 'MONTHLY': return '/mo';
    case 'DAILY': return '/day';
    case 'HOURLY': return '/hr';
    default: return '';
  }
}
