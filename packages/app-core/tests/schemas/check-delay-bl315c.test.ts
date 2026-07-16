/**
 * RED Tests: lib/schemas/check-delay.ts — BL-315-C nullable ticket_fare_pence
 *
 * Phase   : TD-1 (Jessie — Test Specification, TDD per ADR-014)
 * BL      : BL-315-C / BL-328 — eligible→compensation happy-path
 * Date    : 2026-06-13
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * Defect:
 *   Both matchedTrueSchema copies (lib/schemas/check-delay.ts line 63 AND
 *   app/capture/result/page.tsx line 49) declare:
 *     ticket_fare_pence: z.number()    ← rejects null / undefined
 *   But eligibility_evaluations.ticket_fare_pence IS nullable in the DB.
 *   The BFF ensure composite passes eeBody.ticket_fare_pence straight through.
 *   When the DB column is NULL, the eligible composite fails safeParse in
 *   bff-client.ts → BffParseError → confirm page shows "Something went wrong".
 *   User never reaches /capture/result.
 *
 * Fix required (AC-1):
 *   ticket_fare_pence: z.number().nullable() in BOTH copies of matchedTrueSchema
 *
 * AC-1 (schema robustness):
 *   checkDelayResponseSchema.safeParse succeeds for an eligible composite with:
 *     - ticket_fare_pence: null
 *     - ticket_fare_pence: undefined / absent (field missing from body)
 *     - ticket_fare_pence: 0 (edge: zero fare)
 *     - ticket_fare_pence: 29870 (real DR15 York→KGX fare)
 *   Realistic eligible composite uses target verification service values:
 *     RID 202606036701949, York→KGX 2026-06-03, 77-min delay, toc GR,
 *     DR15 50% band, fare 29870 pence → compensation_pence 14935.
 *
 * These tests FAIL against HEAD because z.number() rejects null/undefined.
 * Failure reason: result.success === false when ticket_fare_pence is null.
 *
 * ADR references:
 *   ADR-014 — TDD
 *   ADR-027 — BFF owns canonical client-facing contract
 */

import { describe, it, expect } from 'vitest';
import { checkDelayResponseSchema } from '../../src/schemas/check-delay';

// ─── Shared realistic eligible composite (DR15 50% band, York→KGX 2026-06-03) ─

/**
 * Realistic eligible composite for RID 202606036701949.
 * York→KGX 2026-06-03, 77-min Darwin delay, toc GR.
 * DR15 50% band: compensation_pence = Math.floor(29870 * 50 / 100) = 14935.
 * ticket_fare_pence is the normal present-and-correct case.
 */
const ELIGIBLE_COMPOSITE_FARE_PRESENT = {
  matched: true,
  journey_id: 'jrn-yrk-kgx-20260603-0730',
  delay_minutes: 77,
  cancelled: false,
  last_observed_at: '2026-06-03T09:47:00Z',
  status: 'delayed',
  eligible: true,
  scheme: 'DR15',
  compensation_percentage: 50,
  compensation_pence: 14935,
  ticket_fare_pence: 29870,
  reasons: ['Delay of 77 minutes qualifies for 50% refund under DR15'],
  applied_rules: ['DR15_60MIN_50PCT'],
  evaluation_timestamp: '2026-06-03T09:50:00Z',
};

/**
 * Same composite but ticket_fare_pence is null.
 * This is the production failure scenario — eligibility_evaluations row
 * had a NULL ticket_fare_pence column value.
 * AC-1 RED: z.number() rejects null → safeParse returns success:false.
 */
const ELIGIBLE_COMPOSITE_NULL_FARE = {
  ...ELIGIBLE_COMPOSITE_FARE_PRESENT,
  ticket_fare_pence: null,
};

/**
 * Same composite with ticket_fare_pence absent entirely (undefined / missing key).
 * AC-1 RED: z.number() rejects undefined → safeParse returns success:false.
 */
const ELIGIBLE_COMPOSITE_NO_FARE_KEY = ((): object => {
  const copy: Record<string, unknown> = { ...ELIGIBLE_COMPOSITE_FARE_PRESENT };
  delete copy['ticket_fare_pence'];
  return copy;
})();

/**
 * Zero-fare edge case — valid for e.g. season ticket holders.
 * AC-1: should parse (0 is a valid number).
 */
