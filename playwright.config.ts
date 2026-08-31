import { defineConfig } from '@playwright/test'

// E2E tests drive the packaged Electron app via Playwright's _electron
// (see tests/e2e/fixtures.ts). They need the packaged binary at
// dist/linux-unpacked/bifrost and a display — run headless with:
//   xvfb-run -a pnpm test:e2e
export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']]
})
