import { test as base, _electron, type ElectronApplication, type Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const BIFROST_BIN = process.env.BIFROST_BIN || 'dist/linux-unpacked/bifrost'

/**
 * Playwright fixtures that launch the packaged Bifrost app per test with an
 * isolated XDG_CONFIG_HOME (so tests never touch real user data), and expose the
 * ElectronApplication (`app`, for main-process evaluate) and its window (`win`).
 */
export const test = base.extend<{ app: ElectronApplication; win: Page }>({
  app: async ({}, use) => {
    const cfg = mkdtempSync(join(tmpdir(), 'bifrost-e2e-'))
    const app = await _electron.launch({
      executablePath: BIFROST_BIN,
      args: ['--no-sandbox'],
      env: { ...process.env, XDG_CONFIG_HOME: cfg }
    })
    await use(app)
    await app.close().catch(() => {})
    rmSync(cfg, { recursive: true, force: true })
  },
  win: async ({ app }, use) => {
    const win = await app.firstWindow()
    await win.waitForLoadState('domcontentloaded')
    await win.waitForTimeout(1500)
    await use(win)
  }
})

export { expect } from '@playwright/test'
