/**
 * Unit Tests: Zustand auth store (lib/auth-store.ts)
 *
 * Story   : RAILREPAY-APP-LOGIN-001
 * Phase   : US-2 (Jessie — Test Specification, TDD per ADR-014)
 * Date    : 2026-05-12
 *
 * Test Lock Rule (CLAUDE.md §6): Blake MUST NOT modify these tests.
 * If a test appears wrong, hand back to Jessie with explanation.
 *
 * These tests MUST FAIL until Blake creates lib/auth-store.ts.
 * Failure reason: "Cannot find module '../src/auth-store'"
 *
 * AC coverage map:
 *   AC-3: Zustand store carries phone number across OTP start → verify screens
 *   AC-5: No localStorage tokens — auth state is held in Zustand (in-memory), not localStorage
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

// AC-3: Zustand store exported from lib/auth-store.ts
// @ts-expect-error — module does not exist yet (TDD RED phase)
import { useAuthStore } from '../src/auth-store';

// ─────────────────────────────────────────────────────────────────────────────

describe('RAILREPAY-APP-LOGIN-001: lib/auth-store.ts — Zustand auth store', () => {
  // Reset store state between tests so each test starts clean.
  // Zustand stores are singletons in module scope — we reset via the store's
  // setState or the store's own clearPhone action.
  beforeEach(() => {
    // Reset to initial state: phone = null
    act(() => {
      useAuthStore.getState().clearPhone();
    });
  });

  // ── AC-3: Initial state ──────────────────────────────────────────────────────
  describe('AC-3: initial store state', () => {
    it('AC-3: should have phone as null in initial state', () => {
      const { phone } = useAuthStore.getState();
      expect(phone).toBeNull();
    });
  });

  // ── AC-3: setPhone action ────────────────────────────────────────────────────
  describe('AC-3: setPhone action', () => {
    it('AC-3: should update phone when setPhone is called with a valid number', () => {
      act(() => {
        useAuthStore.getState().setPhone('+447700900000');
      });

      const { phone } = useAuthStore.getState();
      expect(phone).toBe('+447700900000');
    });

    it('AC-3: should update phone when setPhone is called with a local format number', () => {
      act(() => {
        useAuthStore.getState().setPhone('07911123456');
      });

      const { phone } = useAuthStore.getState();
      expect(phone).toBe('07911123456');
    });
  });

  // ── AC-3: clearPhone action ──────────────────────────────────────────────────
  describe('AC-3: clearPhone action', () => {
    it('AC-3: should reset phone to null when clearPhone is called', () => {
      // Set a phone first
      act(() => {
        useAuthStore.getState().setPhone('+447700900000');
      });
      expect(useAuthStore.getState().phone).toBe('+447700900000');

      // Clear it
      act(() => {
        useAuthStore.getState().clearPhone();
      });
      expect(useAuthStore.getState().phone).toBeNull();
    });
  });

  // ── AC-3 + AC-5: Reactivity ──────────────────────────────────────────────────
  describe('AC-3: store reactivity', () => {
    it('AC-3: subscribers should receive updated state after setPhone', () => {
      const receivedStates: Array<string | null> = [];

      // Subscribe to store changes
      const unsubscribe = useAuthStore.subscribe(
        (state: { phone: string | null }) => state.phone,
        (phone: string | null) => {
          receivedStates.push(phone);
        }
      );

      act(() => {
        useAuthStore.getState().setPhone('+447700900000');
      });

      unsubscribe();

      expect(receivedStates).toContain('+447700900000');
    });
  });

  // ── AC-5: No localStorage ────────────────────────────────────────────────────
  describe('AC-5: no localStorage tokens', () => {
    it('AC-5: setPhone should NOT write to localStorage', () => {
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

      act(() => {
        useAuthStore.getState().setPhone('+447700900000');
      });

      // No localStorage writes should have occurred for phone/token values
      const tokenWrites = setItemSpy.mock.calls.filter(
        ([key]: [string, unknown]) =>
          key.includes('token') || key.includes('phone') || key.includes('auth')
      );

      expect(tokenWrites).toHaveLength(0);

      setItemSpy.mockRestore();
    });
  });
});
