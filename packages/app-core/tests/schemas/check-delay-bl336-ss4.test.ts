/**
 * RED Tests: lib/schemas/check-delay.ts — BL-336 SS4 additions
 *
 * Story   : BL-336 SS4 — PWA per-leg selection multi-leg UX
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-06-15
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * jsdom caveat (project memory — SOP-IMPROVEMENT-010):
 *   These schema tests are deterministic and do NOT depend on browser rendering.
 *   Schema parse tests are the same in jsdom and real-browser. The SOP real-browser
 *   gate at US-5 applies to UX interaction tests, not to pure Zod parse tests.
 *
 * AC coverage map:
 *   AC-1: onward_plan:true field accepted in checkDelayRequestSchema
 *   AC-5: intended_legs:[{segment_order, rid}] accepted in checkDelayRequestSchema
 *   AC-8: Schema parse-safety — checkDelayResponseSchema PARSES a Mode-B
 *          intended_itinerary body (including empty alternatives, optional
 *          operator_name) WITHOUT throwing into the generic BffParseError path.
 *          (Critical lesson from ticket_fare_pence-nullable: a too-strict schema
 *           silently broke the eligible path. Same class of defect prevented here.)
 *
 * What these tests gate:
 *   - checkDelayRequestSchema must accept the new SS4 request fields:
 *       actual_rid + onward_plan:true  (Mode B probe)
 *       actual_rid + intended_legs     (Mode C submit)
 *   - checkDelayResponseSchema must accept the new intended_itinerary response
 *     variant (Mode B) in all legal shapes:
 *       - Full itinerary with 2 onward legs + alternatives
 *       - Empty alternatives array on a leg
 *       - Optional operator_name absent from planned/alternatives
 *       - Empty intended_itinerary:[] (single-leg backward-compat trigger)
 *
 * These tests MUST FAIL until Blake:
 *   1. Adds onward_plan + intended_legs to checkDelayRequestSchema
 *   2. Adds the intended_itinerary response variant to checkDelayResponseSchema
 *
 * ADR references:
 *   ADR-014 — TDD
 *   ADR-027 — BFF owns canonical client-facing contract
 *   DR-004  — Per-leg selection model for journeys with changes
 */

import { describe, it, expect } from 'vitest';

import {
  checkDelayRequestSchema,
  checkDelayResponseSchema,
} from '../../src/schemas/check-delay';

// ─── Base request (shared baseline) ──────────────────────────────────────────

const BASE_REQUEST = {
  origin_station: 'Leeds',
  destination_station: 'London Kings Cross',
  departure_date: '2026-06-15',
  departure_time: '07:30',
  ticket_type: 'ANYTIME_SINGLE',
  actual_rid: '202606150730001',
  actual_departure_time: '07:30',
};

// ─── Mode-B request: actual_rid + onward_plan:true ────────────────────────────
// Sent after leg-1 candidate selection to probe the BFF for intended itinerary.
// DIFFERENTIATOR from Mode C: onward_plan:true, NO intended_legs.

const MODE_B_REQUEST = {
  ...BASE_REQUEST,
  onward_plan: true,
  // Intentionally NO intended_legs — Mode B probe only
};

// ─── Mode-C request: actual_rid + intended_legs ───────────────────────────────
// Sent on final confirm — user has selected a specific RID for each onward leg.
// segment_order is 1-indexed from the BFF's perspective (contiguous rail segments).
// DIFFERENTIATOR from Mode B: has intended_legs, no onward_plan.

const MODE_C_REQUEST_TWO_LEGS = {
  ...BASE_REQUEST,
  intended_legs: [
    // Onward leg at segment_order 2 (change at Leeds→Peterborough)
    { segment_order: 2, rid: '202606150830002' },
    // Onward leg at segment_order 3 (Peterborough→Kings Cross)
    { segment_order: 3, rid: '202606150950003' },
  ],
};

const MODE_C_REQUEST_ONE_LEG = {
  ...BASE_REQUEST,
  intended_legs: [
    { segment_order: 2, rid: '202606150845001' },
  ],
};

// ─── Mode-B response: intended_itinerary variant ─────────────────────────────
// The full two-leg intended itinerary response from BFF (Mode B).
// DIFFERENTIATOR: different RIDs and times on each leg so leg-mixup fails tests.

