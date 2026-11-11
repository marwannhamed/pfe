/** "PARTIALLY_PAID" -> "Partially paid", "DEDICATED_OFFICE" -> "Dedicated office". */
export function humanize(value?: string | null): string {
  if (!value) return '';
  const words = value.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
