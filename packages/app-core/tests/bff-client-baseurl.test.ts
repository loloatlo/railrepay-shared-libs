/**
 * TD RED tests — BL-385 injectable baseUrl for @railrepay/app-core bff-client
 *
 * Workflow: Technical Debt (combined BL-385 + BL-386). Phase TD-1 (Jessie — RED).
 * ADR-004 / ADR-035: Vitest (pure-TS carve-out).
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests. Hand back
 * with explanation if a test appears wrong.
 *
 * Normative interface under test (exact — from Quinn TD-0):
 *   export interface BffClientConfig { baseUrl?: string }
 *   export function configureBffClient(config: BffClientConfig): void
 *   export function joinUrl(base: string, path: string): string   // join primitive
 *
 * RED (TD-1): 1.0.0 has NO configureBffClient / joinUrl exports and no config
 *   state — every "new behaviour" assertion below fails because
 *   bff.configureBffClient / bff.joinUrl are undefined (right-reason RED:
 *   missing export). The DEFAULT-relative assertions (BL-273 invariant) PASS at
 *   RED and GREEN — they are regression guards proving zero behaviour change
 *   when unconfigured.
 *
 * AC mapping (BL-385):
 *   AC-1: default/unconfigured behaviour byte-identical to 1.0.0 (relative URLs)
 *   AC-2: configureBffClient({baseUrl}) → subsequent calls hit <base>/api/...
 *   AC-3: base trailing slash normalised (one stripped)
 *   AC-4: re-configure last-wins; {baseUrl:''} resets; {} leaves state unchanged
 *   AC-5: joinUrl primitive — '/'-prefix required (descriptive throw), join rules
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as bff from '../src/bff-client';

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const startOtpParams = { phone_e164: '+447700900000', channel: 'sms' };
const verifyOtpParams = { phone_e164: '+447700900000', channel: 'sms', code: '123456' };
const checkDelayRequest = {
  origin_station: 'London Paddington',
  destination_station: 'Reading',
  departure_date: '2026-07-18',
  departure_time: '09:00',
};

describe('BL-385: configureBffClient — injectable baseUrl', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(makeResponse(200, {}));
    vi.stubGlobal('fetch', fetchMock);
    // Reset module-level config to relative default between tests (GREEN only —
    // guarded so RED doesn't throw in setup; at RED the export doesn't exist).
    if (typeof bff.configureBffClient === 'function') {
      bff.configureBffClient({ baseUrl: '' });
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // ── AC-1: default relative behaviour (BL-273 invariant — green at RED & GREEN) ──
  describe('AC-1: default/unconfigured → relative URLs (BL-273 invariant)', () => {
    it('AC-1: startOtp uses relative /api/auth/otp/start by default', async () => {
      await bff.startOtp(startOtpParams);
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/otp/start', expect.any(Object));
    });

    it('AC-1: getMe uses relative /api/auth/me by default', async () => {
      await bff.getMe();
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.any(Object));
    });

    it('AC-1: uploadTicket uses relative /api/tickets/upload by default', async () => {
      await bff.uploadTicket(new Blob(['x'], { type: 'image/jpeg' }), 'camera');
      expect(fetchMock).toHaveBeenCalledWith('/api/tickets/upload', expect.any(Object));
    });

    it('AC-1: checkDelay uses relative /api/journeys/check-delay by default', async () => {
      await bff.checkDelay(checkDelayRequest).catch(() => {});
      expect(fetchMock).toHaveBeenCalledWith('/api/journeys/check-delay', expect.any(Object));
    });
  });

  // ── configureBffClient must exist (missing export → RED) ──────────────────────
  it('AC-2: configureBffClient is an exported function', () => {
    expect(typeof bff.configureBffClient).toBe('function');
  });

  // ── AC-2: absolute base injection ─────────────────────────────────────────────
  describe('AC-2: configureBffClient({baseUrl}) → absolute URLs', () => {
    it('AC-2: startOtp hits <base>/api/auth/otp/start', async () => {
      bff.configureBffClient({ baseUrl: 'https://api.example.com' });
      await bff.startOtp(startOtpParams);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/otp/start',
        expect.any(Object),
      );
    });

    it('AC-2: getMe hits <base>/api/auth/me', async () => {
      bff.configureBffClient({ baseUrl: 'https://api.example.com' });
      await bff.getMe();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/me',
        expect.any(Object),
      );
    });

    it('AC-2: uploadTicket hits <base>/api/tickets/upload', async () => {
      bff.configureBffClient({ baseUrl: 'https://api.example.com' });
      await bff.uploadTicket(new Blob(['x'], { type: 'image/jpeg' }), 'camera');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/tickets/upload',
        expect.any(Object),
      );
    });

    it('AC-2: checkDelay hits <base>/api/journeys/check-delay (was hardcoded relative)', async () => {
      bff.configureBffClient({ baseUrl: 'https://api.example.com' });
      await bff.checkDelay(checkDelayRequest).catch(() => {});
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/journeys/check-delay',
        expect.any(Object),
      );
    });
  });

  // ── AC-3: trailing-slash normalisation ────────────────────────────────────────
  describe('AC-3: base trailing slash normalised (one stripped)', () => {
    it('AC-3: base "https://api.example.com/" → single slash join', async () => {
      bff.configureBffClient({ baseUrl: 'https://api.example.com/' });
      await bff.startOtp(startOtpParams);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/otp/start',
        expect.any(Object),
      );
    });
  });

  // ── AC-4: last-wins, reset, no-op empty config ────────────────────────────────
  describe('AC-4: re-configure semantics', () => {
    it('AC-4: reconfigure is last-wins', async () => {
      bff.configureBffClient({ baseUrl: 'https://first.example.com' });
      bff.configureBffClient({ baseUrl: 'https://second.example.com' });
      await bff.getMe();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://second.example.com/api/auth/me',
        expect.any(Object),
      );
    });

    it('AC-4: { baseUrl: "" } resets to relative behaviour', async () => {
      bff.configureBffClient({ baseUrl: 'https://api.example.com' });
      bff.configureBffClient({ baseUrl: '' });
      await bff.getMe();
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.any(Object));
    });

    it('AC-4: empty config {} leaves the current baseUrl unchanged', async () => {
      bff.configureBffClient({ baseUrl: 'https://api.example.com' });
      bff.configureBffClient({});
      await bff.getMe();
      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/api/auth/me',
        expect.any(Object),
      );
    });
  });

  // ── AC-5: joinUrl join primitive ──────────────────────────────────────────────
  describe('AC-5: joinUrl(base, path) primitive', () => {
    it('AC-5: joinUrl("", "/api/x") returns the path unchanged (BL-273 invariant)', () => {
      expect(bff.joinUrl('', '/api/auth/me')).toBe('/api/auth/me');
    });

    it('AC-5: joinUrl(absoluteBase, "/api/x") concatenates with one slash', () => {
      expect(bff.joinUrl('https://api.example.com', '/api/auth/me')).toBe(
        'https://api.example.com/api/auth/me',
      );
    });

    it('AC-5: joinUrl strips ONE trailing slash from the base', () => {
      expect(bff.joinUrl('https://api.example.com/', '/api/auth/me')).toBe(
        'https://api.example.com/api/auth/me',
      );
    });

    it('AC-5: joinUrl throws a descriptive error when path is not "/"-prefixed', () => {
      expect(() => bff.joinUrl('https://api.example.com', 'api/auth/me')).toThrow(/\//);
    });

    it('AC-5: joinUrl does NOT throw for a "/"-prefixed path', () => {
      expect(() => bff.joinUrl('https://api.example.com', '/api/auth/me')).not.toThrow();
    });
  });
});
