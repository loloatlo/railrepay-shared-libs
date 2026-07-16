/**
 * Unit Tests: lib/bff-client.ts checkDelay() — RAILREPAY-JM-002 additions
 *
 * RAILREPAY-JM-002 — US-2 RED tests (Jessie, 2026-06-07)
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify this file.
 *
 * This file is ADDITIVE to the existing bff-client-check-delay.test.ts (APP-004/BL-306).
 * Pre-existing tests are NOT duplicated here.
 *
 * ACs covered:
 *   AC-9: checkDelay() accepts the new request fields (ticket_type,
 *         actual_departure_time, actual_rid) and serializes them in the POST body.
 *         checkDelay() also accepts a candidates response without throwing BffParseError.
 *
 * jsdom-vs-real-browser CAUTION:
 *   These are purely data-shape tests (fetch mocking, JSON serialization).
 *   No DOM rendering or browser async. jsdom is sufficient and no dispositive-RED
 *   replay is required for this file.
 *
 * ADR references:
 *   ADR-002 — Correlation IDs (X-Correlation-ID header)
 *   ADR-014 — TDD
 *   ADR-027 — BFF owns canonical client-facing contract
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkDelay } from '../src/bff-client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const BASE_REQUEST = {
  origin_station: 'York',
  destination_station: 'London Kings Cross',
  departure_date: '2026-06-03',
  departure_time: '08:56',
};

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

/** Candidates response from BFF (status 200, new JM-002 variant) */
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

describe('RAILREPAY-JM-002: bff-client checkDelay() — new fields and candidates response (AC-9)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── AC-9: new request fields serialized in POST body ────────────────────

  describe('AC-9: ticket_type / actual_departure_time / actual_rid serialized in POST body', () => {
    it('AC-9: should include ticket_type in the fetch POST body when supplied', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, CANDIDATES_RESPONSE));

      await checkDelay(REQUEST_WITH_TICKET_TYPE);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['ticket_type']).toBe('anytime');
    });

    it('AC-9: should include actual_departure_time in the fetch POST body when supplied', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, CANDIDATES_RESPONSE));

      await checkDelay(REQUEST_WITH_FULL_ATTESTATION);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['actual_departure_time']).toBe('08:56');
    });

    it('AC-9: should include actual_rid in the fetch POST body when supplied', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, CANDIDATES_RESPONSE));

      await checkDelay(REQUEST_WITH_FULL_ATTESTATION);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['actual_rid']).toBe('202606030856001');
    });

    it('AC-9: should NOT include ticket_type in the POST body when not supplied', async () => {
      // Pre-existing matched-true response is fine here since no new fields
      fetchMock.mockResolvedValueOnce(makeResponse(200, {
        matched: true,
        journey_id: 'some-id',
        delay_minutes: 25,
        cancelled: false,
        last_observed_at: '2026-06-03T10:00:00Z',
        status: 'pending_eligibility',
        message: 'checking',
      }));

      await checkDelay(BASE_REQUEST);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['ticket_type']).toBeUndefined();
    });
  });

  // ── AC-9: candidates response accepted without BffParseError ────────────

  describe('AC-9: candidates response accepted by checkDelay() (new schema variant)', () => {
    it('AC-9: should return candidates response without throwing BffParseError', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, CANDIDATES_RESPONSE));

      const result = await checkDelay(REQUEST_WITH_TICKET_TYPE);

      expect(result).toBeDefined();
      const r = result as Record<string, unknown>;
      expect(r['status']).toBe('candidates');
    });

    it('AC-9: should return the candidates array from the BFF response', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, CANDIDATES_RESPONSE));

      const result = await checkDelay(REQUEST_WITH_TICKET_TYPE) as Record<string, unknown>;

      expect(Array.isArray(result['candidates'])).toBe(true);
      expect((result['candidates'] as unknown[]).length).toBe(3);
    });

    it('AC-9: should NOT throw BffParseError for a valid candidates response shape', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, CANDIDATES_RESPONSE));

      await expect(checkDelay(REQUEST_WITH_TICKET_TYPE)).resolves.not.toThrow();
    });
  });

  // ── AC-9: POST URL still uses relative path ───────────────────────────────

  describe('AC-9: POST URL remains relative (BL-273 / OQ-7 regression guard)', () => {
    it('AC-9: should POST to /api/journeys/check-delay (relative URL) with new fields', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, CANDIDATES_RESPONSE));

      await checkDelay(REQUEST_WITH_FULL_ATTESTATION);

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/journeys/check-delay');
    });
  });
});
