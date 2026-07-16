/**
 * Zod schemas for OTP login flow
 *
 * Story   : RAILREPAY-APP-LOGIN-001
 * Phase   : US-3 (Blake — Implementation)
 *
 * AC-2: phoneSchema — UK mobile number validation
 * AC-4: otpSchema — OTP numeric code validation (4–10 digits, matches BFF/auth-service contract)
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import { z } from 'zod';

// UK mobile: +44 or 0 prefix, then 7 + 9 digits
export const phoneSchema = z.string().regex(/^(?:\+44|0)7\d{9}$/, {
  message: 'Please enter a valid UK mobile number',
});

// OTP: 4-10 digit numeric (matches BFF/auth-service contract)
export const otpSchema = z.string().regex(/^\d{4,10}$/, {
  message: 'Please enter a valid code',
});

/**
 * Normalize a UK phone number to E.164 format.
 * "07700900000" → "+447700900000"
 * "+447700900000" passes through unchanged.
 */
export function normalizeToE164(phone: string): string {
  if (phone.startsWith('0')) {
    return '+44' + phone.slice(1);
  }
  return phone;
}
