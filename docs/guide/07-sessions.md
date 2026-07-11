[← Guide index](README.md)

# Sessions that survive

Closing a tab — or Bifrost itself — doesn't have to mean losing your work. Bifrost integrates real terminal multiplexers for local session persistence, restores your open tabs on relaunch, and reconnects dropped SSH sessions automatically.

## Multiplexers: dtach, tmux, zellij, rmux

Bifrost persists local terminal sessions by running them inside a multiplexer of your choice: **dtach**, **tmux**, **zellij**, or **rmux** (a tmux-compatible multiplexer driven with the same commands). The shell keeps running inside the multiplexer even when the tab — or the whole app — is gone.

When you connect, Bifrost **probes** for the configured multiplexer and for existing sessions:

- If sessions exist, an **attach picker** appears listing them — live sessions to resume (scrollback intact, processes still running) and stale ones. Pick one to reattach, or create a new session. The picker can also kill a session or clean up stale ones.
- Session names are **deterministic**, derived from the connection or tab context using your configured prefix (default `bifrost-{conn}`, where `{conn}` expands to the connection name), so the same connection always finds its own sessions.
- With **Auto-attach if single session** enabled, Bifrost skips the picker and reattaches directly when there is exactly one live session.

## Per-connection multiplexer configuration

Each connection has a multiplexer panel in its editor: preferred multiplexer, a fallback when the primary isn't installed on the host, and custom arguments. The panel only shows the fields the selected multiplexer actually supports:

| Field | tmux / rmux | zellij | dtach |
| --- | --- | --- | --- |
| Config file | ✓ (`-f <file>`) | ✓ (`--config <file>`) | — |
| Layout | — | ✓ (`--layout <value>`) | — |
| Extra arguments | ✓ | ✓ | ✓ |

- **Config file** — a multiplexer config passed on both create and attach. `~` and shell variables like `$HOME` in the path are expanded on the remote host, so `~/.tmux.work.conf` works as expected. dtach has no config file, so the field is hidden.
- **Layout** (zellij only) — a registered layout name (`dev`) or a path to a `.kdl` file (`~/layouts/dev.kdl`). Applied **only when creating** a new session; attaching to an existing session never re-applies a layout.
- **Extra arguments** — a free-form escape hatch inserted verbatim into the multiplexer command (before the subcommand; for dtach, before the shell), on both create and attach. Multi-token flags like `-r winch` pass through untouched — no quoting is applied, so what you type is exactly what runs on your host.

Leaving any field empty adds nothing to the command. Settings saved before these fields existed keep working — the new fields simply default to empty.

## Session restore on relaunch

Bifrost remembers your open tabs. On the next launch, if there is anything to restore, it **asks first** — accept to reopen the previous session, decline to start fresh. No prompt appears when there's nothing to restore.

What restore does:

- **SSH tabs** are recreated and reconnected through the normal connect path — you'll be prompted for credentials if the connection requires them.
- **Local tabs** are restored **only if they were multiplexed**; a plain local shell can't outlive the app, so it isn't saved.
- A restored tab whose multiplexer session is still alive **reattaches** to it — scrollback and running processes come back.
- **Split layouts are not recreated**: each tab comes back as its root pane only.
- Tabs whose connection has since been **deleted are skipped silently**; the rest restore normally.

## SSH auto-reconnect

When an SSH session drops unexpectedly, Bifrost reconnects on its own with exponential backoff: the first retry after **3 seconds**, doubling each time up to a **60-second** cap, for up to **50 attempts**. Each attempt is announced in the terminal (`Reconnecting (attempt 3/50)... [retry in 12s]`).

If all attempts fail, Bifrost stops and prints `Press Enter to reconnect manually` — hitting `Enter` in that terminal resets the counter and starts over. If the connection uses a multiplexer, a successful reconnect goes through the same probe, so you land back in your session.

## Detach and reattach windows

Moving a tab to its own window — and adopting it back into the main window with its live session intact — is part of the same story: sessions outlive the surface they're displayed on. See [Detach to a window — and bring it back](03-terminal.md#detach-to-a-window--and-bring-it-back) in the Terminal chapter.

## Not available yet

- Bifrost is **Linux-only** for now; Windows and macOS support are on the roadmap, so session persistence currently assumes Linux hosts and shells.

> Source specs: `openspec/specs/session-multiplexing/spec.md`, `openspec/specs/multiplexer-custom-args/spec.md`, `openspec/specs/session-restore/spec.md` — documentation reflects the implementation as of v0.3.x.
