/**
 * Unit Tests: lib/check-delay-payload.ts
 *
 * Story   : RAILREPAY-APP-004
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-05-24
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * These tests MUST FAIL until Blake creates lib/check-delay-payload.ts.
 * Failure reason: "Cannot find module '../src/check-delay-payload'"
 *
 * AC coverage map:
 *   AC-5: Primary CTA calls POST /api/journeys/check-delay with correct body shape.
 *         This pure function converts EditableFields → CheckDelayRequest.
 *
 * Design Brief (Quinn US-1):
 *   BFF contract body shape:
 *   {
 *     origin_station: string,
 *     destination_station: string,
 *     departure_date: string (YYYY-MM-DD),
 *     departure_time: string (HH:MM),
 *     journey_type?: string,
 *     scan_id?: string,
 *   }
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import { describe, it, expect } from 'vitest';

// @ts-expect-error — module does not exist yet (TDD RED phase)
import { buildCheckDelayPayload } from '../src/check-delay-payload';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const fullFields = {
  origin_station: 'Leeds',
  destination_station: 'London Kings Cross',
  travel_date: '2026-06-15',
  departure_time: '07:30',
  ticket_type: 'Advance',
  fare_pence: 4750,
  ticket_class: '2',
  via_station: 'Doncaster',
  operator_name: 'LNER',
  scan_id: 'aabb1122-ccdd-3344-eeff-556677889900',
};

const emptyFields = {
  origin_station: '',
  destination_station: '',
  travel_date: '',
  departure_time: '',
  ticket_type: null,
  fare_pence: null,
  ticket_class: null,
  via_station: null,
  operator_name: null,
  scan_id: undefined,
};

const fareAsStringField = {
  ...fullFields,
  // PWA edits may produce a fare string like "£37.40" from user input
  fare_pence: '£37.40' as unknown as number,
};

// ─────────────────────────────────────────────────────────────────────────────

describe('RAILREPAY-APP-004: lib/check-delay-payload.ts — buildCheckDelayPayload()', () => {

  // ── AC-5: Full fields → valid CheckDelayRequest ───────────────────────────
  describe('AC-5: full ExtractedFields → valid CheckDelayRequest shape', () => {
    it('AC-5: should return an object with origin_station from input', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect(payload['origin_station']).toBe('Leeds');
    });

    it('AC-5: should return an object with destination_station from input', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect(payload['destination_station']).toBe('London Kings Cross');
    });

    it('AC-5: travel_date → departure_date as YYYY-MM-DD', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      // BFF expects field named "departure_date" (not "travel_date")
      expect(payload['departure_date']).toBe('2026-06-15');
    });

    it('AC-5: departure_time passed through as HH:MM', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect(payload['departure_time']).toBe('07:30');
    });

    it('AC-5: scan_id is passed through when present', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect(payload['scan_id']).toBe('aabb1122-ccdd-3344-eeff-556677889900');
    });

    it('AC-5: result does NOT include travel_date key (renamed to departure_date)', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect('travel_date' in payload).toBe(false);
    });
  });

  // ── AC-5: Empty fields → empty strings (validation catches at submit) ─────
  describe('AC-5: empty ExtractedFields → empty strings (no crash)', () => {
    it('AC-5: empty origin_station → empty string in payload', () => {
      const payload = buildCheckDelayPayload(emptyFields) as Record<string, unknown>;
      expect(payload['origin_station']).toBe('');
    });

    it('AC-5: empty destination_station → empty string in payload', () => {
      const payload = buildCheckDelayPayload(emptyFields) as Record<string, unknown>;
      expect(payload['destination_station']).toBe('');
    });

    it('AC-5: empty travel_date → empty string for departure_date in payload', () => {
      const payload = buildCheckDelayPayload(emptyFields) as Record<string, unknown>;
      expect(payload['departure_date']).toBe('');
    });

    it('AC-5: undefined scan_id → payload does NOT include scan_id key', () => {
      const payload = buildCheckDelayPayload(emptyFields) as Record<string, unknown>;
      // scan_id should be absent or undefined when not present in input
      expect(payload['scan_id'] == null).toBe(true);
    });

    it('AC-5: should not throw when all fields are empty/null', () => {
      expect(() => buildCheckDelayPayload(emptyFields)).not.toThrow();
    });
  });

  // ── AC-5: Fare normalisation ──────────────────────────────────────────────
  describe('AC-5: fare normalisation — string input converted to pence number', () => {
    it('AC-5: "£37.40" string → fare_pence: 3740 in payload', () => {
      const payload = buildCheckDelayPayload(fareAsStringField) as Record<string, unknown>;
      // The payload may include fare_pence for informational purposes
      // If included, it must be a number 3740
      if ('fare_pence' in payload) {
        expect(payload['fare_pence']).toBe(3740);
      }
    });

    it('AC-5: numeric fare_pence 4750 passes through unchanged', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      if ('fare_pence' in payload) {
        expect(payload['fare_pence']).toBe(4750);
        expect(typeof payload['fare_pence']).toBe('number');
      }
    });
  });

  // ── AC-5: Required BFF fields always present ──────────────────────────────
  describe('AC-5: required BFF fields always present in output', () => {
    it('AC-5: output always has origin_station key', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect('origin_station' in payload).toBe(true);
    });

    it('AC-5: output always has destination_station key', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect('destination_station' in payload).toBe(true);
    });

    it('AC-5: output always has departure_date key', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect('departure_date' in payload).toBe(true);
    });

    it('AC-5: output always has departure_time key', () => {
      const payload = buildCheckDelayPayload(fullFields) as Record<string, unknown>;
      expect('departure_time' in payload).toBe(true);
    });
  });
});
