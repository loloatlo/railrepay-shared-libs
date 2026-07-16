/**
 * T2 RED tests: lib/check-delay-payload.ts — JM-002 production bug regression
 *
 * Troubleshooting workflow: T2-test (Jessie)
 * Root cause (Blake T1): buildCheckDelayPayload SILENTLY DROPS ticket_type,
 *   actual_rid, and actual_departure_time — the comment "ticket_type is not the
 *   same field, leave for future mapping" (line 65) caused all three fields to
 *   be omitted even though fields.ticket_type is present from OCR extracted_fields
 *   and the CheckDelayRequest schema explicitly accepts them.
 *
 * Production failure (2026-06-03 08:27 York→KGX):
 *   ticket_type='anytime' was extracted by OCR → carried in ?fields= URL param
 *   → buildCheckDelayPayload dropped it → BFF received no ticket_type
 *   → journey-matcher treated it as non-anytime → single match → delay-tracker
 *   404 for that RID → poll exhausted → PollTimeout shown to user.
 *
 * These tests MUST FAIL against HEAD (f9eeff4) because buildCheckDelayPayload
 * does NOT currently write ticket_type / actual_rid / actual_departure_time.
 * Failure reason: "expected undefined to be 'anytime'" (and equivalents).
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * AC coverage map (T0 ACs):
 *   AC-1: candidate list renders on confirm page for anytime ticket
 *         → ticket_type MUST reach the BFF for journey-matcher to return candidates
 *   AC-2: after selection, attested request submitted → eligibility resolves
 *         → actual_rid + actual_departure_time MUST reach BFF on re-submit
 *   AC-4: real PWA confirm-page→BFF path closes boundary-smoke gap
 *         → payload builder is the first boundary; it must not silently drop fields
 *
 * ADR references:
 *   ADR-014 — TDD
 *   ADR-027 — BFF owns canonical client-facing contract
 */

import { describe, it, expect } from 'vitest';
import { buildCheckDelayPayload } from '../src/check-delay-payload';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Anytime ticket fields — the exact shape OCR produces + URL ?fields= param carries */
const ANYTIME_FIELDS = {
  origin_station: 'York',
  destination_station: 'London Kings Cross',
  travel_date: '2026-06-03',
  departure_time: '08:27',
  ticket_type: 'anytime',
  fare_pence: 8950,
  ticket_class: 'S',
  via_station: null,
  operator_name: 'LNER',
  scan_id: 'f9eeff41-0000-0000-0000-000000000001',
};

/** Advance ticket — ticket_type present but should produce a string ticket_type in payload */
const ADVANCE_FIELDS = {
  origin_station: 'Leeds',
  destination_station: 'London Kings Cross',
  travel_date: '2026-06-15',
  departure_time: '07:30',
  ticket_type: 'advance',
  fare_pence: 4750,
  ticket_class: '2',
  via_station: null,
  operator_name: 'LNER',
  scan_id: 'aabb1122-ccdd-3344-eeff-556677889900',
};

/** Fields with NO ticket_type (legacy/absent) — should NOT include ticket_type in payload */
const NO_TICKET_TYPE_FIELDS = {
  origin_station: 'Birmingham New Street',
  destination_station: 'London Euston',
  travel_date: '2026-06-10',
  departure_time: '09:15',
  ticket_type: null,
  fare_pence: 3200,
  ticket_class: '2',
  via_station: null,
  operator_name: 'Avanti West Coast',
  scan_id: 'ccdd1122-eeff-3344-aabb-001122334455',
};

/** Empty/absent ticket_type — should NOT include ticket_type in payload */
const EMPTY_TICKET_TYPE_FIELDS = {
  origin_station: 'Manchester Piccadilly',
  destination_station: 'London Euston',
  travel_date: '2026-07-01',
  departure_time: '10:00',
  ticket_type: '',
  fare_pence: 5100,
  ticket_class: '2',
  via_station: null,
  operator_name: 'Avanti West Coast',
  scan_id: undefined,
};

