/**
 * Zustand auth store — in-memory phone number state
 *
 * Story   : RAILREPAY-APP-LOGIN-001
 * Phase   : US-3 (Blake — Implementation)
 *
 * AC-3: Carries phone number across OTP start → verify screens
 * AC-5: NO localStorage persistence — DR-UC-002 (Stage 1: cookie-only, no client-side token storage)
 *
 * subscribeWithSelector middleware is required so that per-selector subscriptions
 * (useAuthStore.subscribe(selector, callback)) work correctly in tests and components.
 *
 * ADR references:
 *   ADR-014 — TDD
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';

interface AuthStore {
  phone: string | null;
  setPhone: (phone: string) => void;
  clearPhone: () => void;
}

export const useAuthStore = create<AuthStore>()(
  subscribeWithSelector((set) => ({
    phone: null,
    setPhone: (phone) => set({ phone }),
    clearPhone: () => set({ phone: null }),
  }))
);
