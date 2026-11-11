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

/** "QAR 29,600" — an amount with its currency; QAR unless the row says otherwise. */
export function formatMoney(
  amount: number | string | null | undefined,
  currency?: string | null,
  decimals = 0,
): string {
  const n = Number(amount ?? 0);
  const value = Number.isFinite(n) ? n : 0;
  return `${currencySymbol(currency)}${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** "QAR 2.9M", "QAR 29.6k" — for KPI cards and chart axes. */
export function formatMoneyCompact(amount: number | string | null | undefined, currency?: string | null): string {
  const n = Number(amount ?? 0) || 0;
  const sym = currencySymbol(currency);
  if (Math.abs(n) >= 1_000_000) return `${sym}${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${sym}${(n / 1_000).toFixed(1)}k`;
  return `${sym}${n.toFixed(0)}`;
}

/** Currency choices for forms, QAR first. */
export const CURRENCY_OPTIONS = ['QAR', 'USD', 'EUR', 'GBP', 'AED'] as const;

/** Friday and Saturday are weekends in Qatar. */
export function isQatarWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6;
}