/**
 * Attested re-submit fields — after user picks 08:56 from CandidateSelectList,
 * page merges actual_rid + actual_departure_time into fields before re-submitting.
 * This is the shape buildCheckDelayPayload receives on the second call.
 */
const ATTESTED_FIELDS = {
  origin_station: 'York',
  destination_station: 'London Kings Cross',
  travel_date: '2026-06-03',
  departure_time: '08:27',
  ticket_type: 'anytime',
  fare_pence: 8950,
  ticket_class: 'S',
  via_station: null,
  operator_name: 'LNER',
  scan_id: 'f9eeff41-0000-0000-0000-000000000001',
  // Attestation fields merged in after candidate selection:
  actual_rid: '202606030856001',
  actual_departure_time: '08:56',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('T2 Bug 1 — buildCheckDelayPayload: ticket_type and attestation fields dropped (AC-1/AC-2/AC-4)', () => {

  // ── AC-1: ticket_type mapping ─────────────────────────────────────────────
  // The production failure root cause: ticket_type='anytime' was silently dropped.
  // Without ticket_type in the request, journey-matcher falls back to single-match
  // → no candidates response → no CandidateSelectList → timeout.

  describe('AC-1: ticket_type must be included in payload when present (non-empty string)', () => {
    it('AC-1: should include ticket_type="anytime" in payload when fields.ticket_type="anytime"', () => {
      // FAILS NOW: buildCheckDelayPayload ignores ticket_type (line 65 comment)
      const payload = buildCheckDelayPayload(ANYTIME_FIELDS) as Record<string, unknown>;
      expect(payload['ticket_type']).toBe('anytime');
    });

    it('AC-1: should include ticket_type="advance" in payload when fields.ticket_type="advance"', () => {
      // FAILS NOW: same root cause — all ticket_type values are dropped
      const payload = buildCheckDelayPayload(ADVANCE_FIELDS) as Record<string, unknown>;
      expect(payload['ticket_type']).toBe('advance');
    });

    it('AC-1: ticket_type must be present as a key in the output when it has a non-empty value', () => {
      // FAILS NOW: key entirely absent from payload object
      const payload = buildCheckDelayPayload(ANYTIME_FIELDS) as Record<string, unknown>;
      expect('ticket_type' in payload).toBe(true);
    });
  });

  describe('AC-1: ticket_type must be OMITTED when absent or empty', () => {
    it('AC-1: should NOT include ticket_type when fields.ticket_type is null', () => {
      // This should PASS now (field is dropped), but we document the expected contract:
      // null → omitted (no key or undefined value). This is the correct behavior.
      // We include it so Blake cannot satisfy the inclusion tests by always including ticket_type.
      const payload = buildCheckDelayPayload(NO_TICKET_TYPE_FIELDS) as Record<string, unknown>;
      expect(payload['ticket_type'] == null).toBe(true);
    });

    it('AC-1: should NOT include ticket_type when fields.ticket_type is empty string', () => {
      // Empty string → omit from payload (BFF schema requires string().optional() not empty string)
      const payload = buildCheckDelayPayload(EMPTY_TICKET_TYPE_FIELDS) as Record<string, unknown>;
      expect(payload['ticket_type'] == null).toBe(true);
    });
  });

  // ── AC-2: actual_rid mapping (attested re-submit) ─────────────────────────
  // After user picks a candidate, page.tsx merges actual_rid + actual_departure_time
  // into the fields object and calls buildCheckDelayPayload again. These fields
  // MUST appear in the output payload for the BFF to forward them to journey-matcher.

  describe('AC-2: actual_rid must be included in payload when present (attested re-submit)', () => {
    it('AC-2: should include actual_rid in payload when fields.actual_rid is set', () => {
      // FAILS NOW: actual_rid is an extra field not mapped by buildCheckDelayPayload
      const payload = buildCheckDelayPayload(ATTESTED_FIELDS) as Record<string, unknown>;
      expect(payload['actual_rid']).toBe('202606030856001');
    });

    it('AC-2: actual_rid must be present as a key in the output when set on input', () => {
      // FAILS NOW: key entirely absent
      const payload = buildCheckDelayPayload(ATTESTED_FIELDS) as Record<string, unknown>;
      expect('actual_rid' in payload).toBe(true);
    });

    it('AC-2: should NOT include actual_rid when fields.actual_rid is absent', () => {
      // Correct behaviour: omit when not provided (anytime without attestation → candidates)
      const payload = buildCheckDelayPayload(ANYTIME_FIELDS) as Record<string, unknown>;
      expect(payload['actual_rid'] == null).toBe(true);
    });
  });

  describe('AC-2: actual_departure_time must be included in payload when present (attested re-submit)', () => {
    it('AC-2: should include actual_departure_time in payload when fields.actual_departure_time is set', () => {
      // FAILS NOW: actual_departure_time is an extra field not mapped
      const payload = buildCheckDelayPayload(ATTESTED_FIELDS) as Record<string, unknown>;
      expect(payload['actual_departure_time']).toBe('08:56');
    });

    it('AC-2: actual_departure_time must be present as a key in the output when set on input', () => {
      // FAILS NOW: key entirely absent
      const payload = buildCheckDelayPayload(ATTESTED_FIELDS) as Record<string, unknown>;
      expect('actual_departure_time' in payload).toBe(true);
    });

    it('AC-2: should NOT include actual_departure_time when fields.actual_departure_time is absent', () => {
      // Correct behaviour: omit when not provided
      const payload = buildCheckDelayPayload(ANYTIME_FIELDS) as Record<string, unknown>;
      expect(payload['actual_departure_time'] == null).toBe(true);
    });
  });

  // ── AC-2: full attested payload shape ─────────────────────────────────────

  describe('AC-2: full attested re-submit — all three new fields present together', () => {
    it('AC-2: attested payload contains ticket_type + actual_rid + actual_departure_time simultaneously', () => {
      // FAILS NOW: all three missing
      const payload = buildCheckDelayPayload(ATTESTED_FIELDS) as Record<string, unknown>;
      expect(payload['ticket_type']).toBe('anytime');
      expect(payload['actual_rid']).toBe('202606030856001');
      expect(payload['actual_departure_time']).toBe('08:56');
    });

    it('AC-2: attested payload still includes the core required fields alongside attestation', () => {
      // Regression guard: attestation mapping must not break existing required fields
      const payload = buildCheckDelayPayload(ATTESTED_FIELDS) as Record<string, unknown>;
      expect(payload['origin_station']).toBe('York');
      expect(payload['destination_station']).toBe('London Kings Cross');
      expect(payload['departure_date']).toBe('2026-06-03');
      expect(payload['departure_time']).toBe('08:27');
    });
  });

  // ── AC-4: boundary smoke — payload is the first boundary crossing ─────────

  describe('AC-4: payload builder is the first PWA→BFF boundary — fields must not be silently dropped', () => {
    it('AC-4: an anytime ticket\'s ticket_type survives the builder and would reach the BFF', () => {
      // This is the root cause of the production failure in plain language:
      // the payload builder is the border guard. If it drops ticket_type here,
      // nothing downstream can recover it.
      // FAILS NOW.
      const payload = buildCheckDelayPayload(ANYTIME_FIELDS) as Record<string, unknown>;
      expect(payload['ticket_type']).toBeDefined();
      expect(payload['ticket_type']).not.toBeNull();
      expect(payload['ticket_type']).not.toBe('');
    });

    it('AC-4: an attested re-submit\'s actual_rid survives the builder and would reach the BFF', () => {
      // Without actual_rid in the payload, journey-matcher cannot identify the
      // specific service the user attested to — attestation is silently lost.
      // FAILS NOW.
      const payload = buildCheckDelayPayload(ATTESTED_FIELDS) as Record<string, unknown>;
      expect(payload['actual_rid']).toBeDefined();
      expect(payload['actual_rid']).not.toBeNull();
    });
  });
});
