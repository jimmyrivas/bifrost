## 1. Backend (main)

- [x] 1.1 Create `src/main/services/multiplexer/screen.ts` implementing `Multiplexer`: probe (`command -v screen` + `screen -ls`, parse `pid.name (Attached|Detached|Dead)`), buildAttachCmd (`-D -R -S <name>` create / `-x <target>` attach, `-c` config, extraArgs), killSession (`-S <t> -X quit`), cleanStale (`screen -wipe`, parse count). Export `parseScreenListOutput`.
- [x] 1.2 Add `'screen'` to `MultiplexerKind` in `types.ts`.
- [x] 1.3 Register `screen` in the `IMPL` record in `index.ts` (+ import).

## 2. Kind unions (renderer + preload)

- [x] 2.1 Add `'screen'` to the renderer `MultiplexerKind` in `MultiplexerPicker.tsx` and the inline `MuxBinding` union in `sessions.store.ts`.
- [x] 2.2 Add `'screen'` (and the missing `'rmux'`) to every hand-written kind union in `preload/index.ts` (probe/buildAttachCmd/killSession/cleanStale/setAlias).

## 3. Backend-selection UI

- [x] 3.1 `MultiplexerPanel.tsx`: add `'screen'` to `MultiplexerKind`/`MultiplexerFallback`, a `KIND_OPTIONS` and `FALLBACK_OPTIONS` entry, and to the `showConfigFile` (`-c`) and `showFallback` gates; handle screen's `-c` placeholder/help text.
- [x] 3.2 `useTerminal.ts` install-hint switch: add a `screen` arm (`sudo apt install screen`).
- [x] 3.3 `MultiplexerManager.tsx`: probe screen in the parallel probe, extend the panel-internal probe shape + activeProbe + kind tabs with `screen`, bias initial active to screen, and add screen to the clean-stale gate.
- [x] 3.4 `MultiplexerPicker.tsx`: add a screen arm to the clean-inactive tooltip.

## 4. Tests

- [x] 4.1 Add screen unit tests to `tests/services/multiplexer.test.ts`: buildAttachCmd (create/attach/shell/config/binaryPath), parseScreenListOutput (attached/detached/dead, empty), probe (missing + non-zero `-ls` exit), cleanStale (count parse).

## 5. Docs + verification

- [x] 5.1 Update the user guide session-multiplexing chapter (EN `docs/guide/07-sessions.md` + ES) to list screen as a fifth backend, kept in sync.
- [x] 5.2 `pnpm typecheck` + `pnpm lint` + `pnpm test` green; `openspec validate screen-multiplexer --strict` passes.
- [x] 5.3 Build the AppImage for manual GUI verification: select screen for a connection, connect to a host with `screen` installed, create/attach/reattach a session, confirm the picker lists it and the alias/kill/clean paths work.
