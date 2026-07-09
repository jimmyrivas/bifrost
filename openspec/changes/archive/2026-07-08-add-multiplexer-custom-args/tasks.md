## 1. Types & shared quoting

- [x] 1.1 Add optional `configFile?`, `layout?`, `extraArgs?` to `AttachOptions` in `src/main/services/multiplexer/types.ts` with doc comments describing per-kind support and quoting.
- [x] 1.2 Move `dquote()` from `dtach.ts` into `types.ts` (exported) so all builders share it; update `dtach.ts` to import it.

## 2. Command builders

- [x] 2.1 `tmux.ts`: emit `-f <dquote(configFile)>` and verbatim `extraArgs` in the global position before `new-session`/`attach-session`, on both create and attach; ignore `layout`.
- [x] 2.2 `rmux.ts`: apply the same placement as tmux (tmux-compatible CLI).
- [x] 2.3 `zellij.ts`: emit `--config <dquote(configFile)>` and verbatim `extraArgs` before the `attach` subcommand on both paths; emit `--layout <dquote(layout)>` only on the create branch.
- [x] 2.4 `dtach.ts`: emit verbatim `extraArgs` after `-E -z` and before the shell; ignore `configFile`/`layout`. Confirm `-a` (attach-only) path also receives `extraArgs`.
- [x] 2.5 Ensure each builder adds nothing when the corresponding field is empty/unset.

## 3. Config model, persistence & pipeline

- [x] 3.1 Add `configFile`, `layout`, `extraArgs` to `MultiplexerConfig` and to `defaultMultiplexer` (empty strings) in `MultiplexerPanel.tsx`.
- [x] 3.2 Bump `bifrost-preferences` persist `version` to 7 in `preferences.store.ts` and add a `version < 7` backfill branch defaulting the three new fields to `''` on `localMultiplexer`.
- [x] 3.3 Extend the preload `buildAttachCmd` opts type in `src/preload/index.ts` to include the three new fields (IPC and `multiplexer.ipc.ts` pass `AttachOptions` through unchanged — verify no explicit field lists drop them).
- [x] 3.4 Forward `configFile`, `layout`, `extraArgs` from config into every `buildAttachCmd` call in `useTerminal.ts`.
- [x] 3.5 Forward the same fields into every `buildAttachCmd` call in `MultiplexerManager.tsx`.

## 4. UI

- [x] 4.1 Add a config-file `Input` to `MultiplexerPanel`, visible for tmux/rmux/zellij, with helper text noting the path is resolved on the remote host and `$HOME`/`~` expand.
- [x] 4.2 Add a layout `Input`, visible for zellij only, noting it accepts a layout name or a `.kdl` path and applies only when creating a session.
- [x] 4.3 Add an extra-args `Input`, visible for all kinds, noting the value is inserted verbatim (power-user escape hatch).

## 5. Tests & verification

- [x] 5.1 Extend `tests/services/multiplexer.test.ts`: tmux/rmux `-f` + `extraArgs` placement before subcommand, on create and attach.
- [x] 5.2 zellij tests: `--config` on both paths, `--layout` present on create and absent on attach, `.kdl` path quoting preserves `~`.
- [x] 5.3 dtach test: `extraArgs` lands after `-E -z` before the shell; `configFile`/`layout` ignored.
- [x] 5.4 Empty-field tests: each builder emits an unchanged command when all new fields are empty.
- [x] 5.5 Add a preferences migration test (or assert via store) that a v6 payload loads with the three fields backfilled to `''` and prior settings preserved.
- [x] 5.6 Run `pnpm typecheck` and `pnpm vitest run tests/services/multiplexer.test.ts`; fix any failures.
