[← Guide index](README.md)

# Automation

Bifrost automates the repetitive parts of remote work: saved commands you fire from a menu, Markdown runbooks executed step-by-step, sandboxed scripts that drive the terminal, a snippet library, and hooks that run when a connection opens or closes. Everything below is reachable from two places: the **sidebar** (Scripts, Remote Cmds, Runbooks) for editing, and the terminal's right-click **Automation ▸** submenu for running.

## The Automation menu

Right-click any terminal ▸ **Automation** to reach:

- **Scripts** — run a saved script against this terminal
- **Remote Commands** — fire a saved command (grouped, with confirmation where flagged)
- **Runbooks** — execute a saved runbook against this tab
- **Explain Command** — AI explanation of the selected text
- **AI Assistant** (Ctrl+Shift+A)
- **Broadcast** — cycle input broadcast mode (Off / Panes / All)
- **Paste Image to Server** (Ctrl+Shift+I) — see [SFTP & Files](06-sftp-files.md)
- **Enable cwd tracking** — shell integration for relative `.md` links

The Scripts / Remote Commands / Runbooks submenus are always present; while you haven't saved any yet, they show a hint pointing to the view where you create them.

## Remote commands

A remote command is a saved shell command you can send to any session without retyping it. Manage them in the sidebar under **Remote Cmds**.

Each command has:

| Field | Purpose |
|---|---|
| Command | The text sent to the terminal; supports `<VAR>` tokens and `{{param}}` placeholders |
| Description | The label shown in the menu |
| Group | Commands with the same group appear in their own submenu |
| Scope | **Global** (every connection) or a single connection |
| Confirm | Ask before executing |
| Keybinding | A shortcut label displayed next to the command in the menu |

Run them from right-click ▸ **Automation ▸ Remote Commands**. On execution:

1. If **Confirm** is set, you get a confirmation dialog first.
2. `<VAR>` tokens (`<IP>`, `<USER>`, …) are expanded for the current connection — see [Variable expansion](#variable-expansion) below.
3. Every `{{param}}` placeholder prompts you for a value; cancelling any prompt aborts the command.
4. The command is written to the session (with a trailing Enter unless configured otherwise).

## Runbooks

A runbook is a Markdown document whose fenced code blocks become executable steps. Open **Runbooks** in the sidebar to create one: paste (or write) the Markdown, save it, then run it either from the editor or from right-click ▸ **Automation ▸ Runbooks** on the target terminal.

In the editor you get:

- A **target tab** picker — choose which open session receives the commands (defaults to the active tab).
- **Run this block** per step, or **Run All** to walk the whole runbook.
- Per-step status as blocks execute.
- **Dry-run** mode — steps are echoed to the terminal instead of executed, so you can rehearse a procedure safely.
- **Dangerous-command warnings** — blocks containing destructive patterns (e.g. `rm -rf`, disk-wiping commands) are flagged, and you must explicitly confirm before they run.

The editor ships with sample runbooks (server status check, Linux maintenance) you can copy and adapt.

## Scripts

Scripts are JavaScript automations that run in a sandboxed, isolated worker — they cannot touch your filesystem or the Bifrost process, only the terminal API they're given. Edit them in the sidebar under **Scripts**.

A script is an `async function run(ctx)` with a small API:

| API | What it does |
|---|---|
| `ctx.send(text)` | Write text to the terminal (include `\n` to execute) |
| `ctx.log(message)` | Print to the script's output log in the editor |
| `ctx.sleep(ms)` | Pause between steps |

Example:

```js
async function run(ctx) {
  ctx.send('uptime\n')
  await ctx.sleep(1000)
  ctx.send('df -h\n')
  ctx.log('health check sent')
}
```

Run a saved script against the live terminal from right-click ▸ **Automation ▸ Scripts**.

## Snippets

The **Scripts** view includes a snippet browser (right-hand column) with a library of ready-made one-liners organized by category — Docker, Kubernetes, System, Network, Git, Disk, Process — plus full-text search.

For each snippet you can:

- **Copy** it to the clipboard, or
- **Run** it in the active terminal.

Snippets with `{{param}}` placeholders prompt you for each value before running.

## Pre/post-connection hooks

You can attach commands to a connection that run automatically around its lifecycle. Define them when editing a connection: **connection form ▸ HOOKS tab ▸ + Add Hook**.

Each hook has:

- **Phase** — `PRE` runs right after the SSH connection is established; `POST` runs when the session disconnects.
- **Command** — supports variable tokens such as `<USER>`, `<IP>`, `<NAME>`.
- **Ask** — when checked, a native confirmation dialog shows the exact command and lets you cancel it before it runs.

Two things worth knowing:

- Hooks execute **locally on your machine** (not inside the remote session), with a 30-second timeout — they're meant for things like updating a local inventory, mounting something, or triggering a notification around a connection.
- Every hook execution is written to the **audit log**, including skips (you declined the Ask dialog) and failures (with the error message).

## Variable expansion

Bifrost expands `<VAR>` tokens in dynamic tab titles, remote commands, and connection hooks. Verified tokens:

| Token | Expands to |
|---|---|
| `<IP>` | Connection host |
| `<PORT>` | Connection port |
| `<USER>` | Connection username |
| `<NAME>` | Connection name |
| `<TITLE>` | Session title |
| `<UUID>` | Connection id |
| `<ENV:name>` | An environment variable from your local machine |
| `<GV:name>` | A global variable (see honesty note below) |
| `<TIMESTAMP>` | Unix timestamp |
| `<DATE_Y>` / `<DATE_M>` / `<DATE_D>` | Year / month / day |
| `<TIME_H>` / `<TIME_M>` / `<TIME_S>` | Hour / minute / second |

Scope resolution: when the same name is defined both globally and on a connection, the **connection-scoped value wins** for that connection.

Honesty note on `<GV:name>`: the expansion engine resolves global variables, but there is **no in-app editor to define them yet** — the Keys view is a visual draft that doesn't persist anything. Until that lands, `<GV:>` tokens only resolve values that already exist in the database; treat the token as not usable in practice.

## Not available yet

- **Expect engine** (pattern → response automation): the backend exists, but there is no working UI to define or run rules.
- **Macros**: backend only, no UI.
- **Global variables editor**: no UI (see the `<GV:>` note above).
- **Clusters**: the Clusters panel is a visual draft not wired to its backend — don't rely on it.
- **Automatic clusters** (regex rules): not reachable in the UI.

---

Previous: [Sessions](07-sessions.md) · Next: [Observability & security](09-observability-security.md)

> Source specs: openspec/specs/automation/spec.md, openspec/specs/variable-expansion/spec.md — documentation reflects the implementation as of v0.3.x.
