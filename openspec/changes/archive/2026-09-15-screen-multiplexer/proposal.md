## Why

Bifrost supports dtach, tmux, zellij and rmux for session persistence, but **GNU screen** — the multiplexer that ships by default on many older/enterprise Linux boxes where tmux is not installed — is missing. Sysadmins connecting to those hosts have no persistence option without installing extra software.

## What Changes

- Add **GNU screen** as a fifth multiplexer backend, selectable per connection and for local tabs, on equal footing with the existing four (probe, attach-or-create, reattach, kill, clean stale).
- Screen participates in everything the others do: the session picker, auto-attach, custom config file / extra args, and remote tab aliases (`remote-session-aliases`).

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `session-multiplexing`: screen becomes a supported, selectable backend — a new normative backend requirement plus the naming/attach behavior that differs from the others.

## Impact

- **Main**: new `src/main/services/multiplexer/screen.ts` (implements `Multiplexer`); `screen` added to `MultiplexerKind` (`types.ts`) and the `IMPL` registry (`index.ts`).
- **Renderer**: `screen` added to the picker's `MultiplexerKind`, the `MultiplexerPanel` backend selector, and the `useTerminal` install-hint switch.
- **Preload**: `screen` added to the multiplexer kind unions.
- **Tests**: screen probe-parse + attach-command unit tests.
- **No new dependencies.** No schema/DB change. Aliases work unchanged (screen sessions are keyed by name like tmux/zellij).
