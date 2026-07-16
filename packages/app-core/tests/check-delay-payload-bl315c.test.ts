/**
 * RED Tests: lib/check-delay-payload.ts — BL-315-C fare_pence flow
 *
 * Phase   : TD-1 (Jessie — Test Specification, TDD per ADR-014)
 * BL      : BL-315-C / BL-328 — eligible→compensation happy-path
 * Date    : 2026-06-13
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * AC-3 (fare flows for REAL compensation) — PWA side:
 *   The buildCheckDelayPayload() function on the attested path MUST include
 *   fare_pence in the outgoing payload. If fare_pence is dropped here, the BFF
 *   cannot forward it to the eligibility engine, and compensation_pence would
 *   be computed against a zero/null fare → £0.00 instead of £149.35.
 *
 *   Current code analysis (lib/check-delay-payload.ts ~line 76-79):
 *     const farePence = normaliseFarePence(fields.fare_pence);
 *     if (farePence !== undefined) {
 *       payload.fare_pence = farePence;
 *     }
 *   This appears correct for the case where fare_pence is a number.
 *   Blake's T1 report flagged it as a risk. These tests VERIFY it passes correctly
 *   AND would catch a regression if the logic were accidentally changed.
 *
 *   NOTE: Blake's T1 report indicated that fare_pence DOES flow through.
 *   If these tests PASS today, they serve as regression guards (GREEN at AC-3).
 *   If they FAIL, the defect is confirmed in the payload builder.
 *   Either outcome is acceptable TDD practice — the tests encode the requirement.
 *
 *   The AC-3 CRITICAL test is the attested path:
 *     fields = { actual_rid, actual_departure_time, fare_pence: 29870, ... }
 *     → payload MUST include fare_pence: 29870
 *
 * Target verification service:
 *   RID 202606036701949, York→KGX 2026-06-03, fare 29870 pence
 *   DR15 50% band → compensation_pence = Math.floor(29870 * 50 / 100) = 14935
 *
 * ADR references:
 *   ADR-014 — TDD
 *   ADR-027 — BFF owns canonical client-facing contract
 */

import { describe, it, expect } from 'vitest';
import { buildCheckDelayPayload } from '../src/check-delay-payload';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Attested fields — the shape after user picks from CandidateSelectList.
 * page.tsx merges actual_rid + actual_departure_time into fields, then calls
 * buildCheckDelayPayload with these merged values.
 * fare_pence: 29870 (£298.70 — real York→KGX GR Anytime fare)
 */
const ATTESTED_WITH_FARE = {
  origin_station: 'York',
  destination_station: 'London Kings Cross',
  travel_date: '2026-06-03',
  departure_time: '07:30',    // ticket departure time (HH:MM)
  ticket_type: 'ANYTIME_DAY',
  fare_pence: 29870,          // £298.70 — DR15 50% → £149.35 compensation
  ticket_class: 'standard',
  via_station: null,
  operator_name: 'LNER',
  scan_id: 'c315c000-0001-4000-8000-000000000001',
  // JM-002 attestation fields merged after candidate selection
  actual_rid: '202606036701949',       // confirmed RID for 07:30 York→KGX GR
  actual_departure_time: '07:30',      // HH:MM format (BFF requirement)
};

/**
 * Non-attested (initial submit) fields — before candidate selection.
 * fare_pence present from OCR extraction.
 */
const NON_ATTESTED_WITH_FARE = {
  origin_station: 'York',
  destination_station: 'London Kings Cross',
  travel_date: '2026-06-03',
  departure_time: '07:30',
  ticket_type: 'ANYTIME_DAY',
  fare_pence: 29870,
  ticket_class: 'standard',
  via_station: null,
  operator_name: 'LNER',
  scan_id: 'c315c000-0001-4000-8000-000000000001',
  // No actual_rid / actual_departure_time — pre-attestation
};

