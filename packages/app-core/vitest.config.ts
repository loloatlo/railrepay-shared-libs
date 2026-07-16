import { defineConfig } from 'vitest/config';

/**
 * Vitest config for @railrepay/app-core.
 *
 * environment: 'jsdom' — required by tests/auth-store.test.ts (Storage.prototype
 *   spy + @testing-library/react `act`) and by the bff-client upload tests
 *   (Blob / FormData). The extracted SOURCE remains platform-agnostic; jsdom is a
 *   test-only concern (AC-3 gates src/, not the test runner).
 *
 * Coverage gate: >=80/80/80/75 (lines/functions/statements/branches), enforced in
 *   CI per ADR-014 / BL-367 AC. src/index.ts (the re-export barrel) is excluded —
 *   it carries no branch logic.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'node_modules/', 'dist/', 'tests/'],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },
  },
});
