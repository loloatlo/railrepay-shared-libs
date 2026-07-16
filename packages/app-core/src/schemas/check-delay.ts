/**
 * Zod schemas for the check-delay BFF endpoint.
 *
 * Story   : RAILREPAY-APP-004
 * Phase   : US-3 (Blake — Implementation)
 * BL-306  : Reconciled to real BFF contract (ADR-027)
 *
 * AC-5:  Validates POST /api/journeys/check-delay request body and the 4
 *        possible BFF response variants.
 * BL-306: Removed phantom fields (compensation_amount, delayed, eligibility_reason).
 *         Added real fields (compensation_pence, reasons[], status, cancelled,
 *         journey_id, etc.). All four variants now accept real BFF payloads.
 *
 * ADR references:
 *   ADR-014 — TDD
 *   ADR-027 — BFF owns canonical client-facing contract
 */

import { z } from 'zod';

// ─── Request schema ───────────────────────────────────────────────────────────

export const checkDelayRequestSchema = z.object({
  origin_station: z.string().min(1),
  destination_station: z.string().min(1),
  departure_date: z.string().min(1),
  departure_time: z.string().min(1),
  journey_type: z.string().optional(),
  scan_id: z.string().optional(),
  // JM-002: Anytime/Any-Permitted ticket attestation fields (AC-9)
  ticket_type: z.string().optional(),
  actual_departure_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, 'actual_departure_time must be HH:MM format')
    .optional(),
  actual_rid: z
    .string()
    .min(1, 'actual_rid must not be blank when present')
    .optional(),
  // BL-336 SS4: Mode-B probe flag — requests intended itinerary from BFF (DR-004)
  onward_plan: z.boolean().optional(),
  // BL-336 SS4: Mode-C confirm — user-selected RID per onward rail leg (DR-004)
  intended_legs: z
    .array(
      z.object({
        segment_order: z.number().int(),
        rid: z.string().min(1),
      }),
    )
    .optional(),
});

export type CheckDelayRequest = z.infer<typeof checkDelayRequestSchema>;

// ─── Response schema — 4 variants ────────────────────────────────────────────

/**
 * Variant 1: journey matched and delay/eligibility fully computed (terminal state).
 * BFF emits this when evaluation_timestamp is present (lines 407-424 of handler).
 * Real fields: compensation_pence (NOT compensation_amount), reasons[] (NOT eligibility_reason),
 * NO `delayed` boolean (PWA derives delayed from delay_minutes > 0).
 */
const matchedTrueSchema = z.object({
  matched: z.literal(true),
  journey_id: z.string(),
  delay_minutes: z.number(),
  cancelled: z.boolean(),
  last_observed_at: z.string(),
  status: z.string(),
  eligible: z.boolean(),
  scheme: z.string().nullable(),
  compensation_percentage: z.number(),
  compensation_pence: z.number(),
  ticket_fare_pence: z.number().nullable().optional(),
  reasons: z.array(z.string()),
  applied_rules: z.array(z.string()),
  evaluation_timestamp: z.string(),
});

/**
 * Variant 2: journey not found in the graph (line 266 of handler).
 * Includes journey_id: null and a reason string.
 */
const matchedFalseSchema = z.object({
  matched: z.literal(false),
  journey_id: z.null(),
  reason: z.string(),
});

/**
 * Variant 3: journey matched but delay not yet retrieved (lines 330-335 of handler).
 * Includes matched:true and journey_id.
 */
const pendingSchema = z.object({
  matched: z.literal(true),
  journey_id: z.string(),
  status: z.literal('pending'),
  message: z.string(),
});

/**
 * Variant 4: delay retrieved but eligibility still computing (lines 383-392 of handler).
 * Includes matched:true, journey_id, delay_minutes, cancelled, last_observed_at.
 * NO `delayed` boolean field (phantom — BFF never sends it).
 */
const pendingEligibilitySchema = z.object({
  matched: z.literal(true),
  journey_id: z.string(),
  delay_minutes: z.number(),
  cancelled: z.boolean(),
  last_observed_at: z.string(),
  status: z.literal('pending_eligibility'),
  message: z.string(),
});

/**
 * Variant 5 (JM-002): Any-Permitted ticket, no attestation — candidate list returned.
 * BFF passes this through from journey-matcher (AC-7/AC-9).
 * PWA renders CandidateSelectList for user to pick which service they travelled on.
 */
const candidatesItemSchema = z.object({
  rid: z.string(),
  scheduled_departure: z.string(),
  toc_code: z.string().optional(),
});

const candidatesSchema = z.object({
  status: z.literal('candidates'),
  journey_id: z.null(),
  candidates: z.array(candidatesItemSchema).min(1),
});

/**
 * Variant 6 (BL-315): Non-eligible terminal from the ensure path.
 * BFF sends { matched:true, journey_id, status:'on_time'|'no_data' } when
 * DelayEvaluationService returns on_time or no_data — no delay, no eligibility
 * check needed. No 'eligible' field, no delay_minutes/cancelled/last_observed_at.
 * PWA renders a clean "no delay found" terminal in-place (no /capture/result nav).
 */
const nonEligibleTerminalSchema = z.object({
  matched: z.literal(true),
  journey_id: z.string(),
  status: z.enum(['on_time', 'no_data']),
});

/**
 * Variant 7 (BL-336 SS4): Mode-B intended_itinerary response.
 * BFF returns this when the user has selected leg-1 and the journey has onward legs
 * (onward_plan:true probe). The PWA renders the per-leg picker UI (Step 2) from this.
 *
 * Parse-safety notes (AC-8):
 *   - operator_name is optional on planned AND alternatives — must not fail when absent.
 *   - alternatives may be [] (empty array) — must parse fine.
 *   - intended_itinerary may be [] (empty array) — triggers single-leg backward-compat path.
 *   DR-004: per-leg selection model; ADR-027: BFF owns contract.
 */
const legServiceSchema = z.object({
  rid: z.string(),
  scheduled_departure: z.string(),
  scheduled_arrival: z.string(),
  origin_crs: z.string(),
  destination_crs: z.string(),
  toc_code: z.string(),
  operator_name: z.string().optional(),
});

const intendedLegSchema = z.object({
  segment_order: z.number(),
  planned: legServiceSchema,
  alternatives: z.array(legServiceSchema),
});

const intendedItinerarySchema = z.object({
  status: z.literal('intended_itinerary'),
  leg1: z.object({
    segment_order: z.number(),
    rid: z.string(),
  }),
  intended_itinerary: z.array(intendedLegSchema),
});

export const checkDelayResponseSchema = z.union([
  candidatesSchema,
  intendedItinerarySchema,
  pendingSchema,
  pendingEligibilitySchema,
  nonEligibleTerminalSchema,
  matchedTrueSchema,
  matchedFalseSchema,
]);

export type CheckDelayResponse = z.infer<typeof checkDelayResponseSchema>;
