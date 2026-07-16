/**
 * Unit Tests: OTP login Zod schemas
 *
 * Story   : RAILREPAY-APP-LOGIN-001
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-05-12
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * These tests MUST FAIL until Blake creates lib/schemas/login.ts.
 * Failure reason: "Cannot find module '../../src/schemas/login'"
 *
 * AC coverage map:
 *   AC-2: UK phone regex validation via phoneSchema
 *   AC-4: OTP numeric code validation via otpSchema
 *
 * Import path: tests/unit/schemas/ → tests/unit/ → tests/ → services/web-app-pwa/
 * Three levels up: ../../src/schemas/login
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import { describe, it, expect } from 'vitest';

// AC-2 + AC-4: Zod schemas exported from lib/schemas/login.ts
// @ts-expect-error — module does not exist yet (TDD RED phase)
import { phoneSchema, otpSchema } from '../../src/schemas/login';

// ─────────────────────────────────────────────────────────────────────────────

describe('RAILREPAY-APP-LOGIN-001: lib/schemas/login.ts', () => {
  // ── AC-2: phoneSchema ────────────────────────────────────────────────────────
  describe('AC-2: phoneSchema — UK mobile number validation', () => {
    describe('valid UK mobile numbers', () => {
      it('AC-2: should accept +447700900000 (E.164 +44 format)', () => {
        const result = phoneSchema.safeParse('+447700900000');
        expect(result.success).toBe(true);
      });

      it('AC-2: should accept 07700900000 (UK local format with leading 0)', () => {
        const result = phoneSchema.safeParse('07700900000');
        expect(result.success).toBe(true);
      });

      it('AC-2: should accept +447911123456 (another valid +44 number)', () => {
        const result = phoneSchema.safeParse('+447911123456');
        expect(result.success).toBe(true);
      });

      it('AC-2: should accept 07911123456 (another valid 07 number)', () => {
        const result = phoneSchema.safeParse('07911123456');
        expect(result.success).toBe(true);
      });
    });

    describe('invalid phone numbers', () => {
      it('AC-2: should reject +12025550100 (US number, not UK)', () => {
        const result = phoneSchema.safeParse('+12025550100');
        expect(result.success).toBe(false);
      });

      it('AC-2: should reject 447700900000 (no leading + or 0 — missing prefix)', () => {
        const result = phoneSchema.safeParse('447700900000');
        expect(result.success).toBe(false);
      });

      it('AC-2: should reject +44700900000 (too short — only 9 digits after +44)', () => {
        const result = phoneSchema.safeParse('+44700900000');
        expect(result.success).toBe(false);
      });

      it('AC-2: should reject +44770090000a (contains non-digit character)', () => {
        const result = phoneSchema.safeParse('+44770090000a');
        expect(result.success).toBe(false);
      });

      it('AC-2: should reject empty string', () => {
        const result = phoneSchema.safeParse('');
        expect(result.success).toBe(false);
      });

      it('AC-2: should reject undefined / missing value', () => {
        const result = phoneSchema.safeParse(undefined);
        expect(result.success).toBe(false);
      });
    });
  });

  // ── AC-4: otpSchema ──────────────────────────────────────────────────────────
  describe('AC-4: otpSchema — OTP numeric code validation', () => {
    describe('valid OTP codes', () => {
      it('AC-4: should accept 1234 (4-digit code, minimum length)', () => {
        const result = otpSchema.safeParse('1234');
        expect(result.success).toBe(true);
      });

      it('AC-4: should accept 12345 (5-digit code)', () => {
        const result = otpSchema.safeParse('12345');
        expect(result.success).toBe(true);
      });

      it('AC-4: should accept 1234567890 (10-digit code, maximum length)', () => {
        const result = otpSchema.safeParse('1234567890');
        expect(result.success).toBe(true);
      });
    });

    describe('invalid OTP codes', () => {
      it('AC-4: should reject 123 (too short — only 3 digits, minimum is 4)', () => {
        const result = otpSchema.safeParse('123');
        expect(result.success).toBe(false);
      });

      it('AC-4: should reject 12345678901 (too long — 11 digits, maximum is 10)', () => {
        const result = otpSchema.safeParse('12345678901');
        expect(result.success).toBe(false);
      });

      it('AC-4: should reject 12ab (contains non-digit characters)', () => {
        const result = otpSchema.safeParse('12ab');
        expect(result.success).toBe(false);
      });

      it('AC-4: should reject empty string', () => {
        const result = otpSchema.safeParse('');
        expect(result.success).toBe(false);
      });

      it('AC-4: should reject undefined / missing value', () => {
        const result = otpSchema.safeParse(undefined);
        expect(result.success).toBe(false);
      });
    });
  });
});