const ELIGIBLE_COMPOSITE_ZERO_FARE = {
  ...ELIGIBLE_COMPOSITE_FARE_PRESENT,
  ticket_fare_pence: 0,
  compensation_pence: 0,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('TD-BL315-C AC-1: checkDelayResponseSchema — ticket_fare_pence nullable robustness', () => {

  // ── Baseline: existing schema should still accept non-null fare ──────────────

  describe('AC-1 baseline: eligible composite with ticket_fare_pence present (regression guard)', () => {
    it('AC-1: should parse eligible composite when ticket_fare_pence is a positive number', () => {
      // This already passes. It is a regression guard — Blake must not break it.
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_FARE_PRESENT);
      expect(result.success).toBe(true);
    });

    it('AC-1: parsed eligible composite preserves compensation_pence=14935 (DR15 50% of 29870)', () => {
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_FARE_PRESENT);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['compensation_pence']).toBe(14935);
      }
    });

    it('AC-1: parsed eligible composite preserves ticket_fare_pence=29870', () => {
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_FARE_PRESENT);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['ticket_fare_pence']).toBe(29870);
      }
    });
  });

  // ── AC-1 RED: null ticket_fare_pence ────────────────────────────────────────

  describe('AC-1 RED: eligible composite with ticket_fare_pence: null must parse successfully', () => {
    it('AC-1 RED: safeParse returns success:true when ticket_fare_pence is null (FAILS today — z.number() rejects null)', () => {
      // FAILS NOW: matchedTrueSchema declares ticket_fare_pence: z.number() which
      // rejects null. Fix: change to z.number().nullable()
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_NULL_FARE);
      // Expected after fix: true
      // Current behavior: false (z.number() fails on null → parse fails → BffParseError in prod)
      expect(result.success).toBe(true);
    });

    it('AC-1 RED: parsed result with null fare has ticket_fare_pence===null (nullable, not stripped)', () => {
      // FAILS NOW: same root cause — parse fails before we reach data inspection
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_NULL_FARE);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        // After fix: ticket_fare_pence should be null (nullable field)
        expect(data['ticket_fare_pence']).toBeNull();
      }
    });

    it('AC-1 RED: eligible:true is preserved when ticket_fare_pence is null', () => {
      // FAILS NOW: parse fails entirely so eligible field never reaches caller
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_NULL_FARE);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['eligible']).toBe(true);
      }
    });

    it('AC-1 RED: compensation_pence is preserved when ticket_fare_pence is null', () => {
      // FAILS NOW: parse fails — compensation_pence never reaches the caller
      // This is the fare-flow critical path: compensation is known even if fare is null
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_NULL_FARE);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        // compensation_pence is still present from the eligibility evaluation
        expect(data['compensation_pence']).toBe(14935);
      }
    });
  });

  // ── AC-1 RED: absent ticket_fare_pence ──────────────────────────────────────

  describe('AC-1 RED: eligible composite with ticket_fare_pence absent must parse (nullable or optional)', () => {
    it('AC-1 RED: safeParse returns success:true when ticket_fare_pence key is absent entirely', () => {
      // FAILS NOW: z.number() is required + non-nullable → absent key fails schema
      // Fix: z.number().nullable() (treats absent key as undefined → coerced to null by safeParse
      // OR z.number().nullable().optional() if the field can genuinely be omitted)
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_NO_FARE_KEY);
      expect(result.success).toBe(true);
    });
  });

  // ── AC-1: zero fare edge case (passes as regression guard) ──────────────────

  describe('AC-1: zero fare edge case — ticket_fare_pence:0 is valid', () => {
    it('AC-1: should parse eligible composite when ticket_fare_pence is 0', () => {
      // This should already pass (0 is a number). Regression guard.
      const result = checkDelayResponseSchema.safeParse(ELIGIBLE_COMPOSITE_ZERO_FARE);
      expect(result.success).toBe(true);
    });
  });

  // ── AC-1: ineligible eligible composite with null fare ───────────────────────

  describe('AC-1: eligible:false composite with null ticket_fare_pence (ineligible path)', () => {
    it('AC-1 RED: eligible:false composite with null fare must also parse (same schema branch)', () => {
      // The same matchedTrueSchema covers eligible:false (ineligible delayed journeys).
      // If ticket_fare_pence is null for an ineligible journey, it must also parse.
      const INELIGIBLE_NULL_FARE = {
        ...ELIGIBLE_COMPOSITE_FARE_PRESENT,
        eligible: false,
        compensation_pence: 0,
        compensation_percentage: 0,
        ticket_fare_pence: null,
        scheme: null,
        reasons: ['Delay under DR15 threshold for this ticket type'],
        applied_rules: [],
      };
      // FAILS NOW: same z.number() rejection
      const result = checkDelayResponseSchema.safeParse(INELIGIBLE_NULL_FARE);
      expect(result.success).toBe(true);
    });
  });
});
