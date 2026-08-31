# E2E testing (Playwright + Electron)

Drives the **packaged** Bifrost app through Playwright's `_electron` API, so
changes can be verified against the real artifact without a human at the screen.

## Prerequisites

- The packaged binary at `dist/linux-unpacked/bifrost` (produced by
  electron-builder / `scripts/build-appimage-docker.sh`). Override with
  `BIFROST_BIN=/path/to/binary`.
- A display, or `xvfb-run` for headless runs. Launches use `--no-sandbox`.
- Every launch uses an **isolated `XDG_CONFIG_HOME`** (a temp dir), so tests
  never read or write your real connections/database.

## (a) Ad-hoc driver — quick manual checks

```bash
xvfb-run -a node tests/e2e/drive.mjs [--view=clusters] [--shot=/tmp/x.png] [--text]
```

- `--view=<label>` clicks a nav section (connections|clusters|scripts|…).
- `--shot=<path>` writes a screenshot (default `/tmp/bifrost-drive.png`).
- `--text` prints the first ~800 chars of visible text.

Import `launchBifrost()` from `harness.mjs` in a throwaway script for anything
more specific (fill a form, call `window.bifrost.*` via `win.evaluate`, assert
DOM, screenshot).

## (b) Versioned regression suite

```bash
xvfb-run -a pnpm test:e2e          # or: pnpm test:e2e:headless
```

Specs live in `*.spec.ts` and use the fixtures in `fixtures.ts` (per-test app
launch + isolated config; exposes `app` for main-process `evaluate` and `win`
for the renderer). The suite **skips itself** when the packaged binary is
missing, so it's safe to run without a build.

## What this can and cannot verify

**Can:** renderer DOM + interactions, visual regressions (via screenshots),
DB/IPC flows (`window.bifrost.*`), main-process state (`app.evaluate`), console
logs — the majority of the UI.

**Cannot (needs a real desktop / hardware):** the KDE system-tray SNI rendering,
external GUI clients (xfreerdp/vncviewer windows), physical FIDO2 keys, and true
Wayland-only quirks (xvfb is X11/XWayland).
