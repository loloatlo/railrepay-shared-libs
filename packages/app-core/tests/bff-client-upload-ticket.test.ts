/**
 * Unit Tests: uploadTicket() function in lib/bff-client.ts
 *
 * Story   : RAILREPAY-APP-003
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-05-12
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * These tests MUST FAIL until Blake adds uploadTicket() to lib/bff-client.ts.
 * Failure reason: "uploadTicket is not exported from '../src/bff-client'"
 *
 * Endpoint verification:
 *   uploadTicket → POST /api/tickets/upload
 *   Verified: web-app-bff exposes POST /api/tickets/upload (per Quinn US-1 service contract)
 *
 * Critical regression guards:
 *   BL-273 lesson: uploadTicket MUST use relative URL /api/tickets/upload (not absolute).
 *   SOP-IMPROVEMENT-006 anti-pattern: NO read of NEXT_PUBLIC_BFF_BASE_URL in this code path.
 *
 * AC coverage map:
 *   AC-3: All three input paths call POST /api/tickets/upload with source form field
 *   AC-4: Upload returns parsed 200 response for field-reveal animation
 *
 * ADR references:
 *   ADR-002 — Correlation IDs (X-Correlation-ID header)
 *   ADR-014 — TDD
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// AC-3 + AC-4: uploadTicket exported from lib/bff-client
// @ts-expect-error — function does not exist yet (TDD RED phase)
import { uploadTicket } from '../src/bff-client';

// Also import BffError for error-path assertions — already exists
import { BffError } from '../src/bff-client';

// ─── Fixture: minimal valid BFF 200 response ──────────────────────────────────

const validUploadResponse = {
  scan_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
  status: 'completed',
  confidence: 0.91,
  extracted_fields: {
    origin_station: 'Manchester Piccadilly',
    destination_station: 'London Euston',
    origin_crs: 'MAN',
    destination_crs: 'EUS',
    travel_date: '2026-05-12',
    departure_time: '10:30',
    fare_pence: 7800,
    ticket_type: 'Advance',
    ticket_class: '2',
    via_station: null,
    via_crs: null,
    operator_name: 'Avanti West Coast',
    ticket_number: 'CD98765432',
  },
  raw_text: 'Manchester Piccadilly to London Euston',
  claim_ready: true,
  ocr_status: 'success',
  gcs_upload_status: 'success',
  image_gcs_path: 'gs://railrepay-tickets/scans/b2c3d4e5.jpg',
  error_message: null,
  created_at: '2026-05-12T10:00:00.000Z',
  updated_at: '2026-05-12T10:00:04.000Z',
};

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('RAILREPAY-APP-003: lib/bff-client — uploadTicket()', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Intentionally NOT setting NEXT_PUBLIC_BFF_BASE_URL — uploadTicket must
    // use relative URL unconditionally (BL-273 / SOP-IMPROVEMENT-006 guard).
    delete process.env['NEXT_PUBLIC_BFF_BASE_URL'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // ── AC-3: Request shape ──────────────────────────────────────────────────────
  describe('AC-3: request shape — URL, method, FormData fields, headers', () => {
    it('AC-3: should call fetch with POST method', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-image'], { type: 'image/jpeg' });

      await uploadTicket(blob, 'camera');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((options.method ?? '').toUpperCase()).toBe('POST');
    });

    it('AC-3: should POST to relative URL /api/tickets/upload (BL-273 regression guard — NO absolute URL)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-image'], { type: 'image/jpeg' });

      await uploadTicket(blob, 'camera');

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      // Must be relative — must NOT start with http or https
      expect(url).toBe('/api/tickets/upload');
      expect(url).not.toMatch(/^https?:\/\//);
    });

    it('AC-3: should NOT read NEXT_PUBLIC_BFF_BASE_URL (SOP-IMPROVEMENT-006 anti-pattern guard)', async () => {
      // Set a value that would produce a detectable absolute URL if misused
      vi.stubEnv('NEXT_PUBLIC_BFF_BASE_URL', 'https://railrepay-bff.railway.app');
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-image'], { type: 'image/jpeg' });

      await uploadTicket(blob, 'camera');

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      // Even with env var set, URL must remain relative
      expect(url).toBe('/api/tickets/upload');
    });

    it('AC-3: should include image Blob in FormData under field name "image"', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const imageBlob = new Blob(['fake-jpeg-bytes'], { type: 'image/jpeg' });

      await uploadTicket(imageBlob, 'screenshot');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = options.body as FormData;
      expect(body).toBeInstanceOf(FormData);
      const imageField = body.get('image');
      expect(imageField).toBeInstanceOf(Blob);
    });

    it('AC-3: should include source="camera" in FormData when source is camera', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

      await uploadTicket(blob, 'camera');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = options.body as FormData;
      expect(body.get('source')).toBe('camera');
    });

    it('AC-3: should include source="screenshot" in FormData when source is screenshot', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-png'], { type: 'image/png' });

      await uploadTicket(blob, 'screenshot');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = options.body as FormData;
      expect(body.get('source')).toBe('screenshot');
    });

    it('AC-3: should include source="clipboard" in FormData when source is clipboard', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-png'], { type: 'image/png' });

      await uploadTicket(blob, 'clipboard');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = options.body as FormData;
      expect(body.get('source')).toBe('clipboard');
    });

    it('AC-3: should include X-Correlation-ID header as a UUID (ADR-002 observability)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

      await uploadTicket(blob, 'camera');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      const correlationId =
        headers['X-Correlation-ID'] ?? headers['x-correlation-id'];
      expect(correlationId).toBeDefined();
      // UUID v4 format: 8-4-4-4-12 hex chars
      expect(correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    it('AC-3: should NOT set explicit Content-Type header (FormData sets multipart/form-data with boundary)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

      await uploadTicket(blob, 'camera');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      // Explicitly setting Content-Type breaks multipart boundary
      expect(
        headers['content-type'] ?? headers['Content-Type'],
      ).toBeUndefined();
    });

    it('AC-3: should include credentials: "include" so rr_session cookie is sent', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

      await uploadTicket(blob, 'camera');

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(options.credentials).toBe('include');
    });
  });

  // ── AC-4: 200 happy path ─────────────────────────────────────────────────────
  describe('AC-4: 200 response — parsed upload response', () => {
    it('AC-4: should return parsed response with scan_id on 200', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, validUploadResponse));
      const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

      const result = await uploadTicket(blob, 'camera') as typeof validUploadResponse;

      expect(result.scan_id).toBe('b2c3d4e5-f6a7-8901-bcde-f12345678901');
      expect(result.status).toBe('completed');
      expect(result.claim_ready).toBe(true);
    });
  });

  // ── AC-3: Error paths ────────────────────────────────────────────────────────
  describe('AC-3: error paths — BffError thrown per BFF error contract', () => {
    it('AC-3: should throw BffError with error "image field is required" on 400', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(400, { error: 'image field is required' }),
      );
      const blob = new Blob([''], { type: 'image/jpeg' });

      await expect(uploadTicket(blob, 'camera')).rejects.toMatchObject({
        status: 400,
        error: 'image field is required',
      });
    });

    it('AC-3: should throw BffError with status 401 on unauthorized', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(401, { error: 'unauthorized' }),
      );
      const blob = new Blob(['fake'], { type: 'image/jpeg' });

      await expect(uploadTicket(blob, 'camera')).rejects.toMatchObject({
        status: 401,
        error: 'unauthorized',
      });
    });

    it('AC-3: should throw BffError with status 413 on image too large', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(413, { error: 'image too large', max_bytes: 10485760 }),
      );
      const blob = new Blob(['huge-image'], { type: 'image/jpeg' });

      await expect(uploadTicket(blob, 'camera')).rejects.toMatchObject({
        status: 413,
        error: 'image too large',
      });
    });

    it('AC-3: should throw BffError with status 415 on unsupported content type', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(415, {
          error: 'unsupported content_type',
          supported: ['image/jpeg', 'image/png'],
        }),
      );
      const blob = new Blob(['heic-data'], { type: 'image/heic' });

      await expect(uploadTicket(blob, 'screenshot')).rejects.toMatchObject({
        status: 415,
        error: 'unsupported content_type',
      });
    });

    it('AC-3: should throw BffError with status 502 on OCR error', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(502, { error: 'ocr_error', upstream_status: 503 }),
      );
      const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

      await expect(uploadTicket(blob, 'camera')).rejects.toMatchObject({
        status: 502,
        error: 'ocr_error',
      });
    });

    it('AC-3: should throw BffError with status 503 on OCR unavailable', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(503, { error: 'ocr_unavailable' }),
      );
      const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

      await expect(uploadTicket(blob, 'camera')).rejects.toMatchObject({
        status: 503,
        error: 'ocr_unavailable',
      });
    });

    it('AC-3: should throw BffError (or Error) on network failure', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
      const blob = new Blob(['fake-jpeg'], { type: 'image/jpeg' });

      await expect(uploadTicket(blob, 'camera')).rejects.toThrow();
    });
  });

  // ── Instanceof guard ─────────────────────────────────────────────────────────
  describe('BffError class is importable and used for upload errors', () => {
    it('should throw an instance of BffError on 401 (not a plain object)', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(401, { error: 'unauthorized' }),
      );
      const blob = new Blob(['fake'], { type: 'image/jpeg' });

      await expect(uploadTicket(blob, 'camera')).rejects.toBeInstanceOf(
        BffError,
      );
    });
  });
});