const INTENDED_ITINERARY_RESPONSE_TWO_LEGS = {
  status: 'intended_itinerary',
  leg1: {
    segment_order: 1,
    rid: '202606150730001',
  },
  intended_itinerary: [
    {
      segment_order: 2,
      planned: {
        rid: '202606150830002',
        scheduled_departure: '08:30',
        scheduled_arrival: '09:20',
        origin_crs: 'LDS',
        destination_crs: 'PBR',
        toc_code: 'VT',
        operator_name: 'Avanti West Coast',
      },
      alternatives: [
        {
          rid: '202606150900002',
          scheduled_departure: '09:00',
          scheduled_arrival: '09:55',
          origin_crs: 'LDS',
          destination_crs: 'PBR',
          toc_code: 'VT',
          operator_name: 'Avanti West Coast',
        },
        {
          rid: '202606150930002',
          scheduled_departure: '09:30',
          scheduled_arrival: '10:25',
          origin_crs: 'LDS',
          destination_crs: 'PBR',
          toc_code: 'VT',
          // operator_name intentionally absent — optional field
        },
      ],
    },
    {
      segment_order: 3,
      planned: {
        rid: '202606150950003',
        scheduled_departure: '09:50',
        scheduled_arrival: '10:38',
        origin_crs: 'PBR',
        destination_crs: 'KGX',
        toc_code: 'GR',
        operator_name: 'LNER',
      },
      alternatives: [
        {
          rid: '202606151020003',
          scheduled_departure: '10:20',
          scheduled_arrival: '11:08',
          origin_crs: 'PBR',
          destination_crs: 'KGX',
          toc_code: 'GR',
          operator_name: 'LNER',
        },
      ],
    },
  ],
};

// AC-7 / AC-8 parse-safety: empty intended_itinerary → single-leg backward compat trigger
const INTENDED_ITINERARY_RESPONSE_EMPTY = {
  status: 'intended_itinerary',
  leg1: {
    segment_order: 1,
    rid: '202606150730001',
  },
  intended_itinerary: [],
};

