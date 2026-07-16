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

## Known RN caveats (tracked as TD items at APPCORE-001c)

- `bff-client.ts` uses a relative default `baseUrl` (`''`, BL-273 invariant) — RN needs an injectable absolute `baseUrl`.
- `bff-client.ts` uses `crypto.randomUUID` — RN needs an `expo-crypto` polyfill.
