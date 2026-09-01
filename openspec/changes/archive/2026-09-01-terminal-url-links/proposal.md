## Why

`http://` and `https://` URLs printed in the terminal are visually underlined by the web-links addon, but there is no reliable, discoverable way to (a) open them in the OS's default handler or (b) copy them. A plain click risks opening a link the user only meant to select, and there is no copy affordance at all. Users managing servers constantly hit URLs in logs and command output and want to act on them without hand-selecting the text.

## What Changes

- **Ctrl/Cmd+click** on an `http(s)://` URL opens it in the operating system's default handler, via a scheme-validated `shell.openExternal` (never `file:`, `javascript:`, or other schemes).
- Hovering a URL shows a small **copy affordance** (a tooltip with a copy icon) that copies the full URL to the clipboard in one click.
- The open gesture is governed by a preference (`ctrl-click` by default, or plain `click`), and the whole behavior can be turned off — mirroring the existing Markdown-link preferences, with matching Settings toggles.
- The behavior is centralized so all three terminal surfaces (main terminal, SSH terminal hook, detached window) get it identically, replacing three bare `new WebLinksAddon()` instances.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `terminal-ui`: adds requirements for opening and copying `http(s)://` links detected in terminal output (gesture-gated open in the OS handler; hover-to-copy). This is new terminal interaction behavior, specified as ADDED requirements on the existing capability.

## Impact

- **Main / IPC**: new `system:openExternal(url)` handler that validates the scheme (`http`/`https`) before `shell.openExternal`; preload `openExternal` binding + type.
- **Renderer**: new `lib/terminal-web-links.ts` factory building a configured `WebLinksAddon` (gesture-gated open handler + shared hover copy-tooltip). `useTerminal.ts`, `useSSH.ts`, `DetachedTerminal.tsx` call it instead of `new WebLinksAddon()`.
- **Preferences**: `urlLinksEnabled` + `urlLinkActivation` added to `TerminalPreferences` (persist version bump + backfill migration); Settings Terminal panel gets two controls.
- **No new dependencies** (web-links addon already present). No security surface beyond a scheme-validated external open.
