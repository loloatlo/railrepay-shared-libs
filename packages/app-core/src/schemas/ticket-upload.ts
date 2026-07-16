/**
 * Zod schema — BFF ticket upload response
 *
 * Story   : RAILREPAY-APP-003
 * Phase   : US-3 (Blake — Implementation)
 *
 * AC-3: Validates the full BFF POST /api/tickets/upload 200 response shape.
 * AC-4: extracted_fields parsed for field-reveal animation.
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import { z } from 'zod';

const extractedFieldsSchema = z.object({
  origin_station: z.string().nullable(),
  destination_station: z.string().nullable(),
  origin_crs: z.string().nullable(),
  destination_crs: z.string().nullable(),
  travel_date: z.string().nullable(),
  departure_time: z.string().nullable(),
  fare_pence: z.number().nullable(),
  ticket_type: z.string().nullable(),
  ticket_class: z.string().nullable(),
  via_station: z.string().nullable(),
  via_crs: z.string().nullable(),
  operator_name: z.string().nullable(),
  ticket_number: z.string().nullable(),
});

export const ticketUploadResponseSchema = z.object({
  scan_id: z.string(),
  status: z.enum(['processing', 'completed', 'failed']),
  confidence: z.number(),
  extracted_fields: extractedFieldsSchema,
  raw_text: z.string(),
  claim_ready: z.boolean(),
  ocr_status: z.string(),
  gcs_upload_status: z.string(),
  image_gcs_path: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TicketUploadResponse = z.infer<typeof ticketUploadResponseSchema>;
export type ExtractedFields = z.infer<typeof extractedFieldsSchema>;
