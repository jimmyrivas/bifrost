## 1. Scheme-validated external open (main + preload)

- [x] 1.1 Add `system:openExternal(url)` in `src/main/ipc/system.ipc.ts`: parse with `new URL(url)`, call `shell.openExternal` only for `http:`/`https:`, otherwise ignore; return void.
- [x] 1.2 Expose `openExternal(url)` in `src/preload/index.ts` (impl + type), next to `openPath`/`revealPath`.

## 2. Preferences

- [x] 2.1 Add `urlLinksEnabled: boolean` and `urlLinkActivation: 'ctrl-click' | 'click'` to `TerminalPreferences` in `preferences.store.ts`, with defaults (`true`, `'ctrl-click'`) in `defaultTerminal`.
- [x] 2.2 Bump the persist `version` to 9 and add a `version < 9` backfill branch (`state.terminal = { ...defaultTerminal, ...(state.terminal ?? {}) }`).

## 3. Web-links factory (renderer)

- [x] 3.1 Create `src/renderer/src/lib/terminal-web-links.ts` exporting `makeWebLinksAddon(deps)` where `deps` provides `openExternal(url)`, `isEnabled()`, and `requireCtrl()` (all read live). The activation handler: return early if disabled; gate on `ctrlKey||metaKey` unless plain-click; validate `^https?:\/\//i`; call `openExternal(uri)`.
- [x] 3.2 In the same module, implement a lazily-created singleton hover tooltip (fixed-position, Spectral styling) with a copy button; `hover(event, uri)` shows+positions it, `leave` hides after a grace delay, tooltip `mouseenter` cancels the pending hide. Copy uses `navigator.clipboard.writeText` and flips the icon to a check briefly. No-op the tooltip when disabled.
- [x] 3.3 Guard the tooltip/DOM code so it is import-safe under jsdom/node (create elements lazily inside handlers, not at module load).

## 4. Wire the three terminal surfaces

- [x] 4.1 `useTerminal.ts`: replace `new WebLinksAddon()` with `makeWebLinksAddon({...})` using `window.<ns>.openExternal` and the two new prefs; dispose/clean up on unmount if the factory returns disposers.
- [x] 4.2 `useSSH.ts`: same replacement.
- [x] 4.3 `DetachedTerminal.tsx`: same replacement (detached window reads preferences the same way).

## 5. Settings UI

- [x] 5.1 Add two controls to the Terminal preferences panel (beside the Markdown-link controls): an enable toggle bound to `urlLinksEnabled` and a gesture selector bound to `urlLinkActivation`, EN + ES labels consistent with the rest of the panel.

## 6. Tests

- [x] 6.1 Unit-test the activation logic (extract a pure `shouldOpenUrl({ uri, ctrl, meta, enabled, activation })` helper): opens on ctrl/meta in ctrl-click mode, opens on plain click in click mode, refuses non-http schemes, refuses when disabled.
- [x] 6.2 Unit-test main-side scheme validation (a pure `isOpenableExternalUrl(url)` helper): accepts http/https, rejects `file:`, `javascript:`, `data:`, malformed.

## 7. Docs + verification

- [x] 7.1 Update the user guide (EN `docs/guide/03-terminal.md` + ES) with a short "Links in the terminal" note (Ctrl+click to open, hover to copy, the preference), kept in sync.
- [x] 7.2 `pnpm typecheck` + `pnpm lint` + `pnpm test` green; `openspec validate terminal-url-links --strict` passes.
- [x] 7.3 Build the AppImage (`scripts/build-appimage-docker.sh`) for manual GUI verification: Ctrl+click a URL in output opens the browser; hovering shows the copy chip and it copies; toggling the preference to plain-click / off behaves accordingly.
