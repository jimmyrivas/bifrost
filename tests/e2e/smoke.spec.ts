import { existsSync } from 'node:fs'
import { test, expect, BIFROST_BIN } from './fixtures'

// Skip the whole suite (rather than fail) when the packaged binary is absent,
// so `pnpm test:e2e` is safe to run without a prior build.
test.skip(!existsSync(BIFROST_BIN), `packaged binary missing at ${BIFROST_BIN}; run the electron-builder/AppImage build first`)

test('app launches and renders the shell', async ({ win }) => {
  await expect(win).toHaveTitle('Bifrost')
  // Top nav sections are present.
  for (const label of ['Connections', 'Clusters', 'Scripts']) {
    await expect(win.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first()).toBeVisible()
  }
  // Opens with at least one terminal tab.
  expect(await win.locator('[role="tab"]').count()).toBeGreaterThanOrEqual(1)
})

test('main process reports a semver app version', async ({ app }) => {
  const v = await app.evaluate(async ({ app }) => app.getVersion())
  expect(v).toMatch(/^\d+\.\d+\.\d+/)
})

test('navigating to Clusters shows the cluster manager', async ({ win }) => {
  await win.getByRole('button', { name: /^Clusters$/i }).first().click()
  await expect(win.getByText(/Cluster Manager|NEW CLUSTER/i).first()).toBeVisible()
})

test('opening Settings shows preference tabs', async ({ win }) => {
  await win.getByRole('button', { name: /^Settings$/i }).first().click()
  await expect(win.getByText(/Secret Managers|Import \/ Export|Discovery/i).first()).toBeVisible()
})