// AC-8 parse-safety: empty alternatives on a leg must not fail schema
const INTENDED_ITINERARY_RESPONSE_EMPTY_ALTERNATIVES = {
  status: 'intended_itinerary',
  leg1: {
    segment_order: 1,
    rid: '202606150730001',
  },
  intended_itinerary: [
    {
      segment_order: 2,
      planned: {
        rid: '202606150830002',
        scheduled_departure: '08:30',
        scheduled_arrival: '09:20',
        origin_crs: 'LDS',
        destination_crs: 'PBR',
        toc_code: 'VT',
        // operator_name absent — optional
      },
      alternatives: [], // EMPTY — must parse fine (AC-8)
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────

describe('BL-336 SS4: check-delay schemas — onward_plan / intended_legs / intended_itinerary', () => {

  // ── AC-1: Mode-B request — onward_plan:true accepted ─────────────────────

  describe('AC-1: checkDelayRequestSchema accepts onward_plan:true for Mode-B probe', () => {
    it('AC-1: should accept Mode-B request with actual_rid + onward_plan:true', () => {
      // FAILS UNTIL: checkDelayRequestSchema gains onward_plan field
      const result = checkDelayRequestSchema.safeParse(MODE_B_REQUEST);
      expect(result.success).toBe(true);
    });

    it('AC-1: should preserve onward_plan:true in parsed output', () => {
      const result = checkDelayRequestSchema.safeParse(MODE_B_REQUEST);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['onward_plan']).toBe(true);
      }
    });

    it('AC-1: should accept request without onward_plan (backward compat — onward_plan is optional)', () => {
      const result = checkDelayRequestSchema.safeParse(BASE_REQUEST);
      expect(result.success).toBe(true);
    });

    it('AC-1: should NOT include intended_legs in a Mode-B request (distinguishing from Mode C)', () => {
      // Mode-B has onward_plan:true but no intended_legs
      // This is a data-shape guard — the two modes are mutually distinct inputs.
      const result = checkDelayRequestSchema.safeParse(MODE_B_REQUEST);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        // onward_plan present
        expect(data['onward_plan']).toBe(true);
        // intended_legs absent in Mode-B request
        expect(data['intended_legs']).toBeUndefined();
      }
    });
  });

  // ── AC-5: Mode-C request — intended_legs accepted ────────────────────────

  describe('AC-5: checkDelayRequestSchema accepts intended_legs for Mode-C submit', () => {
    it('AC-5: should accept Mode-C request with actual_rid + 2-leg intended_legs', () => {
      // FAILS UNTIL: checkDelayRequestSchema gains intended_legs field
      const result = checkDelayRequestSchema.safeParse(MODE_C_REQUEST_TWO_LEGS);
      expect(result.success).toBe(true);
    });

    it('AC-5: should accept Mode-C request with actual_rid + 1-leg intended_legs', () => {
      const result = checkDelayRequestSchema.safeParse(MODE_C_REQUEST_ONE_LEG);
      expect(result.success).toBe(true);
    });

    it('AC-5: should preserve intended_legs array in parsed output', () => {
      const result = checkDelayRequestSchema.safeParse(MODE_C_REQUEST_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const legs = data['intended_legs'] as Array<{ segment_order: number; rid: string }>;
        expect(Array.isArray(legs)).toBe(true);
        expect(legs.length).toBe(2);
      }
    });

    it('AC-5: should preserve segment_order for first onward leg', () => {
      const result = checkDelayRequestSchema.safeParse(MODE_C_REQUEST_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const legs = data['intended_legs'] as Array<{ segment_order: number; rid: string }>;
        // segment_order 2 = first onward leg (contiguous 1-indexed, leg-1 actual is 1)
        expect(legs[0]?.segment_order).toBe(2);
      }
    });

    it('AC-5: should preserve rid for each onward leg — distinct RIDs must not mix up', () => {
      // DIFFERENTIATING: distinct RIDs on each leg. If implementation ignores
      // segment_order and returns wrong leg, this assertion catches the mixup.
      const result = checkDelayRequestSchema.safeParse(MODE_C_REQUEST_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const legs = data['intended_legs'] as Array<{ segment_order: number; rid: string }>;
        // Leg at segment_order 2 has this specific RID
        const leg2 = legs.find((l) => l.segment_order === 2);
        expect(leg2?.rid).toBe('202606150830002');
        // Leg at segment_order 3 has a DIFFERENT RID — not interchangeable
        const leg3 = legs.find((l) => l.segment_order === 3);
        expect(leg3?.rid).toBe('202606150950003');
      }
    });

    it('AC-5: should reject intended_legs with non-numeric segment_order', () => {
      const result = checkDelayRequestSchema.safeParse({
        ...BASE_REQUEST,
        intended_legs: [{ segment_order: 'two', rid: '202606150830002' }], // string not number
      });
      expect(result.success).toBe(false);
    });

    it('AC-5: should reject intended_legs with empty rid string', () => {
      const result = checkDelayRequestSchema.safeParse({
        ...BASE_REQUEST,
        intended_legs: [{ segment_order: 2, rid: '' }], // blank not allowed
      });
      expect(result.success).toBe(false);
    });
  });

  // ── AC-8: Schema parse-safety for Mode-B intended_itinerary response ──────

  describe('AC-8: checkDelayResponseSchema parses intended_itinerary variant safely', () => {
    it('AC-8: should parse full two-leg intended_itinerary response without throwing', () => {
      // FAILS UNTIL: checkDelayResponseSchema gains the intended_itinerary variant.
      // This is the parse-safety gate — a missing schema variant causes BffParseError
      // in bff-client → "Something went wrong" in the UI (same class as the
      // ticket_fare_pence-nullable defect that broke the eligible happy path).
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_TWO_LEGS);
      expect(result.success).toBe(true);
    });

    it('AC-8: should preserve status=intended_itinerary in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        expect(data['status']).toBe('intended_itinerary');
      }
    });

    it('AC-8: should preserve leg1 in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const leg1 = data['leg1'] as Record<string, unknown>;
        expect(leg1).toBeDefined();
        expect(leg1['rid']).toBe('202606150730001');
        expect(leg1['segment_order']).toBe(1);
      }
    });

    it('AC-8: should preserve intended_itinerary array in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const itinerary = data['intended_itinerary'] as unknown[];
        expect(Array.isArray(itinerary)).toBe(true);
        expect(itinerary.length).toBe(2);
      }
    });

    it('AC-8: should preserve planned.rid for segment_order 2 in itinerary', () => {
      // DIFFERENTIATING: leg 2 and leg 3 have distinct planned RIDs.
      // If the schema collapses them or re-orders, this fails.
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const itinerary = data['intended_itinerary'] as Array<Record<string, unknown>>;
        const leg2 = itinerary.find((l) => l['segment_order'] === 2);
        const planned2 = leg2?.['planned'] as Record<string, unknown> | undefined;
        expect(planned2?.['rid']).toBe('202606150830002');
      }
    });

    it('AC-8: should preserve planned.rid for segment_order 3 in itinerary (distinct from leg 2)', () => {
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const itinerary = data['intended_itinerary'] as Array<Record<string, unknown>>;
        const leg3 = itinerary.find((l) => l['segment_order'] === 3);
        const planned3 = leg3?.['planned'] as Record<string, unknown> | undefined;
        // DISTINCT from leg 2's RID — '202606150830002' vs '202606150950003'
        expect(planned3?.['rid']).toBe('202606150950003');
      }
    });

    it('AC-8: should parse when operator_name is absent from planned (optional field)', () => {
      // operator_name is optional in planned — must not cause schema failure.
      // Same safety lesson as ticket_fare_pence: missing optional must not fail parse.
      const responseWithoutOperator = {
        status: 'intended_itinerary',
        leg1: { segment_order: 1, rid: '202606150730001' },
        intended_itinerary: [
          {
            segment_order: 2,
            planned: {
              rid: '202606150830002',
              scheduled_departure: '08:30',
              scheduled_arrival: '09:20',
              origin_crs: 'LDS',
              destination_crs: 'PBR',
              toc_code: 'VT',
              // operator_name intentionally absent
            },
            alternatives: [],
          },
        ],
      };
      const result = checkDelayResponseSchema.safeParse(responseWithoutOperator);
      expect(result.success).toBe(true);
    });

    it('AC-8: should parse when operator_name is absent from an alternative (optional field)', () => {
      // Alternatives may also lack operator_name — must parse fine.
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_TWO_LEGS);
      // The fixture already has an alternative WITHOUT operator_name (leg 2, alt index 1)
      // If this parses OK, the optional field guard is working.
      expect(result.success).toBe(true);
    });

    it('AC-8: should parse empty alternatives array on a leg', () => {
      // CRITICAL: empty alternatives means no alternatives but planned is still pre-selected.
      // The UI shows "planned" as the only option — no alternatives selectable.
      // The schema must NOT reject empty alternatives array.
      const result = checkDelayResponseSchema.safeParse(
        INTENDED_ITINERARY_RESPONSE_EMPTY_ALTERNATIVES,
      );
      expect(result.success).toBe(true);
    });

    it('AC-8: should parse empty intended_itinerary:[] (single-leg backward-compat trigger)', () => {
      // CRITICAL (AC-7): empty intended_itinerary means single-leg journey.
      // The schema MUST parse this variant — the PWA checks empty array to trigger
      // the existing single-leg submit path (no per-leg UI shown).
      // Failing to parse empty array means "Something went wrong" instead of
      // the correct single-leg terminal result.
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_EMPTY);
      expect(result.success).toBe(true);
    });

    it('AC-8: should preserve empty intended_itinerary:[] in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_EMPTY);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const itinerary = data['intended_itinerary'] as unknown[];
        expect(Array.isArray(itinerary)).toBe(true);
        expect(itinerary.length).toBe(0);
      }
    });

    it('AC-8: existing response variants still parse correctly alongside new intended_itinerary variant', () => {
      // Regression guard: adding a new union variant must not break existing variants.
      const pendingResult = checkDelayResponseSchema.safeParse({
        matched: true,
        journey_id: 'jrn-existing-regression-guard',
        status: 'pending',
        message: 'not yet available',
      });
      expect(pendingResult.success).toBe(true);
    });

    it('AC-8: candidates variant still parses correctly alongside new intended_itinerary variant', () => {
      const candidatesResult = checkDelayResponseSchema.safeParse({
        status: 'candidates',
        journey_id: null,
        candidates: [
          { rid: '202606150730001', scheduled_departure: '07:30', toc_code: 'GR' },
        ],
      });
      expect(candidatesResult.success).toBe(true);
    });

    it('AC-8: planned fields scheduled_departure and scheduled_arrival must be strings in parsed output', () => {
      const result = checkDelayResponseSchema.safeParse(INTENDED_ITINERARY_RESPONSE_TWO_LEGS);
      expect(result.success).toBe(true);
      if (result.success) {
        const data = result.data as Record<string, unknown>;
        const itinerary = data['intended_itinerary'] as Array<Record<string, unknown>>;
        const leg2 = itinerary.find((l) => l['segment_order'] === 2);
        const planned2 = leg2?.['planned'] as Record<string, unknown> | undefined;
        // HH:MM strings as emitted by BFF SS3
        expect(typeof planned2?.['scheduled_departure']).toBe('string');
        expect(typeof planned2?.['scheduled_arrival']).toBe('string');
      }
    });
  });
});
