/**
 * @railrepay/app-core — platform-agnostic client core for RailRepay apps
 * (ADR-033 / BL-367, sub-story APPCORE-001a).
 *
 * Barrel re-export of the six extracted modules (schemas/check-delay,
 * schemas/login, schemas/ticket-upload, check-delay-payload, auth-store,
 * bff-client). Excluded from the coverage gate (vitest.config.ts) — this
 * file carries no branch logic, only re-exports.
 *
 * v1.1.0 (BL-385 + BL-386, TD-2): bff-client also exports configureBffClient
 * / BffClientConfig / joinUrl (injectable base URL for React Native — see
 * package README "React Native usage"). Additive only; no existing export
 * changed.
 *
 * Note: `check-delay-payload.ts` and `schemas/ticket-upload.ts` each define
 * their own (differently-shaped) `ExtractedFields` type. Both source files
 * are byte-identical carries from web-app-pwa (Test Lock Rule / AC-4) where
 * the collision never surfaced because nothing imported both together.
 * Aliased below so the barrel itself compiles unambiguously.
 */

// ─── Schemas ──────────────────────────────────────────────────────────────────

export {
  checkDelayRequestSchema,
  checkDelayResponseSchema,
} from './schemas/check-delay';
export type { CheckDelayRequest, CheckDelayResponse } from './schemas/check-delay';

export { phoneSchema, otpSchema, normalizeToE164 } from './schemas/login';

export { ticketUploadResponseSchema } from './schemas/ticket-upload';
export type {
  TicketUploadResponse,
  ExtractedFields as TicketUploadExtractedFields,
} from './schemas/ticket-upload';

// ─── Payload builder ──────────────────────────────────────────────────────────

export { buildCheckDelayPayload } from './check-delay-payload';
export type { ExtractedFields as CheckDelayExtractedFields } from './check-delay-payload';

// ─── Auth store ───────────────────────────────────────────────────────────────

export { useAuthStore } from './auth-store';

// ─── BFF client ───────────────────────────────────────────────────────────────

export {
  BffError,
  BffParseError,
  startOtp,
  verifyOtp,
  getMe,
  uploadTicket,
  checkDelay,
  configureBffClient,
  joinUrl,
} from './bff-client';
export type {
  StartOtpResponse,
  VerifyOtpResponse,
  MeResponse,
  StartOtpParams,
  VerifyOtpParams,
  UploadExtractedFields,
  UploadResponse,
  BffClientConfig,
} from './bff-client';
