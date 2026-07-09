## Why

Bifrost's multiplexer integration (dtach, tmux, zellij, rmux) only exposes a fixed
set of knobs — socket dir, session prefix, mouse capture. Power users routinely
want their own multiplexer config file, a specific zellij layout/profile, or a
handful of extra CLI flags, and today the only way to get those is to abandon
Bifrost's attach flow entirely. Exposing custom arguments closes that gap without
forcing users to fork the attach command.

## What Changes

- Add three optional custom-argument fields to the multiplexer configuration:
  - `configFile` — passed as `tmux -f <file>` / `zellij --config <file>` (applies on
    both create and attach). Not supported by dtach.
  - `layout` — passed as `zellij --layout <name-or-file>`, **create-only** (zellij
    ignores/rejects a layout when re-attaching an existing session). zellij-only.
  - `extraArgs` — free-form flags inserted verbatim in the multiplexer's
    global-flag position, on both create and attach. Supported by all kinds
    (e.g. `dtach -r winch`, `tmux -u`, `zellij --debug`).
- Thread the three fields through the full attach pipeline: `MultiplexerConfig`
  (renderer) → `AttachOptions` → preload → IPC → `buildAttachCmd` → per-kind
  builders (`dtach.ts`, `tmux.ts`, `zellij.ts`, `rmux.ts`).
- Insert each field at the grammatically correct position per multiplexer so the
  binary's CLI parser accepts it (global flags before the subcommand for
  tmux/rmux/zellij; after `-Ez` and before the shell for dtach).
- Quote defensively: `configFile` and `layout` use the existing double-quote
  strategy that preserves `$HOME`/`~` expansion; `extraArgs` is spliced verbatim
  (documented escape hatch — it is the user's own shell on their own host).
- Extend `MultiplexerPanel` to render only the fields the selected multiplexer
  supports (dtach → `extraArgs` only; tmux/rmux → `configFile` + `extraArgs`;
  zellij → all three).
- Migrate persisted preferences (`bifrost-preferences` v6 → v7), backfilling the
  new fields with empty defaults so existing configs keep working unchanged.

## Capabilities

### New Capabilities
- `multiplexer-custom-args`: User-supplied multiplexer arguments (config file,
  layout, and free-form extra flags) applied to the session attach/create command
  at the correct per-multiplexer CLI position, with per-kind support gating and
  shell-safe quoting.

### Modified Capabilities
<!-- No existing spec files in openspec/specs/ — nothing to modify. -->

## Impact

- **Config model**: `MultiplexerConfig` (`MultiplexerPanel.tsx`) and `AttachOptions`
  (`services/multiplexer/types.ts`) gain three optional fields.
- **Persistence**: `preferences.store.ts` migration bump v6 → v7.
- **Attach pipeline**: `preload/index.ts`, `multiplexer.ipc.ts`,
  `services/multiplexer/index.ts` pass the fields through unchanged.
- **Command builders**: `dtach.ts`, `tmux.ts`, `zellij.ts`, `rmux.ts` place the
  fields into the command string.
- **Callers**: `useTerminal.ts` and `MultiplexerManager.tsx` forward the config
  fields into `buildAttachCmd`.
- **UI**: `MultiplexerPanel.tsx` gains three conditionally-rendered inputs.
- **Tests**: `tests/services/multiplexer.test.ts` gains per-kind coverage for the
  new argument placement and quoting.
- No breaking changes: all new fields are optional and default to empty/off.
