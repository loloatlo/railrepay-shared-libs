/**
 * Unit Tests: checkDelay() function in lib/bff-client.ts
 *
 * Story   : RAILREPAY-APP-004
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-05-24
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * These tests MUST FAIL until Blake adds checkDelay() to lib/bff-client.ts.
 * Failure reason: "checkDelay is not exported from '../src/bff-client'"
 *
 * Endpoint verification:
 *   checkDelay → POST /api/journeys/check-delay
 *   Verified: web-app-bff exposes POST /api/journeys/check-delay (WEB-BFF-005, Quinn US-1 service contract)
 *
 * Critical regression guards:
 *   BL-273 lesson: checkDelay MUST use relative URL /api/journeys/check-delay (not absolute).
 *   OQ-7: Relative URL for checkDelay() via Next.js rewrite proxy.
 *
 * AC coverage map:
 *   AC-5: Primary CTA calls POST /api/journeys/check-delay with correct body shape.
 *
 * ADR references:
 *   ADR-002 — Correlation IDs (X-Correlation-ID header)
 *   ADR-014 — TDD
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// @ts-expect-error — checkDelay does not exist yet (TDD RED phase)
import { checkDelay } from '../src/bff-client';

import { BffError } from '../src/bff-client';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const validRequest = {
  origin_station: 'Leeds',
  destination_station: 'London Kings Cross',
  departure_date: '2026-06-15',
  departure_time: '07:30',
  scan_id: 'aabb1122-ccdd-3344-eeff-556677889900',
};

// BL-306 self-fix (Jessie T2-test): re-anchored to real BFF contract (ADR-027).
// Phantom fields removed: delayed, compensation_amount, eligibility_reason.
// checkDelay() now throws BffParseError on phantom shapes — fixtures must be real.
const matchedTrueResponse = {
  matched: true,
  journey_id: 'jrn-leeds-lon-20260615-0730',
  delay_minutes: 35,
  cancelled: false,
  last_observed_at: '2026-06-15T08:05:00Z',
  status: 'completed',
  eligible: true,
  scheme: 'delay_repay',
  compensation_percentage: 50,
  compensation_pence: 1000,
  ticket_fare_pence: 2000,
  reasons: [],
  applied_rules: ['DR_30MIN'],
  evaluation_timestamp: '2026-06-15T08:10:00Z',
};

// BL-306 self-fix: matchedFalseSchema requires journey_id:null + reason.
const matchedFalseResponse = {
  matched: false,
  journey_id: null,
  reason: 'No matching journey found in timetable graph',
};

// BL-306 self-fix: pendingSchema requires matched:true + journey_id + message.
const pendingResponse = {
  matched: true,
  journey_id: 'jrn-leeds-lon-20260615-0730',
  status: 'pending',
  message: 'Delay data not yet available — check back shortly.',
};

// BL-306 self-fix: pendingEligibilitySchema requires matched:true, journey_id,
// cancelled, last_observed_at, message. Phantom field `delayed` removed.
const pendingEligibilityResponse = {
  matched: true,
  journey_id: 'jrn-leeds-lon-20260615-0730',
  delay_minutes: 25,
  cancelled: false,
  last_observed_at: '2026-06-15T07:55:00Z',
  status: 'pending_eligibility',
  message: 'Eligibility calculation in progress.',
};

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('RAILREPAY-APP-004: lib/bff-client — checkDelay()', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Intentionally NOT setting NEXT_PUBLIC_BFF_BASE_URL — checkDelay must
    // use relative URL unconditionally (BL-273 / OQ-7 guard).
    delete process.env['NEXT_PUBLIC_BFF_BASE_URL'];
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // ── AC-5: Request shape ────────────────────────────────────────────────────
  describe('AC-5: request shape — URL, method, body, headers', () => {
    it('AC-5: should POST to relative URL /api/journeys/check-delay (OQ-7 regression guard)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('/api/journeys/check-delay');
      expect(url).not.toMatch(/^https?:\/\//);
    });

    it('AC-5: should use POST method', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect((options.method ?? '').toUpperCase()).toBe('POST');
    });

    it('AC-5: should send correct JSON body with origin_station', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['origin_station']).toBe('Leeds');
    });

    it('AC-5: should send correct JSON body with destination_station', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['destination_station']).toBe('London Kings Cross');
    });

    it('AC-5: should send departure_date in request body', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['departure_date']).toBe('2026-06-15');
    });

    it('AC-5: should send departure_time in request body', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['departure_time']).toBe('07:30');
    });

    it('AC-5: should include Content-Type: application/json header', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      const contentType =
        headers['Content-Type'] ?? headers['content-type'];
      expect(contentType).toContain('application/json');
    });

    it('AC-5: should include credentials: "include" so rr_session cookie is sent', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(options.credentials).toBe('include');
    });

    it('AC-5: should include X-Correlation-ID header (ADR-002 observability)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      await checkDelay(validRequest);

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      const correlationId =
        headers['X-Correlation-ID'] ?? headers['x-correlation-id'];
      expect(correlationId).toBeDefined();
      expect(correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  // ── AC-5: 200 response variants ────────────────────────────────────────────
  describe('AC-5: 200 response — returns parsed CheckDelayResponse', () => {
    it('AC-5: matched-true → returns response with matched: true', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      const result = await checkDelay(validRequest) as Record<string, unknown>;
      expect(result['matched']).toBe(true);
    });

    it('AC-5: matched-true → returns delay_minutes as number', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      const result = await checkDelay(validRequest) as Record<string, unknown>;
      expect(result['delay_minutes']).toBe(35);
    });

    it('AC-5: matched-true → returns eligible boolean', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedTrueResponse));

      const result = await checkDelay(validRequest) as Record<string, unknown>;
      expect(result['eligible']).toBe(true);
    });

    it('AC-5: matched-false → returns response with matched: false', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, matchedFalseResponse));

      const result = await checkDelay(validRequest) as Record<string, unknown>;
      expect(result['matched']).toBe(false);
    });

    it('AC-5: pending → returns response with status: "pending"', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, pendingResponse));

      const result = await checkDelay(validRequest) as Record<string, unknown>;
      expect(result['status']).toBe('pending');
    });

    it('AC-5: pending_eligibility → returns response with status: "pending_eligibility"', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, pendingEligibilityResponse));

      const result = await checkDelay(validRequest) as Record<string, unknown>;
      expect(result['status']).toBe('pending_eligibility');
    });
  });

  // ── AC-5: Error paths ──────────────────────────────────────────────────────
  describe('AC-5: error paths — BffError thrown per BFF error contract', () => {
    it('AC-5: 401 → throws BffError(401)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(401, { error: 'not_authenticated' }));

      await expect(checkDelay(validRequest)).rejects.toMatchObject({ status: 401 });
    });

    it('AC-5: 422 → throws BffError(422) with parsed error body', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(422, { error: 'validation_error', message: 'departure_date is required' }),
      );

      await expect(checkDelay(validRequest)).rejects.toMatchObject({ status: 422 });
    });

    it('AC-5: 503 → throws BffError(503)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(503, { error: 'service_unavailable' }));

      await expect(checkDelay(validRequest)).rejects.toMatchObject({ status: 503 });
    });

    it('AC-5: network error → throws (TypeError or BffError)', async () => {
      fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(checkDelay(validRequest)).rejects.toThrow();
    });

    it('AC-5: error is an instance of BffError on 401', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(401, { error: 'not_authenticated' }));

      await expect(checkDelay(validRequest)).rejects.toBeInstanceOf(BffError);
    });
  });
});
