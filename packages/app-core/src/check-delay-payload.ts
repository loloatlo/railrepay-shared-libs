/**
 * Pure conversion utility: ExtractedFields → CheckDelayRequest body.
 *
 * Story   : RAILREPAY-APP-004
 * Phase   : US-3 (Blake — Implementation)
 *
 * AC-5: Maps the PWA's internal field names to the BFF request shape.
 *       Renames travel_date → departure_date.
 *       Normalises fare_pence: if the value is a string like "£37.40"
 *       (from user editing), strip currency symbol and convert to pence.
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import type { CheckDelayRequest } from './schemas/check-delay';

// ─── Input type ───────────────────────────────────────────────────────────────

export interface ExtractedFields {
  origin_station: string | null;
  destination_station: string | null;
  travel_date: string | null;
  departure_time: string | null;
  ticket_type?: string | null;
  fare_pence?: number | string | null;
  ticket_class?: string | null;
  via_station?: string | null;
  operator_name?: string | null;
  scan_id?: string | null;
  // JM-002 AC-2: attestation fields — merged into fields after candidate selection
  actual_rid?: string | null;
  actual_departure_time?: string | null;
  // BL-336 SS4: Mode-B probe flag (DR-004)
  onward_plan?: boolean;
  // BL-336 SS4: Mode-C per-leg selections (DR-004)
  intended_legs?: Array<{ segment_order: number; rid: string }>;
  [key: string]: unknown;
}

// ─── Fare normalisation ───────────────────────────────────────────────────────

function normaliseFarePence(raw: number | string | null | undefined): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === 'number') return raw;
  // e.g. "£37.40" → strip currency symbol → parse float → multiply to pence
  const stripped = String(raw).replace(/[^0-9.]/g, '');
  const parsed = parseFloat(stripped);
  if (isNaN(parsed)) return undefined;
  return Math.round(parsed * 100);
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Convert PWA ExtractedFields into a BFF CheckDelayRequest payload.
 *
 * Key mappings:
 *   travel_date            → departure_date
 *   scan_id                → scan_id (pass-through, omitted if absent)
 *   fare_pence             → fare_pence (normalised to number, omitted if null)
 *   ticket_type            → ticket_type (omitted when null/empty — JM-002 AC-1)
 *   actual_rid             → actual_rid (omitted when absent — JM-002 AC-2 attestation)
 *   actual_departure_time  → actual_departure_time (omitted when absent — JM-002 AC-2)
 */
export function buildCheckDelayPayload(fields: ExtractedFields): CheckDelayRequest & { fare_pence?: number } {
  const payload: CheckDelayRequest & { fare_pence?: number } = {
    origin_station: fields.origin_station ?? '',
    destination_station: fields.destination_station ?? '',
    departure_date: fields.travel_date ?? '',
    departure_time: fields.departure_time ?? '',
  };

  // scan_id — pass through when present
  if (fields.scan_id != null) {
    payload.scan_id = fields.scan_id;
  }

  // fare_pence — normalise and include when present
  const farePence = normaliseFarePence(fields.fare_pence);
  if (farePence !== undefined) {
    payload.fare_pence = farePence;
  }

  // JM-002 AC-1: ticket_type — include when present and non-empty string.
  // A null or empty-string value means the field was absent from the OCR output;
  // omit it so the BFF treats the request as non-anytime rather than passing an
  // empty string that fails schema validation.
  if (typeof fields.ticket_type === 'string' && fields.ticket_type.length > 0) {
    payload.ticket_type = fields.ticket_type;
  }

  // JM-002 AC-2: actual_rid — attestation field; only present on re-submit after
  // user selects their service from CandidateSelectList. Omit when not provided.
  if (typeof fields.actual_rid === 'string' && fields.actual_rid.length > 0) {
    payload.actual_rid = fields.actual_rid;
  }

  // JM-002 AC-2: actual_departure_time — accompanies actual_rid on attested re-submit.
  if (
    typeof fields.actual_departure_time === 'string' &&
    fields.actual_departure_time.length > 0
  ) {
    payload.actual_departure_time = fields.actual_departure_time;
  }

  // BL-336 SS4: onward_plan — Mode-B probe flag; omit when not set (Mode-A/C paths).
  if (fields.onward_plan === true) {
    payload.onward_plan = true;
  }

  // BL-336 SS4: intended_legs — Mode-C per-leg selections; include when present.
  if (Array.isArray(fields.intended_legs) && fields.intended_legs.length > 0) {
    payload.intended_legs = fields.intended_legs;
  }

  return payload;
}
