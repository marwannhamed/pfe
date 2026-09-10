/** Qatar market defaults — keep in sync with backend/src/constants/qatar.ts */

export const DEFAULT_CURRENCY = 'QAR';

export const DEFAULT_COUNTRY_CODE = 'QA';

export const DOHA_CENTER = { lat: 25.2854, lng: 51.531 } as const;

export const QATAR_ZONES = [
  'West Bay',
  'Lusail',
  'The Pearl',
  'Msheireb Downtown',
  'Al Sadd',
  'Industrial Area',
  'QSTP',
  'Education City',
  'Doha',
] as const;

const CURRENCY_SYMBOLS: Record<string, string> = {
  QAR: 'QAR ',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

export function currencySymbol(currency?: string | null): string {
  if (!currency) return CURRENCY_SYMBOLS.QAR;
  return CURRENCY_SYMBOLS[currency.toUpperCase()] ?? `${currency} `;
}

/** Friday and Saturday are weekends in Qatar. */
export function isQatarWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6;
}
