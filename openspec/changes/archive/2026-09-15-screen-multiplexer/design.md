## Context

Multiplexer backends live in `src/main/services/multiplexer/` behind the `Multiplexer`
interface (`probe`/`buildAttachCmd`/`killSession`/`cleanStale`), registered in `index.ts`'s
`IMPL` record and dispatched by kind. Adding a backend is additive: implement the interface,
add the kind literal in the (two) `MultiplexerKind` unions + preload, register it, and
surface it in the picker/panel/install-hint. tmux is the closest model (named sessions,
`target === name`).

## Goals / Non-Goals

**Goals:**
- GNU screen as a first-class backend: probe, attach-or-create, reattach, kill, clean stale.
- Consistent with the others: session keyed by name (so `remote-session-aliases` works
  unchanged), config-file + extra-args support, install hint when absent.

**Non-Goals:**
- screen's split/region features (Bifrost only drives the session lifecycle, as for tmux).
- Mouse-capture toggle (screen does not grab the mouse by default; the option is ignored).
- A socket-directory setting (screen manages `$SCREENDIR` itself; only dtach exposes one).

## Decisions

### Decision 1: Remote commands

- **Probe:** `command -v screen`; list with `screen -ls`. Parse lines
  `^\s*(\d+)\.(\S+)\s+\((Attached|Detached|Dead[^)]*)\)`: `Attached`/`Detached` → alive,
  `Dead` → `alive:false, state:'stale'`. `screen -ls` exit code is unreliable (returns
  non-zero even when sessions exist), so parse stdout, not the code.
- **Create (attach-or-create):** `screen -D -R -S <name>` — reattach the named session
  (detaching a stale client) or create it. The `new-session -A` analog.
- **Attach (existing):** `screen -x <target>` — multi-display attach that works whether the
  session is detached or attached elsewhere, without forcibly detaching other clients.
- **Kill:** `screen -S <target> -X quit`.
- **Clean stale:** `screen -wipe` (removes Dead sessions); count the `wiped` lines.
- **Config / extra args:** screen's rc file is `-c <file>` (global position); `extraArgs`
  spliced verbatim before the subcommand, matching the other backends. `layout` and
  `disableMouseCapture` are ignored.

### Decision 2: Session identity is the NAME, not `pid.name`

`screen -ls` prints `<pid>.<name>`, but the system uses the **name** as both `name` and
`target` (as tmux/zellij do). This keeps `target` stable between create-time and probe-time
so the remote alias store keys line up, and screen accepts a unique name for `-r`/`-x`/`-X`.
Bifrost already generates unique session names (`uniqueSessionName`), so collisions are not
expected; a genuinely duplicated name is the documented edge case where the user should
disambiguate.

### Decision 3: Touch points

Add `screen` to: `MultiplexerKind` in `types.ts` **and** the renderer copy in
`MultiplexerPicker.tsx`; the `IMPL` registry; the preload kind unions; the
`MultiplexerPanel` preferred/fallback selectors; and the `useTerminal` install-hint switch
(`sudo apt install screen`). No preference migration needed — the config shape is unchanged
(screen just becomes another allowed value of the existing `preferred`/`fallback` fields).

## Risks / Trade-offs

- **`screen -ls` output varies by version/locale** → the parser keys off the
  `(Attached|Detached|Dead)` marker and the leading `pid.name`, which are stable across
  versions; unpar8seable lines are skipped.
- **Duplicate session names** → name-as-target can be ambiguous for `-x`/`-X`; mitigated by
  Bifrost's unique naming, documented as an edge case.
- **`-D -R` detaches an existing remote client** on reattach → intended (single-owner
  reattach), and matches how users expect `screen -DR` to behave.

## Migration Plan

Purely additive; no data or config migration. Existing connections keep their current
backend; screen is simply a new selectable option.

## Open Questions

- None blocking.
