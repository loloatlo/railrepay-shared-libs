/**
 * BFF client — typed fetch wrapper for web-app-bff API calls
 *
 * Story   : RAILREPAY-APP-LOGIN-001
 * Phase   : US-3 (Blake — Implementation)
 * TD      : BL-385 (injectable baseUrl) + BL-386 (randomUUID guard) — Phase TD-2
 *
 * AC-3: startOtp  → POST /api/auth/otp/start
 * AC-4: verifyOtp → POST /api/auth/otp/verify
 * AC-5: getMe     → GET  /api/auth/me
 *
 * All requests use credentials: 'include' so the browser sends/receives the
 * rr_session HttpOnly cookie. X-Correlation-ID header added per ADR-002.
 *
 * BL-385: All five client calls route through a module-level configurable
 * base URL (see configureBffClient / joinUrl below). Default/unconfigured
 * behaviour is byte-identical to 1.0.0 — relative URLs (BL-273 invariant).
 * React Native (which has no same-origin rewrite proxy) configures an
 * absolute baseUrl via configureBffClient — see README "React Native usage".
 *
 * BL-386: crypto.randomUUID() is guarded — environments without it (React
 * Native without the expo-crypto polyfill) get a descriptive error instead
 * of a raw TypeError. See README "React Native usage".
 *
 * ADR references:
 *   ADR-002 — Correlation IDs
 *   ADR-014 — TDD
 */

// ─── Typed error classes ──────────────────────────────────────────────────────

export class BffError extends Error {
  constructor(
    public readonly status: number,
    public readonly error?: string,
    message?: string,
  ) {
    super(message ?? `BFF request failed with status ${status}`);
    this.name = 'BffError';
  }
}

/**
 * BL-306 / AC-10: Thrown when the BFF HTTP 200 response body fails Zod schema
 * validation. This surfaces contract drift as an explicit error rather than
 * silently returning a mistyped object that causes a downstream /capture bounce.
 *
 * ADR-027: BFF owns the canonical client-facing contract; this error signals
 * that the PWA's schema is out of sync and must be updated.
 */
export class BffParseError extends Error {
  constructor(message?: string) {
    super(message ?? 'BFF response failed schema validation — unexpected contract shape');
    this.name = 'BffParseError';
  }
}

// ─── Response types ───────────────────────────────────────────────────────────

export interface StartOtpResponse {
  status: 'sent';
}

export interface VerifyOtpResponse {
  user_id: string;
  session_id: string;
  access_token: string;
  expires_in: number;
}

export interface MeResponse {
  user_id: string;
  phone_e164: string;
  [key: string]: unknown;
}

// ─── Request param types ──────────────────────────────────────────────────────

export interface StartOtpParams {
  phone_e164: string;
  channel: string;
}

export interface VerifyOtpParams {
  phone_e164: string;
  channel: string;
  code: string;
}

// ─── Configurable base URL (BL-385) ───────────────────────────────────────────

/**
 * Configuration accepted by configureBffClient. `baseUrl` is optional so
 * that `configureBffClient({})` is a valid no-op call (AC-4).
 */
export interface BffClientConfig {
  baseUrl?: string;
}

// Module-level state. Defaults to '' (relative) — BL-273 invariant: on the
// web PWA, Next.js rewrites() proxies /api/* to the BFF same-origin, so
// relative URLs keep the rr_session cookie scoped correctly. Reading an env
// var here (e.g. NEXT_PUBLIC_BFF_BASE_URL) would inline an absolute URL into
// the client bundle and break that proxy — see BL-273 deployed-bundle
// diagnosis 2026-05-12. React Native has no such proxy, so RN callers set an
// absolute baseUrl explicitly via configureBffClient (README "React Native
// usage").
let configuredBaseUrl = '';

/**
 * BL-385 AC-2/AC-4: Configure the base URL every client call is joined
 * against. Last-wins: each call replaces the previous value. `{baseUrl: ''}`
 * resets to the relative (web PWA) default. `{}` — baseUrl absent — is a
 * no-op that leaves the current configuration unchanged, so partial config
 * objects can be passed without accidentally resetting state.
 */