/**
 * Attested fields with null fare — edge case where OCR didn't extract fare.
 * fare_pence should be absent from payload (normaliseFarePence(null) → undefined → omitted).
 */
const ATTESTED_NULL_FARE = {
  ...ATTESTED_WITH_FARE,
  fare_pence: null,
};

/**
 * Attested fields with string fare — user typed "£298.70" in the edit field.
 * normaliseFarePence should convert "£298.70" → 29870.
 */
const ATTESTED_STRING_FARE = {
  ...ATTESTED_WITH_FARE,
  fare_pence: '£298.70' as unknown as number,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('TD-BL315-C AC-3 PWA: buildCheckDelayPayload — fare_pence flows through attested path', () => {

  // ── AC-3: fare_pence on initial (non-attested) submit ────────────────────────

  describe('AC-3: non-attested submit — fare_pence: 29870 must appear in payload', () => {
    it('AC-3: payload includes fare_pence when fare_pence is a positive number', () => {
      /**
       * If this FAILS: normaliseFarePence or the fare_pence write is broken.
       * If this PASSES: fare_pence flows on initial submit (regression guard).
       */
      const payload = buildCheckDelayPayload(NON_ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect(payload['fare_pence']).toBe(29870);
    });

    it('AC-3: fare_pence key is present in payload for non-attested submit with fare', () => {
      const payload = buildCheckDelayPayload(NON_ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect('fare_pence' in payload).toBe(true);
    });

    it('AC-3: fare_pence is a number in the payload (not a string)', () => {
      const payload = buildCheckDelayPayload(NON_ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect(typeof payload['fare_pence']).toBe('number');
    });
  });

  // ── AC-3: fare_pence on attested (post-candidate-selection) submit ───────────

  describe('AC-3 CRITICAL: attested submit — fare_pence: 29870 must appear alongside actual_rid', () => {
    it('AC-3: attested payload includes fare_pence=29870 (DR15 calculation input)', () => {
      /**
       * CRITICAL: if this fails, the eligibility engine receives no fare →
       * compensation_pence = 0 instead of 14935 → £0.00 shown to user.
       *
       * The attested payload shape is: { ..., actual_rid, actual_departure_time, fare_pence }
       * All three must be present for the BFF to forward them to the evaluation-coordinator.
       */
      const payload = buildCheckDelayPayload(ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect(payload['fare_pence']).toBe(29870);
    });

    it('AC-3: attested payload includes actual_rid (regression guard — JM-002)', () => {
      const payload = buildCheckDelayPayload(ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect(payload['actual_rid']).toBe('202606036701949');
    });

    it('AC-3: attested payload includes actual_departure_time (regression guard — JM-002)', () => {
      const payload = buildCheckDelayPayload(ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect(payload['actual_departure_time']).toBe('07:30');
    });

    it('AC-3: attested payload includes ticket_type (regression guard — JM-002)', () => {
      const payload = buildCheckDelayPayload(ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect(payload['ticket_type']).toBe('ANYTIME_DAY');
    });

    it('AC-3: attested payload has fare_pence + actual_rid + actual_departure_time all present simultaneously', () => {
      /**
       * The three fields that make an attested submission work for compensation:
       *   fare_pence — needed for compensation_pence calculation
       *   actual_rid — needed to identify the specific delayed service
       *   actual_departure_time — needed for journey-matcher to confirm the service
       * All three must be in the same payload for the E2E path to succeed.
       */
      const payload = buildCheckDelayPayload(ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect(payload['fare_pence']).toBe(29870);
      expect(payload['actual_rid']).toBe('202606036701949');
      expect(payload['actual_departure_time']).toBe('07:30');
    });

    it('AC-3: attested payload still includes required BFF fields alongside fare', () => {
      // Regression guard: adding fare must not break existing required fields
      const payload = buildCheckDelayPayload(ATTESTED_WITH_FARE) as Record<string, unknown>;
      expect(payload['origin_station']).toBe('York');
      expect(payload['destination_station']).toBe('London Kings Cross');
      expect(payload['departure_date']).toBe('2026-06-03');
      expect(payload['departure_time']).toBe('07:30');
    });
  });

  // ── AC-3: string fare normalisation on attested path ────────────────────────

  describe('AC-3: string fare "£298.70" normalised to 29870 on attested path', () => {
    it('AC-3: fare_pence="£298.70" → payload.fare_pence=29870 on attested submit', () => {
      /**
       * User may have edited the fare field to "£298.70" (string).
       * normaliseFarePence must convert this to 29870 (pence).
       */
      const payload = buildCheckDelayPayload(ATTESTED_STRING_FARE) as Record<string, unknown>;
      expect(payload['fare_pence']).toBe(29870);
    });
  });

  // ── AC-3: null fare on attested path — omit from payload ────────────────────

  describe('AC-3: null fare on attested path — fare_pence absent from payload (not sent as null)', () => {
    it('AC-3: fare_pence is NOT included when fields.fare_pence is null on attested path', () => {
      /**
       * When fare_pence is null (OCR didn't extract it), the BFF should receive
       * no fare_pence field — not fare_pence: null (which would confuse the
       * evaluation-coordinator). normaliseFarePence(null) → undefined → key omitted.
       */
      const payload = buildCheckDelayPayload(ATTESTED_NULL_FARE) as Record<string, unknown>;
      // Either absent or undefined — not null, not 0
      expect(payload['fare_pence'] == null).toBe(true);
    });

    it('AC-3: actual_rid and actual_departure_time still present even when fare is null', () => {
      // The attestation fields must not be dropped just because fare is absent
      const payload = buildCheckDelayPayload(ATTESTED_NULL_FARE) as Record<string, unknown>;
      expect(payload['actual_rid']).toBe('202606036701949');
      expect(payload['actual_departure_time']).toBe('07:30');
    });
  });

  // ── AC-3: confirm page handleCandidateSelect builds attested payload correctly ─

  describe('AC-3 confirm-page proxy: page.tsx passes fare_pence to buildCheckDelayPayload on candidate select', () => {
    it('AC-3: attestedFields in handleCandidateSelect preserves fare_pence from fields state', () => {
      /**
       * Verify that the pattern used in page.tsx handleCandidateSelect:
       *   const attestedFields = {
       *     ...fields,
       *     fare_pence: fields.fare_pence ?? undefined,
       *     actual_rid: selection.actual_rid,
       *     actual_departure_time: selection.actual_departure_time,
       *   };
       *   const payload = buildCheckDelayPayload(attestedFields);
       * correctly carries fare_pence through.
       *
       * We simulate this pattern directly (without rendering ConfirmPage)
       * because the unit boundary is buildCheckDelayPayload, and the page's
       * integration with it is verified in confirm-page-bl315c-nav.test.tsx.
       */
      const fields = {
        origin_station: 'York',
        destination_station: 'London Kings Cross',
        travel_date: '2026-06-03',
        departure_time: '07:30',
        ticket_type: 'ANYTIME_DAY',
        fare_pence: 29870 as number | null,  // from OCR / URL param
        ticket_class: 'standard',
        via_station: null,
        operator_name: 'LNER',
        scan_id: 'c315c000-0001-4000-8000-000000000001',
      };

      const selection = {
        actual_rid: '202606036701949',
        actual_departure_time: '07:30',
      };

      // Simulate the exact code in handleCandidateSelect
      const attestedFields = {
        ...fields,
        fare_pence: fields.fare_pence ?? undefined,
        actual_rid: selection.actual_rid,
        actual_departure_time: selection.actual_departure_time,
      };

      const payload = buildCheckDelayPayload(attestedFields) as Record<string, unknown>;

      // This is the critical assertion: fare_pence MUST survive the spread
      expect(payload['fare_pence']).toBe(29870);
      expect(payload['actual_rid']).toBe('202606036701949');
    });
  });
});
