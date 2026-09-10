import { BadRequestException } from '@nestjs/common';

/** E.164 international format: + followed by 7–15 digits */
export const PHONE_E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function assertPhoneE164(phone: string, field = 'phone_number') {
  const trimmed = phone?.trim();
  if (!trimmed || !PHONE_E164_REGEX.test(trimmed)) {
    throw new BadRequestException(
      `${field} must be in international format (e.g. +21612345678)`,
    );
  }
  return trimmed;
}

export function normalizePhoneE164(phone?: string | null): string | null {
  if (!phone?.trim()) return null;
  return assertPhoneE164(phone);
}
