/**
 * Unit Tests: Zod schema for BFF ticket upload response
 *
 * Story   : RAILREPAY-APP-003
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-05-12
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * These tests MUST FAIL until Blake creates lib/schemas/ticket-upload.ts.
 * Failure reason: "Cannot find module '../../src/schemas/ticket-upload'"
 *
 * AC coverage map:
 *   AC-3: Upload response validated against full BFF response shape
 *   AC-4: Reading-state / field-reveal relies on parsed extracted_fields
 *
 * Import path: tests/unit/schemas/ → 3 levels up to lib/schemas/ticket-upload
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import { describe, it, expect } from 'vitest';

// AC-3 + AC-4: Zod schema exported from lib/schemas/ticket-upload.ts
// @ts-expect-error — module does not exist yet (TDD RED phase)
import { ticketUploadResponseSchema } from '../../src/schemas/ticket-upload';

// ─── Fixture: minimal valid BFF 200 response ──────────────────────────────────

const validResponse = {
  scan_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  status: 'completed',
  confidence: 0.94,
  extracted_fields: {
    origin_station: 'London Paddington',
    destination_station: 'Bristol Temple Meads',
    origin_crs: 'PAD',
    destination_crs: 'BRI',
    travel_date: '2026-05-12',
    departure_time: '09:15',
    fare_pence: 4250,
    ticket_type: 'Advance',
    ticket_class: '2',
    via_station: null,
    via_crs: null,
    operator_name: 'Great Western Railway',
    ticket_number: 'AB12345678',
  },
  raw_text: 'London Paddington to Bristol Temple Meads',
  claim_ready: true,
  ocr_status: 'success',
  gcs_upload_status: 'success',
  image_gcs_path: 'gs://railrepay-tickets/scans/a1b2c3d4.jpg',
  error_message: null,
  created_at: '2026-05-12T09:00:00.000Z',
  updated_at: '2026-05-12T09:00:05.000Z',
};

// ─────────────────────────────────────────────────────────────────────────────

describe('RAILREPAY-APP-003: lib/schemas/ticket-upload.ts — ticketUploadResponseSchema', () => {
  // ── AC-3: Happy path — full valid response ───────────────────────────────────
  describe('AC-3: accepts the full valid BFF 200 response shape', () => {
    it('AC-3: should parse a complete valid response without errors', () => {
      const result = ticketUploadResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
    });

    it('AC-3: should preserve scan_id as string', () => {
      const result = ticketUploadResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.scan_id).toBe('a1b2c3d4-e5f6-7890-abcd-ef1234567890');
      }
    });

    it('AC-3: should accept status "processing"', () => {
      const result = ticketUploadResponseSchema.safeParse({
        ...validResponse,
        status: 'processing',
        claim_ready: false,
      });
      expect(result.success).toBe(true);
    });

    it('AC-3: should accept status "failed"', () => {
      const result = ticketUploadResponseSchema.safeParse({
        ...validResponse,
        status: 'failed',
        claim_ready: false,
        error_message: 'OCR failed to extract text',
      });
      expect(result.success).toBe(true);
    });

    it('AC-4: should expose all 13 extracted_fields on parsed output', () => {
      const result = ticketUploadResponseSchema.safeParse(validResponse);
      expect(result.success).toBe(true);
      if (result.success) {
        const fields = result.data.extracted_fields;
        expect(fields.origin_station).toBeDefined();
        expect(fields.destination_station).toBeDefined();
        expect(fields.origin_crs).toBeDefined();
        expect(fields.destination_crs).toBeDefined();
        expect(fields.travel_date).toBeDefined();
        expect(fields.departure_time).toBeDefined();
        expect(fields.fare_pence).toBeDefined();
        expect(fields.ticket_type).toBeDefined();
        expect(fields.ticket_class).toBeDefined();
        expect(typeof fields.via_station !== 'undefined').toBe(true);
        expect(typeof fields.via_crs !== 'undefined').toBe(true);
        expect(fields.operator_name).toBeDefined();
        expect(fields.ticket_number).toBeDefined();
      }
    });

    it('AC-4: should allow null/undefined for optional extracted_fields (via_station, via_crs)', () => {
      const result = ticketUploadResponseSchema.safeParse({
        ...validResponse,
        extracted_fields: {
          ...validResponse.extracted_fields,
          via_station: null,
          via_crs: null,
        },
      });
      expect(result.success).toBe(true);
    });

    it('AC-3: should strip unknown top-level fields gracefully', () => {
      const responseWithExtra = {
        ...validResponse,
        unexpected_field: 'should be stripped',
        another_extra: 42,
      };
      // Zod schemas with .strip() (default) remove unknown keys
      const result = ticketUploadResponseSchema.safeParse(responseWithExtra);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as Record<string, unknown>)['unexpected_field']).toBeUndefined();
      }
    });
  });

  // ── AC-3: Rejection of invalid/missing fields ────────────────────────────────
  describe('AC-3: rejects responses missing required fields', () => {
    it('AC-3: should reject response with missing scan_id', () => {
      const { scan_id: _omit, ...withoutScanId } = validResponse;
      void _omit;
      const result = ticketUploadResponseSchema.safeParse(withoutScanId);
      expect(result.success).toBe(false);
    });

    it('AC-3: should reject response with missing status', () => {
      const { status: _omit, ...withoutStatus } = validResponse;
      void _omit;
      const result = ticketUploadResponseSchema.safeParse(withoutStatus);
      expect(result.success).toBe(false);
    });

    it('AC-3: should reject response with invalid status value', () => {
      const result = ticketUploadResponseSchema.safeParse({
        ...validResponse,
        status: 'unknown_status',
      });
      expect(result.success).toBe(false);
    });

    it('AC-3: should reject response with missing extracted_fields', () => {
      const { extracted_fields: _omit, ...withoutFields } = validResponse;
      void _omit;
      const result = ticketUploadResponseSchema.safeParse(withoutFields);
      expect(result.success).toBe(false);
    });
  });
});
