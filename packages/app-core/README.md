# @railrepay/app-core

Platform-agnostic client core for RailRepay apps, extracted from `web-app-pwa` per
[ADR-033](https://app.notion.com/p/398815ba72ee810293c6d317bbd7f3a9) (BL-367 / APPCORE-001a).

Consumed by **both** `web-app-pwa` (immediately) and the Expo app (R1 sibling).

## Contents (`src/`)

| Module | Purpose |
|--------|---------|
| `schemas/check-delay.ts` | Zod schemas for `POST /api/journeys/check-delay` — **byte-identical** ADR-027 client contract |
| `schemas/login.ts` | UK phone + OTP zod schemas, `normalizeToE164` |
| `schemas/ticket-upload.ts` | Zod schema for the BFF ticket-upload response |
| `check-delay-payload.ts` | Pure `ExtractedFields → CheckDelayRequest` builder |
| `auth-store.ts` | Zustand in-memory auth store (`react` is a peer dependency) |
| `bff-client.ts` | Typed `fetch` wrapper for the web-app-bff API |

## Platform-agnostic guarantee (AC-3)

`src/` must contain **no** `next` / `react-dom` / `react-native` / `expo-*` imports and
**no** DOM-global usage (`window.`, `document.`, `localStorage.`, …). Enforced by the
`platform-agnostic-gate` job in CI.

## Testing

Vitest (ADR-004 / ADR-035 pure-TS carve-out). Coverage gate: ≥80/80/80/75.

```
npm run test --workspace=@railrepay/app-core
npm run test:coverage --workspace=@railrepay/app-core
```

## React Native usage

Resolved at BL-385 (injectable `baseUrl`) + BL-386 (`crypto.randomUUID` guard),
Technical Debt workflow TD-2 — these were previously tracked as "Known RN
caveats" pending at APPCORE-001c; both are now handled by `bff-client.ts`
itself rather than requiring RN-side workarounds.

### 1. Polyfill `crypto.randomUUID` with `expo-crypto`

`bff-client.ts` calls `crypto.randomUUID()` to generate the `X-Correlation-ID`
header (ADR-002) on every request. This is a standard Web Crypto API global in
browsers, Node 19+, and Next.js, but React Native does not provide it natively.
Without a polyfill, every `@railrepay/app-core` client call throws a
descriptive error naming `expo-crypto` and this section — install
[`expo-crypto`](https://docs.expo.dev/versions/latest/sdk/crypto/) and polyfill
`globalThis.crypto.randomUUID` once, near your app's entry point, before any
`@railrepay/app-core` call:

```ts
// entry-shim.ts — import this before anything that uses @railrepay/app-core
import * as ExpoCrypto from 'expo-crypto';

if (typeof globalThis.crypto === 'undefined') {
  // @ts-expect-error — RN has no global `crypto` object at all
  globalThis.crypto = {};
}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  globalThis.crypto.randomUUID = ExpoCrypto.randomUUID as typeof crypto.randomUUID;
}
```

### 2. Configure an absolute `baseUrl`

On the web PWA, Next.js `rewrites()` proxies `/api/*` to the BFF same-origin,
so the default relative `baseUrl` (`''`, BL-273 invariant) works without
configuration. React Native has no such same-origin proxy, so RN apps must
configure an absolute base URL once at startup:

```ts
import { configureBffClient } from '@railrepay/app-core';

configureBffClient({ baseUrl: 'https://bff.railrepay.example.com' });
```

Every client call (`startOtp`, `verifyOtp`, `uploadTicket`, `checkDelay`,
`getMe`) is then joined against this base via the `joinUrl` primitive
(`joinUrl(base, path)` — exactly one trailing slash is stripped from `base`;
`path` must be `/`-prefixed). Re-configuring is last-wins; call
`configureBffClient({ baseUrl: '' })` to reset to the relative default.
`getMe`'s own per-call `baseUrl` parameter (used by the PWA's Next.js
middleware) still takes precedence over `configureBffClient` when both are
given.