export function configureBffClient(config: BffClientConfig): void {
  if (config.baseUrl !== undefined) {
    configuredBaseUrl = config.baseUrl;
  }
}

/**
 * BL-385 AC-5: Join primitive used by every client call.
 *   - `joinUrl('', path)` returns `path` unchanged (BL-273 invariant).
 *   - Exactly one trailing slash is stripped from a non-empty `base`.
 *   - `path` MUST be `/`-prefixed; otherwise throws a descriptive error
 *     (both to catch caller mistakes and because naive string concatenation
 *     of a non-`/`-prefixed path would silently produce a malformed URL).
 */
export function joinUrl(base: string, path: string): string {
  if (!path.startsWith('/')) {
    throw new Error(`joinUrl: path must be "/"-prefixed (received "${path}")`);
  }
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}${path}`;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * BL-386 AC-2: Guard called as the first statement of every client function,
 * before any fetch. `crypto.randomUUID` is a Web Crypto API global available
 * in browsers, Node 19+, and Next.js — but NOT in React Native without the
 * `expo-crypto` polyfill. Without this guard, RN callers would see a raw
 * `TypeError: crypto.randomUUID is not a function` (or "Cannot read
 * properties of undefined (reading 'randomUUID')" when `crypto` itself is
 * absent) with no indication of the fix. Handles both failure modes.
 */
function assertRandomUUIDAvailable(): void {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error(
      'crypto.randomUUID is not available in this environment. On React ' +
        'Native, install and configure the expo-crypto polyfill — see this ' +
        "package's README \"React Native usage\" section — to provide " +
        'globalThis.crypto.randomUUID before calling @railrepay/app-core ' +
        'bff-client functions.',
    );
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (res.ok) {
    return res.json() as Promise<T>;
  }
  let errorBody: { error?: string; message?: string } = {};
  try {
    errorBody = (await res.json()) as typeof errorBody;
  } catch {
    // ignore parse error
  }
  throw new BffError(res.status, errorBody.error, errorBody.message);
}

// ─── API functions ────────────────────────────────────────────────────────────

/**
 * AC-3: Request OTP for the given phone number.
 * POST /api/auth/otp/start
 */
export async function startOtp(params: StartOtpParams): Promise<StartOtpResponse> {
  assertRandomUUIDAvailable();
  const correlationId = crypto.randomUUID();
  const res = await fetch(joinUrl(configuredBaseUrl, '/api/auth/otp/start'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  return handleResponse<StartOtpResponse>(res);
}

/**
 * AC-4: Verify the OTP code entered by the user.
 * POST /api/auth/otp/verify
 * BFF sets rr_session cookie on the response automatically.
 */
export async function verifyOtp(params: VerifyOtpParams): Promise<VerifyOtpResponse> {
  assertRandomUUIDAvailable();
  const correlationId = crypto.randomUUID();
  const res = await fetch(joinUrl(configuredBaseUrl, '/api/auth/otp/verify'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });
  return handleResponse<VerifyOtpResponse>(res);
}

// ─── Upload types ─────────────────────────────────────────────────────────────

export interface UploadExtractedFields {
  origin_station: string | null;
  destination_station: string | null;
  origin_crs: string | null;
  destination_crs: string | null;
  travel_date: string | null;
  departure_time: string | null;
  fare_pence: number | null;
  ticket_type: string | null;
  ticket_class: string | null;
  via_station: string | null;
  via_crs: string | null;
  operator_name: string | null;
  ticket_number: string | null;
}

export interface UploadResponse {
  scan_id: string;
  status: 'processing' | 'completed' | 'failed';
  confidence: number;
  extracted_fields: UploadExtractedFields;
  raw_text: string;
  claim_ready: boolean;
  ocr_status: string;
  gcs_upload_status: string;
  image_gcs_path: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * AC-3: Upload a ticket image to the BFF for OCR processing.
 * POST /api/tickets/upload
 *
 * SOP-IMPROVEMENT-006 / BL-273: Uses a RELATIVE URL by default —
 * configuredBaseUrl defaults to '' and joinUrl('', path) === path — do NOT
 * prepend env vars here (BL-385: use configureBffClient instead).
 *
 * ADR-002: X-Correlation-ID header added for observability.
 */
export async function uploadTicket(
  image: Blob,
  source: 'camera' | 'screenshot' | 'clipboard',
): Promise<UploadResponse> {
  assertRandomUUIDAvailable();
  const correlationId = crypto.randomUUID();
  const formData = new FormData();
  formData.append('image', image);
  formData.append('source', source);
  const res = await fetch(joinUrl(configuredBaseUrl, '/api/tickets/upload'), {
    method: 'POST',
    headers: {
      'X-Correlation-ID': correlationId,
      // NO Content-Type — FormData sets multipart/form-data with boundary automatically
    },
    credentials: 'include',
    body: formData,
  });
  return handleResponse<UploadResponse>(res);
}

// ─── Check-delay types ────────────────────────────────────────────────────────

export type { CheckDelayRequest, CheckDelayResponse } from './schemas/check-delay';

import type { CheckDelayRequest, CheckDelayResponse } from './schemas/check-delay';
import { checkDelayResponseSchema } from './schemas/check-delay';

/**
 * AC-5 (APP-004): Call POST /api/journeys/check-delay.
 * BL-306 / AC-10: Defensive Zod parse replaces blind cast. A drifted or
 * malformed BFF body now throws BffParseError rather than silently returning
 * a mistyped object that causes a downstream /capture bounce.
 *
 * OQ-7: Uses a RELATIVE URL by default — Next.js rewrite proxy forwards to
 * BFF; BL-385 now routes this through configuredBaseUrl/joinUrl like every
 * other client call (previously hardcoded, unlike the other four functions).
 * ADR-002: X-Correlation-ID header for observability.
 * ADR-027: BFF owns canonical contract; parse failure = contract drift.
 * BL-273: default remains relative-only — see configureBffClient for RN.
 */
export async function checkDelay(params: CheckDelayRequest): Promise<CheckDelayResponse> {
  assertRandomUUIDAvailable();
  const correlationId = crypto.randomUUID();
  const res = await fetch(joinUrl(configuredBaseUrl, '/api/journeys/check-delay'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
    },
    credentials: 'include',
    body: JSON.stringify(params),
  });

  // Non-2xx → throw BffError (existing behaviour preserved)
  if (!res.ok) {
    let errorBody: { error?: string; message?: string } = {};
    try {
      errorBody = (await res.json()) as typeof errorBody;
    } catch {
      // ignore parse error on error body
    }
    throw new BffError(res.status, errorBody.error, errorBody.message);
  }

  // 200 OK — defensively validate the body with Zod (BL-306 / AC-10)
  const raw: unknown = await res.json();
  const parseResult = checkDelayResponseSchema.safeParse(raw);
  if (!parseResult.success) {
    throw new BffParseError(
      `BFF response failed schema validation — unexpected contract shape: ${parseResult.error.message}`,
    );
  }
  return parseResult.data;
}

/**
 * AC-5: Fetch the current authenticated user.
 * GET /api/auth/me
 *
 * Accepts an optional headers object to allow server-side callers (e.g. middleware)
 * to forward the browser's Cookie header for server-to-server auth checks.
 *
 * BL-273: Accepts an optional baseUrl parameter so the Next.js middleware can
 * override the base URL to BFF_INTERNAL_URL, bypassing the rewrite proxy for
 * server-to-server calls (middleware runs on the server, not in the browser,
 * so it must call BFF directly rather than going through the /api/* rewrite).
 *
 * BL-385: this per-call baseUrl parameter takes precedence over
 * configureBffClient's module-level config when both are present — the
 * middleware's explicit BFF_INTERNAL_URL override must win.
 */
export async function getMe(
  headers?: Record<string, string>,
  baseUrl?: string,
): Promise<MeResponse> {
  assertRandomUUIDAvailable();
  const correlationId = crypto.randomUUID();
  const url = joinUrl(baseUrl ?? configuredBaseUrl, '/api/auth/me');
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Correlation-ID': correlationId,
      ...headers,
    },
    credentials: 'include',
  });
  return handleResponse<MeResponse>(res);
}
