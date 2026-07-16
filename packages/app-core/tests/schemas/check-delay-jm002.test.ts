/**
 * Unit Tests: lib/schemas/check-delay.ts — RAILREPAY-JM-002 additions
 *
 * RAILREPAY-JM-002 — US-2 RED tests (Jessie, 2026-06-07)
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify this file.
 *
 * This file is ADDITIVE to the existing schemas/check-delay.test.ts (APP-004/BL-306).
 * Pre-existing tests are NOT duplicated here.
 *
 * ACs covered:
 *   AC-9: PWA schema carries candidate + attested shapes for request and response.
 *         checkDelayRequestSchema accepts ticket_type, actual_departure_time, actual_rid.
 *         checkDelayResponseSchema accepts a new 'candidates' variant.
 *
 * ADR references:
 *   ADR-014 — TDD
 *   ADR-027 — BFF owns canonical client-facing contract
 */

import { describe, it, expect } from 'vitest';

import {
  checkDelayRequestSchema,
  checkDelayResponseSchema,
} from '../../src/schemas/check-delay';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const BASE_REQUEST = {
  origin_station: 'York',
  destination_station: 'London Kings Cross',
  departure_date: '2026-06-03',
  departure_time: '08:56',
};

/** New fields for JM-002 — attestation */
const REQUEST_WITH_TICKET_TYPE = {
  ...BASE_REQUEST,
  ticket_type: 'anytime',
};

const REQUEST_WITH_FULL_ATTESTATION = {
  ...BASE_REQUEST,
  ticket_type: 'anytime',
  actual_departure_time: '08:56',
  actual_rid: '202606030856001',
};

/** Candidate-list response variant (new for JM-002) */
const CANDIDATES_RESPONSE = {
  status: 'candidates',
  journey_id: null,
  candidates: [
    { rid: '202606030730001', scheduled_departure: '07:30' },
    { rid: '202606030856001', scheduled_departure: '08:56' },
    { rid: '202606037108175', scheduled_departure: '10:17' },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RAILREPAY-JM-002: check-delay schemas — candidate + attested shapes (AC-9)', () => {

  // ── AC-9: Request schema accepts new optional fields ──────────────────────

  describe('AC-9 checkDelayRequestSchema: accepts ticket_type / actual_departure_time / actual_rid', () => {
    it('AC-9: should accept base request without new fields (backward compat)', () => {
      const result = checkDelayRequestSchema.safeParse(BASE_REQUEST);
      expect(result.success).toBe(true);
    });

    it('AC-9: should accept request with ticket_type only', () => {
      const result = checkDelayRequestSchema.safeParse(REQUEST_WITH_TICKET_TYPE);
      expect(result.success).toBe(true);
    });

    it('AC-9: should accept request with full attestation fields', () => {
      const result = checkDelayRequestSchema.safeParse(REQUEST_WITH_FULL_ATTESTATION);
      expect(result.success).toBe(true);
    });

    it('AC-9: should preserve ticket_type in parsed output', () => {
      const result = checkDelayRequestSchema.safeParse(REQUEST_WITH_TICKET_TYPE);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['ticket_type']).toBe('anytime');
      }
    });

    it('AC-9: should preserve actual_departure_time in parsed output', () => {
      const result = checkDelayRequestSchema.safeParse(REQUEST_WITH_FULL_ATTESTATION);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['actual_departure_time']).toBe('08:56');
      }
    });

    it('AC-9: should preserve actual_rid in parsed output', () => {
      const result = checkDelayRequestSchema.safeParse(REQUEST_WITH_FULL_ATTESTATION);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['actual_rid']).toBe('202606030856001');
      }
    });

    it('AC-9: should reject actual_departure_time in non-HH:MM format', () => {
      const result = checkDelayRequestSchema.safeParse({
        ...BASE_REQUEST,
        ticket_type: 'anytime',
        actual_departure_time: '8:56am', // invalid
      });
      expect(result.success).toBe(false);
    });

    it('AC-9: should reject empty string actual_rid', () => {
      const result = checkDelayRequestSchema.safeParse({
        ...BASE_REQUEST,
        ticket_type: 'anytime',
        actual_rid: '', // blank not allowed when present
      });
      expect(result.success).toBe(false);
    });
  });

  // ── AC-9: Response schema accepts new candidates variant ─────────────────

  describe('AC-9 checkDelayResponseSchema: candidates variant accepted', () => {
    it('AC-9: should accept candidates response shape', () => {
      const result = checkDelayResponseSchema.safeParse(CANDIDATES_RESPONSE);
      expect(result.success).toBe(true);
    });

    it('AC-9: should preserve status=candidates in parsed candidates output', () => {
      const result = checkDelayResponseSchema.safeParse(CANDIDATES_RESPONSE);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['status']).toBe('candidates');
      }
    });

    it('AC-9: should preserve candidates array in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(CANDIDATES_RESPONSE);
      expect(result.success).toBe(true);
      if (result.success) {
        const candidates = (result.data as Record<string, unknown>)['candidates'] as unknown[];
        expect(Array.isArray(candidates)).toBe(true);
        expect(candidates.length).toBe(3);
      }
    });

    it('AC-9: should preserve journey_id=null in candidates response', () => {
      const result = checkDelayResponseSchema.safeParse(CANDIDATES_RESPONSE);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['journey_id']).toBeNull();
      }
    });

    it('AC-9: should reject candidates response without candidates array', () => {
      const result = checkDelayResponseSchema.safeParse({
        status: 'candidates',
        journey_id: null,
        // Missing candidates array
      });
      expect(result.success).toBe(false);
    });

    it('AC-9: existing variants still parse correctly alongside new candidates variant', () => {
      // Ensure union is not broken by the new variant
      const pendingResult = checkDelayResponseSchema.safeParse({
        matched: true,
        journey_id: 'jrn-existing',
        status: 'pending',
        message: 'not yet available',
      });
      expect(pendingResult.success).toBe(true);
    });
  });
});
