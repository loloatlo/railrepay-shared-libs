/**
 * TD RED tests — BL-386 AC-2 randomUUID guard for @railrepay/app-core bff-client
 *
 * Workflow: Technical Debt (combined BL-385 + BL-386). Phase TD-1 (Jessie — RED).
 * ADR-004 / ADR-035: Vitest.
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 *
 * AC mapping (BL-386):
 *   AC-2: When `typeof globalThis.crypto?.randomUUID !== 'function'`, any client
 *         call that needs a correlation-id UUID throws a DESCRIPTIVE error that
 *         names `expo-crypto` and points at the README "React Native usage"
 *         section — rather than the raw TypeError the 1.0.0 code produces.
 *
 * RED (TD-1): 1.0.0 calls `crypto.randomUUID()` directly with no guard, so:
 *   - randomUUID absent → TypeError "crypto.randomUUID is not a function"
 *   - crypto absent      → TypeError "Cannot read properties of undefined"
 *   Neither message matches /expo-crypto/i or /react native/i → assertions FAIL
 *   (right-reason RED: missing guard behaviour). Blake adds the guard at TD-2.
 *
 * Tested with vi.stubGlobal for BOTH failure modes across representative client
 * functions (different call shapes: startOtp/verifyOtp params, uploadTicket
 * Blob, checkDelay request, getMe no-arg).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as bff from '../src/bff-client';

const startOtpParams = { phone_e164: '+447700900000', channel: 'sms' };
const verifyOtpParams = { phone_e164: '+447700900000', channel: 'sms', code: '123456' };
const checkDelayRequest = {
  origin_station: 'London Paddington',
  destination_station: 'Reading',
  departure_date: '2026-07-18',
  departure_time: '09:00',
};

describe('BL-386 AC-2: crypto.randomUUID guard (React Native / expo-crypto)', () => {
  beforeEach(() => {
    // Defensive — the guard must throw BEFORE any network call, so fetch should
    // never be reached; stub it so a bypass can't hit the network.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ status: 'sent' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('crypto present but randomUUID is not a function', () => {
    beforeEach(() => {
      vi.stubGlobal('crypto', {}); // crypto.randomUUID === undefined
    });

    it('AC-2: startOtp throws a descriptive error naming expo-crypto', async () => {
      await expect(bff.startOtp(startOtpParams)).rejects.toThrow(/expo-crypto/i);
    });

    it('AC-2: checkDelay throws a descriptive error naming expo-crypto', async () => {
      await expect(bff.checkDelay(checkDelayRequest)).rejects.toThrow(/expo-crypto/i);
    });

    it('AC-2: getMe error points at the README "React Native usage" section', async () => {
      await expect(bff.getMe()).rejects.toThrow(/react native/i);
    });
  });

  describe('crypto entirely absent', () => {
    beforeEach(() => {
      vi.stubGlobal('crypto', undefined);
    });

    it('AC-2: startOtp throws a descriptive error naming expo-crypto', async () => {
      await expect(bff.startOtp(startOtpParams)).rejects.toThrow(/expo-crypto/i);
    });

    it('AC-2: uploadTicket throws a descriptive error naming expo-crypto', async () => {
      await expect(
        bff.uploadTicket(new Blob(['x'], { type: 'image/jpeg' }), 'camera'),
      ).rejects.toThrow(/expo-crypto/i);
    });

    it('AC-2: verifyOtp error points at the README "React Native usage" section', async () => {
      await expect(bff.verifyOtp(verifyOtpParams)).rejects.toThrow(/react native/i);
    });
  });
});
