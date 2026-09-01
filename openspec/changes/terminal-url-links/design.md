## Context

xterm.js is wired with `@xterm/addon-web-links` in three places — `useTerminal.ts:578`, `useSSH.ts:61`, `DetachedTerminal.tsx:48` — each as a bare `new WebLinksAddon()`. The default addon underlines URLs and, on a plain click, calls `window.open`, which Electron's `setWindowOpenHandler` (`main/index.ts:123`) turns into `shell.openExternal`. So links technically open today, but on a plain click (easy to trigger while selecting) and with no copy path.

There is already a close precedent for the interaction we want: the Markdown link provider in `useTerminal.ts:626` gates activation on `event.ctrlKey || event.metaKey` driven by the `markdownLinkActivation` preference, and the preferences store has a `markdownLinksEnabled` / `markdownLinkActivation` pair (`preferences.store.ts:28`) with Settings toggles. This change mirrors that precedent for `http(s)://` URLs.

## Goals / Non-Goals

**Goals:**
- Ctrl/Cmd+click opens an `http(s)://` URL in the OS default handler, scheme-validated.
- A discoverable one-click copy affordance on hover.
- Identical behavior across all three terminal surfaces via one factory.
- Configurable (enable + gesture), consistent with Markdown links.

**Non-Goals:**
- Linkifying non-URL text, file paths, or custom schemes (Markdown `.md` links already have their own provider).
- An always-visible inline icon rendered *inside* the xterm grid — xterm draws text on a canvas/WebGL surface, so arbitrary inline widgets aren't feasible; a hover tooltip is the correct affordance.
- Rich link previews.

## Decisions

### Decision 1: Centralize in a `lib/terminal-web-links.ts` factory

Replace the three `new WebLinksAddon()` calls with `makeWebLinksAddon(deps)` returning a configured addon. `deps` supplies `openExternal(url)` and `getActivation()`/`isEnabled()` (read live from preferences at click time, not captured). One implementation → the main terminal, SSH hook, and detached window behave identically and the hover-tooltip logic is written once.

- **Alternative:** edit each call site inline — rejected; triplicates the tooltip and gesture logic and drifts.

### Decision 2: Gesture-gated open via a scheme-validated IPC

The addon's activation handler checks the enabled flag, checks the gesture (`ctrlKey || metaKey` unless the preference is plain `click`), validates the URI is `http(s)://`, then calls a new `system:openExternal(url)` IPC. Main re-validates the scheme with `new URL(url)` and only calls `shell.openExternal` for `http:`/`https:`.

- **Why a dedicated IPC rather than relying on `window.open`→`setWindowOpenHandler`:** explicit, gesture-gated, and scheme-validated on both sides; it does not depend on the global window-open handler and cannot be reached for `file:`/`javascript:` URIs.

### Decision 3: Hover copy affordance as a single shared tooltip

A module-level singleton tooltip element (created lazily, appended to `document.body`, `position: fixed`, Spectral styling) is shown from the addon's `hover(event, uri)` option near the pointer, carrying the URL and a copy button; `leave` hides it after a short grace delay so the pointer can travel onto the tooltip to click copy (the tooltip cancels the pending hide on `mouseenter`). Copy writes via `navigator.clipboard.writeText` and briefly flips the icon to a check.

- **Alternative:** a right-click context-menu "Copy link" — less discoverable and needs hit-testing the cell under the cursor; kept as a possible future addition, not the primary affordance the user asked for ("un icono al costado").

### Decision 4: Mirror the Markdown preference shape

Add `urlLinksEnabled: boolean` (default true) and `urlLinkActivation: 'ctrl-click' | 'click'` (default `ctrl-click`) to `TerminalPreferences`; bump the persist version and backfill with the standard `state.terminal = { ...defaultTerminal, ...state.terminal }` branch. Two Settings controls sit beside the Markdown-link ones.

## Risks / Trade-offs

- **Tooltip hover/leave races** (pointer moving between link and tooltip) → mitigated by a short hide delay and cancel-on-enter; worst case the tooltip lingers briefly, which is harmless.
- **WebGL/canvas rendering** means the tooltip is a DOM overlay positioned by pointer coordinates, not pixel-locked to the link cell → acceptable; it tracks the cursor, which is what users expect from a hover chip.
- **Clipboard permission denied** (rare in Electron renderer) → copy silently no-ops; the open path is unaffected.
- **Scheme validation** is enforced on both renderer and main so a crafted `javascript:`/`file:` link in hostile output cannot be opened.

## Migration Plan

Additive. Persist version bump with a backfill branch means existing preference payloads load with the new fields defaulted (enabled, ctrl-click). No data migration, no dependency change. Rollback = revert code; the two orphaned preference keys are inert.

## Open Questions

- None blocking.
