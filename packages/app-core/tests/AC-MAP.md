# APPCORE-001a — Test → Acceptance-Criteria map (BL-367)

Jessie US-2 (RED). The 14 suites below were **migrated verbatim** from
`web-app-pwa/tests/unit/` — the only change is the source import path
(`../../lib/*` → `../src/*`, `../../../lib/schemas/*` → `../../src/schemas/*`).
Byte-identical otherwise (Test Lock Rule, CLAUDE.md §6 — Blake MUST NOT modify).

## BL-367 AC coverage (this slice = 001a)

- **AC-1** (package published per shared-libs conventions): `package.json`
  (CJS `main`/`types`, `files:[dist]`, `publishConfig.access=public`, deps
  zod+zustand, peer react≥18.2), `tsconfig.json` (mirrors winston-logger,
  `exclude:[tests]`), `vitest.config.ts` (ADR-004 / ADR-035 pure-TS carve-out,
  coverage gate ≥80/80/80/75). Publish itself is verified at 001a GREEN/publish.
- **AC-3** (no DOM/RN imports — platform-agnostic; CI check): `.github/workflows/ci.yml`
  → `platform-agnostic-gate` job over `packages/app-core/src`.
- **AC-4** (existing pure-TS unit tests migrate with the code; Test Lock applies):
  the 14 suites in this directory (below).

> AC-2 (PWA consumes with zero behaviour change) is verified in sub-story **001b**,
> not here.

## Migrated suites (source module → test file)

| Source module (`src/`) | Test file | Granular story ACs asserted (in-file) |
|---|---|---|
| `auth-store.ts` | `tests/auth-store.test.ts` | LOGIN-001 AC-3, AC-5 |
| `bff-client.ts` | `tests/bff-client.test.ts` | LOGIN-001 AC-3/4/5, BL-273 baseUrl |
| `bff-client.ts` | `tests/bff-client-check-delay.test.ts` | APP-004 checkDelay |
| `bff-client.ts` | `tests/bff-client-jm002.test.ts` | JM-002 attestation |
| `bff-client.ts` | `tests/bff-client-upload-ticket.test.ts` | APP-003 uploadTicket |
| `check-delay-payload.ts` | `tests/check-delay-payload.test.ts` | APP-004 AC-5 payload build |
| `check-delay-payload.ts` | `tests/check-delay-payload-bl315c.test.ts` | BL-315c |
| `check-delay-payload.ts` | `tests/check-delay-payload-jm002.test.ts` | JM-002 |
| `schemas/check-delay.ts` | `tests/schemas/check-delay.test.ts` | APP-004 AC-5 (ADR-027 contract) |
| `schemas/check-delay.ts` | `tests/schemas/check-delay-bl315c.test.ts` | BL-315c response variants |
| `schemas/check-delay.ts` | `tests/schemas/check-delay-bl336-ss4.test.ts` | BL-336 SS4 |
| `schemas/check-delay.ts` | `tests/schemas/check-delay-jm002.test.ts` | JM-002 |
| `schemas/login.ts` | `tests/schemas/login.test.ts` | LOGIN-001 AC-2/4 |
| `schemas/ticket-upload.ts` | `tests/schemas/ticket-upload.test.ts` | APP-003 AC-3/4 |

## RED condition (US-2)

`packages/app-core/src/` is empty (only `.gitkeep`). Every suite fails on an
unresolved `../src/*` / `../../src/*` import until Blake's US-3 GREEN adds the six
verbatim source modules + barrel. This is the intended RED signal, visible in CI.
