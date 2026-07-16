/**
 * Unit Tests: lib/schemas/check-delay.ts
 *
 * Story   : RAILREPAY-APP-004
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-05-24
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * These tests MUST FAIL until Blake creates lib/schemas/check-delay.ts.
 * Failure reason: "Cannot find module '../../src/schemas/check-delay'"
 *
 * AC coverage map:
 *   AC-5: Primary CTA calls POST /api/journeys/check-delay with validated body.
 *         CheckDelayResponse schema validates all 4 BFF response variants.
 *
 * BFF contract (Quinn US-1 spec, WEB-BFF-005 endpoint):
 *   Request body: { origin_station, destination_station, departure_date, departure_time, journey_type?, scan_id? }
 *   Response variants:
 *     1. matched-true:  { matched: true, delay_minutes: number, delayed: boolean, compensation_amount: number, eligible: boolean, eligibility_reason: string }
 *     2. matched-false: { matched: false }
 *     3. pending:       { status: 'pending' }
 *     4. pending_elig:  { status: 'pending_eligibility', delay_minutes: number, delayed: boolean }
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — module does not exist yet (TDD RED phase)
import { checkDelayRequestSchema, checkDelayResponseSchema } from '../../src/schemas/check-delay';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validRequest = {
  origin_station: 'Leeds',
  destination_station: 'London Kings Cross',
  departure_date: '2026-06-15',
  departure_time: '07:30',
};

const validRequestWithOptionals = {
  ...validRequest,
  journey_type: 'single',
  scan_id: 'aabb1122-ccdd-3344-eeff-556677889900',
};

// BL-306 self-fix (Jessie T2-test): re-anchored to real BFF contract (ADR-027).
// Phantom fields removed: delayed, compensation_amount, eligibility_reason.
// Real fields added per lib/schemas/check-delay.ts (Blake's GREEN implementation).
const matchedTrueResponse = {
  matched: true,
  journey_id: 'jrn-leeds-lon-20260615-0730',
  delay_minutes: 35,
  cancelled: false,
  last_observed_at: '2026-06-15T08:05:00Z',
  status: 'completed',
  eligible: true,
  scheme: 'delay_repay',
  compensation_percentage: 50,
  compensation_pence: 1000,
  ticket_fare_pence: 2000,
  reasons: [],
  applied_rules: ['DR_30MIN'],
  evaluation_timestamp: '2026-06-15T08:10:00Z',
};

// BL-306 self-fix: matchedFalseSchema requires journey_id:null + reason.
const matchedFalseResponse = {
  matched: false,
  journey_id: null,
  reason: 'No matching journey found in timetable graph',
};

// BL-306 self-fix: pendingSchema requires matched:true + journey_id + message.
const pendingResponse = {
  matched: true,
  journey_id: 'jrn-leeds-lon-20260615-0730',
  status: 'pending',
  message: 'Delay data not yet available — check back shortly.',
};

// BL-306 self-fix: pendingEligibilitySchema requires matched:true, journey_id,
// cancelled, last_observed_at, message. Phantom field `delayed` removed.
const pendingEligibilityResponse = {
  matched: true,
  journey_id: 'jrn-leeds-lon-20260615-0730',
  delay_minutes: 25,
  cancelled: false,
  last_observed_at: '2026-06-15T07:55:00Z',
  status: 'pending_eligibility',
  message: 'Eligibility calculation in progress.',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('RAILREPAY-APP-004: lib/schemas/check-delay.ts', () => {

  // ── CheckDelayRequest schema ──────────────────────────────────────────────
  describe('checkDelayRequestSchema: validates POST /api/journeys/check-delay body', () => {
    it('should parse a minimal valid request body', () => {
      const result = checkDelayRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should parse a request body with optional journey_type and scan_id', () => {
      const result = checkDelayRequestSchema.safeParse(validRequestWithOptionals);
      expect(result.success).toBe(true);
    });

    it('should reject request with missing origin_station', () => {
      const { origin_station: _omit, ...noOrigin } = validRequest;
      void _omit;
      const result = checkDelayRequestSchema.safeParse(noOrigin);
      expect(result.success).toBe(false);
    });

    it('should reject request with missing destination_station', () => {
      const { destination_station: _omit, ...noDestination } = validRequest;
      void _omit;
      const result = checkDelayRequestSchema.safeParse(noDestination);
      expect(result.success).toBe(false);
    });

    it('should reject request with missing departure_date', () => {
      const { departure_date: _omit, ...noDepartureDate } = validRequest;
      void _omit;
      const result = checkDelayRequestSchema.safeParse(noDepartureDate);
      expect(result.success).toBe(false);
    });

    it('should reject request with missing departure_time', () => {
      const { departure_time: _omit, ...noDepartureTime } = validRequest;
      void _omit;
      const result = checkDelayRequestSchema.safeParse(noDepartureTime);
      expect(result.success).toBe(false);
    });

    it('should reject request with empty origin_station', () => {
      const result = checkDelayRequestSchema.safeParse({
        ...validRequest,
        origin_station: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject request with empty destination_station', () => {
      const result = checkDelayRequestSchema.safeParse({
        ...validRequest,
        destination_station: '',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── CheckDelayResponse schema — variant 1: matched-true ──────────────────
  describe('checkDelayResponseSchema: variant 1 — matched-true', () => {
    it('should parse matched-true response with all delay/eligibility fields', () => {
      const result = checkDelayResponseSchema.safeParse(matchedTrueResponse);
      expect(result.success).toBe(true);
    });

    it('should preserve matched: true in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(matchedTrueResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['matched']).toBe(true);
      }
    });

    it('should preserve delay_minutes as number in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(matchedTrueResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['delay_minutes']).toBe(35);
      }
    });

    it('should preserve eligible: true in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(matchedTrueResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['eligible']).toBe(true);
      }
    });

    it('should preserve compensation_pence as number in parsed output', () => {
      // BL-306 self-fix: compensation_pence is the real BFF field (ADR-027).
      // compensation_amount was a phantom field — removed from schema.
      const result = checkDelayResponseSchema.safeParse(matchedTrueResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['compensation_pence']).toBe(1000);
      }
    });
  });

  // ── CheckDelayResponse schema — variant 2: matched-false ─────────────────
  describe('checkDelayResponseSchema: variant 2 — matched-false', () => {
    it('should parse matched-false response', () => {
      const result = checkDelayResponseSchema.safeParse(matchedFalseResponse);
      expect(result.success).toBe(true);
    });

    it('should preserve matched: false in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(matchedFalseResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['matched']).toBe(false);
      }
    });
  });

  // ── CheckDelayResponse schema — variant 3: pending ───────────────────────
  describe('checkDelayResponseSchema: variant 3 — pending', () => {
    it('should parse pending response', () => {
      const result = checkDelayResponseSchema.safeParse(pendingResponse);
      expect(result.success).toBe(true);
    });

    it('should preserve status: "pending" in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(pendingResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['status']).toBe('pending');
      }
    });
  });

  // ── CheckDelayResponse schema — variant 4: pending_eligibility ───────────
  describe('checkDelayResponseSchema: variant 4 — pending_eligibility', () => {
    it('should parse pending_eligibility response', () => {
      const result = checkDelayResponseSchema.safeParse(pendingEligibilityResponse);
      expect(result.success).toBe(true);
    });

    it('should preserve status: "pending_eligibility" in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(pendingEligibilityResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['status']).toBe('pending_eligibility');
      }
    });

    it('should preserve delay_minutes in pending_eligibility parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(pendingEligibilityResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['delay_minutes']).toBe(25);
      }
    });
  });

  // ── CheckDelayResponse schema — rejects invalid ───────────────────────────
  describe('checkDelayResponseSchema: rejects malformed responses', () => {
    it('should reject an empty object', () => {
      const result = checkDelayResponseSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject a response with an unknown status value', () => {
      const result = checkDelayResponseSchema.safeParse({ status: 'unknown_status' });
      expect(result.success).toBe(false);
    });
  });
});
