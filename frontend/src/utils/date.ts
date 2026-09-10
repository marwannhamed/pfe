/** ISO date (YYYY-MM-DD) without throwing on null/undefined. */
export function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  const s = String(value);
  if (s.includes('T')) return s.split('T')[0] ?? '';
  return s.length >= 10 ? s.slice(0, 10) : s;
}

export function todayInputValue(): string {
  return new Date().toISOString().split('T')[0];
}
