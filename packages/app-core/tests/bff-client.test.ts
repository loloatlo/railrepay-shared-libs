/**
 * Unit Tests: BFF client typed fetch wrapper (lib/bff-client.ts)
 *
 * Story   : RAILREPAY-APP-LOGIN-001
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-05-12
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * These tests MUST FAIL until Blake creates lib/bff-client.ts.
 * Failure reason: "Cannot find module '../src/bff-client'"
 *
 * Endpoint verification:
 *   startOtp  → POST /api/auth/otp/start   (Verified: web-app-bff exposes this)
 *   verifyOtp → POST /api/auth/otp/verify  (Verified: web-app-bff exposes this)
 *   getMe     → GET  /api/auth/me          (Verified: web-app-bff exposes this)
 *
 * Architecture note (Quinn US-1 spec):
 *   bff-client.ts is a CLIENT-SIDE fetch wrapper using NEXT_PUBLIC_BFF_BASE_URL.
 *   credentials: 'include' is required so the browser sends/receives the
 *   rr_session HttpOnly cookie with every request.
 *
 * AC coverage map:
 *   AC-3: startOtp calls POST /api/auth/otp/start with correct shape + credentials
 *   AC-4: verifyOtp calls POST /api/auth/otp/verify with correct shape + credentials
 *   AC-5: getMe calls GET /api/auth/me with credentials: 'include'
 *   AC-3 + AC-4 + AC-5: typed error handling for 401/422/503 responses
 *
 * ADR references:
 *   ADR-014 — TDD
 *   ADR-002 — Correlation IDs (X-Correlation-ID header)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// AC-3 + AC-4 + AC-5: typed client functions from lib/bff-client.ts
import { startOtp, verifyOtp, getMe } from '../src/bff-client';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeResponse(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────

describe('RAILREPAY-APP-LOGIN-001: lib/bff-client.ts — typed BFF client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Stub global fetch for each test
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    // Stub NEXT_PUBLIC_BFF_BASE_URL env var
    vi.stubEnv('NEXT_PUBLIC_BFF_BASE_URL', 'http://bff.test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // ── AC-3: startOtp ───────────────────────────────────────────────────────────
  describe('AC-3: startOtp({ phone_e164, channel })', () => {
    it('AC-3: should call fetch with POST method and correct URL', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, { status: 'sent' }));

      await startOtp({ phone_e164: '+447700900000', channel: 'web' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/auth/otp/start');
      expect(options.method).toBe('POST');
    });

    it('AC-3: should send JSON body with phone_e164 and channel', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, { status: 'sent' }));

      await startOtp({ phone_e164: '+447700900000', channel: 'web' });

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['phone_e164']).toBe('+447700900000');
      expect(body['channel']).toBe('web');
    });

    it('AC-3: should include credentials: "include" in the request options', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, { status: 'sent' }));

      await startOtp({ phone_e164: '+447700900000', channel: 'web' });

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(options.credentials).toBe('include');
    });

    it('AC-3: should include X-Correlation-ID header (correlation ID for observability)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, { status: 'sent' }));

      await startOtp({ phone_e164: '+447700900000', channel: 'web' });

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['X-Correlation-ID'] ?? headers['x-correlation-id']).toBeDefined();
    });

    it('AC-3: should return { status: "sent" } on 200 response', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(200, { status: 'sent' }));

      const result = await startOtp({ phone_e164: '+447700900000', channel: 'web' }) as Record<string, unknown>;
      expect(result['status']).toBe('sent');
    });

    it('AC-3: should throw a typed error on 422 response', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(422, { error: 'invalid_request', message: 'Phone number invalid' })
      );

      await expect(
        startOtp({ phone_e164: 'bad-phone', channel: 'web' })
      ).rejects.toMatchObject({ status: 422 });
    });

    it('AC-3: should throw a typed error on 503 response', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(503, { error: 'upstream_unavailable' })
      );

      await expect(
        startOtp({ phone_e164: '+447700900000', channel: 'web' })
      ).rejects.toMatchObject({ status: 503 });
    });
  });

  // ── AC-4: verifyOtp ──────────────────────────────────────────────────────────
  describe('AC-4: verifyOtp({ phone_e164, channel, code })', () => {
    it('AC-4: should call fetch with POST method and correct URL', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(200, {
          user_id: 'usr_123',
          session_id: 'ses_abc',
          access_token: 'tok_xyz',
          expires_in: 900,
        })
      );

      await verifyOtp({ phone_e164: '+447700900000', channel: 'web', code: '123456' });

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/auth/otp/verify');
      expect(options.method).toBe('POST');
    });

    it('AC-4: should send JSON body with phone_e164, channel, and code', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(200, {
          user_id: 'usr_123',
          session_id: 'ses_abc',
          access_token: 'tok_xyz',
          expires_in: 900,
        })
      );

      await verifyOtp({ phone_e164: '+447700900000', channel: 'web', code: '123456' });

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as Record<string, unknown>;
      expect(body['phone_e164']).toBe('+447700900000');
      expect(body['channel']).toBe('web');
      expect(body['code']).toBe('123456');
    });

    it('AC-4: should include credentials: "include" so the BFF Set-Cookie is received', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(200, { user_id: 'usr_123', session_id: 'ses_abc', access_token: 'tok_xyz', expires_in: 900 })
      );

      await verifyOtp({ phone_e164: '+447700900000', channel: 'web', code: '123456' });

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(options.credentials).toBe('include');
    });

    it('AC-4: should return typed session payload on 200 response', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(200, {
          user_id: 'usr_123',
          session_id: 'ses_abc',
          access_token: 'tok_xyz',
          expires_in: 900,
        })
      );

      const result = await verifyOtp({ phone_e164: '+447700900000', channel: 'web', code: '123456' }) as Record<string, unknown>;
      expect(result['user_id']).toBe('usr_123');
      expect(result['session_id']).toBe('ses_abc');
      expect(result['access_token']).toBe('tok_xyz');
      expect(result['expires_in']).toBe(900);
    });

    it('AC-4: should throw a typed error with status 401 on invalid_code response', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(401, { error: 'invalid_code' })
      );

      await expect(
        verifyOtp({ phone_e164: '+447700900000', channel: 'web', code: '0000' })
      ).rejects.toMatchObject({ status: 401, error: 'invalid_code' });
    });

    it('AC-4: should throw a typed error with status 422 on invalid_request', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(422, { error: 'invalid_request' })
      );

      await expect(
        verifyOtp({ phone_e164: '+447700900000', channel: 'web', code: 'abc' })
      ).rejects.toMatchObject({ status: 422 });
    });

    it('AC-4: should throw a typed error with status 503 on upstream_unavailable', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(503, { error: 'upstream_unavailable' })
      );

      await expect(
        verifyOtp({ phone_e164: '+447700900000', channel: 'web', code: '123456' })
      ).rejects.toMatchObject({ status: 503 });
    });
  });

  // ── AC-5: getMe ──────────────────────────────────────────────────────────────
  describe('AC-5: getMe()', () => {
    it('AC-5: should call fetch with GET method and correct URL', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(200, { user_id: 'usr_123', phone_e164: '+447700900000' })
      );

      await getMe();

      const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toContain('/api/auth/me');
      expect((options.method ?? 'GET').toUpperCase()).toBe('GET');
    });

    it('AC-5: should include credentials: "include" so the rr_session cookie is sent', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(200, { user_id: 'usr_123', phone_e164: '+447700900000' })
      );

      await getMe();

      const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(options.credentials).toBe('include');
    });

    it('AC-5: should return typed user payload on 200 response', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse(200, { user_id: 'usr_123', phone_e164: '+447700900000' })
      );

      const result = await getMe() as Record<string, unknown>;
      expect(result['user_id']).toBe('usr_123');
      expect(result['phone_e164']).toBe('+447700900000');
    });

    it('AC-5: should throw a typed error with status 401 when not authenticated', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse(401, { error: 'not_authenticated' }));

      await expect(getMe()).rejects.toMatchObject({ status: 401 });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BL-269 guard tests — RETIRED at BL-273
//
// The empty-URL throw and absolute-URL guard are replaced by the relative-URL
// same-origin pattern introduced in BL-273 (Next.js rewrites() proxy).
// See BL-273 tests below or in next.config.test.ts.
//
// Original tests removed:
//   - 'throws descriptive error when NEXT_PUBLIC_BFF_BASE_URL is empty'
//   - 'startOtp POSTs to absolute BFF origin URL, not a relative path'
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BL-273 RED tests: bff-client relative-path (post-rewrites) refactor
//
// AC mapping:
//   AC-3 (BL-273): PWA next.config.js has rewrites() mapping /api/:path* to BFF
//   AC-4 (BL-273): bff-client fetch calls use relative paths (same-origin to PWA)
//   AC-7 (BL-273): Failing tests that reproduce the redirect-back-to-login behaviour
//
// These tests MUST FAIL until Blake's T2-impl changes getBffBaseUrl() to return ''
// and adds an optional baseUrl parameter to getMe().
//
// Isolation strategy: vi.resetModules() + dynamic await import() ensures a fresh
// module evaluation per test so env-var changes take effect.
// ─────────────────────────────────────────────────────────────────────────────

describe('BL-273: bff-client uses relative paths (post-rewrites refactor)', () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  // AC-4 (BL-273): startOtp must POST to relative /api/auth/otp/start — not an absolute URL.
  // RED reason: current getBffBaseUrl() prepends NEXT_PUBLIC_BFF_BASE_URL → absolute URL.
  it('startOtp POSTs to relative /api/auth/otp/start (not absolute URL)', async () => {
    delete process.env['NEXT_PUBLIC_BFF_BASE_URL'];
    vi.resetModules();
    const { startOtp: startOtpFresh } = await import('../src/bff-client');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ status: 'sent' }), { status: 200 }));
    await startOtpFresh({ phone_e164: '+447700900000', channel: 'web' });
    // After fix: getBffBaseUrl() returns '' → URL is exactly '/api/auth/otp/start'
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/otp/start', expect.any(Object));
    fetchSpy.mockRestore();
  });

  // AC-4 (BL-273): verifyOtp must POST to relative /api/auth/otp/verify.
  // RED reason: same as above — getBffBaseUrl() currently throws or prepends base URL.
  it('verifyOtp POSTs to relative /api/auth/otp/verify', async () => {
    delete process.env['NEXT_PUBLIC_BFF_BASE_URL'];
    vi.resetModules();
    const { verifyOtp: verifyOtpFresh } = await import('../src/bff-client');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ user_id: 'u1', session_id: 's1', access_token: 'tok', expires_in: 900 }),
          { status: 200 },
        ),
      );
    await verifyOtpFresh({ phone_e164: '+447700900000', channel: 'web', code: '123456' });
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/otp/verify', expect.any(Object));
    fetchSpy.mockRestore();
  });

  // AC-4 (BL-273): getMe must GET relative /api/auth/me when no baseUrl is provided.
  // RED reason: getBffBaseUrl() currently throws when env var absent.
  it('getMe GETs relative /api/auth/me when no baseUrl provided', async () => {
    delete process.env['NEXT_PUBLIC_BFF_BASE_URL'];
    vi.resetModules();
    const { getMe: getMeFresh } = await import('../src/bff-client');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ user_id: 'u1', phone_e164: '+447700900000' }), { status: 200 }),
      );
    await getMeFresh();
    expect(fetchSpy).toHaveBeenCalledWith('/api/auth/me', expect.any(Object));
    fetchSpy.mockRestore();
  });

  // AC-3 + AC-4 (BL-273): getMe must accept an optional baseUrl for server-side callers
  // (middleware server-to-server → BFF_INTERNAL_URL bypasses the rewrite proxy).
  // RED reason: current getMe() signature has no baseUrl parameter.
  it('getMe GETs absolute URL when baseUrl is provided (middleware server-to-server)', async () => {
    delete process.env['NEXT_PUBLIC_BFF_BASE_URL'];
    vi.resetModules();
    const { getMe: getMeFresh } = await import('../src/bff-client');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ user_id: 'u1', phone_e164: '+447700900000' }), { status: 200 }),
      );
    // @ts-expect-error — baseUrl parameter does not exist yet (TDD RED phase)
    await getMeFresh({ cookie: 'rr_session=abc' }, 'http://bff.internal:3000');
    expect(fetchSpy).toHaveBeenCalledWith('http://bff.internal:3000/api/auth/me', expect.any(Object));
    fetchSpy.mockRestore();
  });

  // AC-7 (BL-273): getBffBaseUrl must NOT throw when env var is absent.
  // This is a regression guard — the BL-269 throw guard is intentionally removed by this fix.
  // RED reason: current getBffBaseUrl() throws Error('NEXT_PUBLIC_BFF_BASE_URL is not set...').
  it('getBffBaseUrl does NOT throw when NEXT_PUBLIC_BFF_BASE_URL is absent (regression: removed from BL-269)', async () => {
    delete process.env['NEXT_PUBLIC_BFF_BASE_URL'];
    vi.resetModules();
    const { startOtp: startOtpFresh } = await import('../src/bff-client');
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ status: 'sent' }), { status: 200 }));
    // Must resolve without throwing — the fix makes getBffBaseUrl() return '' silently
    await expect(
      startOtpFresh({ phone_e164: '+447700900000', channel: 'web' }),
    ).resolves.toBeDefined();
    fetchSpy.mockRestore();
  });
});
