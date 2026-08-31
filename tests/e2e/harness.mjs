// Reusable harness to drive the packaged Bifrost app headlessly (via Playwright's
// _electron), with an isolated config dir so tests never touch real user data.
//
// Prereq: the packaged binary at dist/linux-unpacked/bifrost (produced by
// electron-builder / scripts/build-appimage-docker.sh). Override with BIFROST_BIN.
// Run under a display or xvfb: `xvfb-run -a node tests/e2e/<script>.mjs`.
import { _electron as electron } from 'playwright'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const BIFROST_BIN = process.env.BIFROST_BIN || 'dist/linux-unpacked/bifrost'

/**
 * Launch Bifrost and return handles. `close()` shuts it down and removes the
 * temp config dir. Pass `configDir` to reuse a persistent dir across launches.
 */
export async function launchBifrost({ configDir, settleMs = 1800 } = {}) {
  if (!existsSync(BIFROST_BIN)) {
    throw new Error(`Bifrost binary not found at ${BIFROST_BIN}. Build it first (electron-builder) or set BIFROST_BIN.`)
  }
  const ephemeral = !configDir
  const cfg = configDir || mkdtempSync(join(tmpdir(), 'bifrost-e2e-'))

  const app = await electron.launch({
    executablePath: BIFROST_BIN,
    args: ['--no-sandbox'],
    env: { ...process.env, XDG_CONFIG_HOME: cfg }
  })
  const win = await app.firstWindow()
  await win.waitForLoadState('domcontentloaded')
  await win.waitForTimeout(settleMs) // let React mount + first tab open

  return {
    app,
    win,
    configDir: cfg,
    /** Screenshot the window to a path (default /tmp/bifrost-e2e.png). */
    shot: (path = '/tmp/bifrost-e2e.png') => win.screenshot({ path }).then(() => path),
    /** Click a top-nav / sidebar section by its visible label (best-effort). */
    goto: async (label) => {
      await win.getByRole('button', { name: new RegExp(`^${label}$`, 'i') }).first().click()
      await win.waitForTimeout(700)
    },
    async close() {
      await app.close().catch(() => {})
      if (ephemeral) rmSync(cfg, { recursive: true, force: true })
    }
  }
}
