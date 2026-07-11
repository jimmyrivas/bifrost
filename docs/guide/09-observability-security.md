[← Guide index](README.md)

# Observability & Security

Bifrost keeps a verifiable trail of what happens in your sessions: full terminal recordings you can replay, plain-text transcripts, an append-only audit log, live host health, error detection, and AI summaries of idle sessions. On the security side, credentials are encrypted with the OS keychain and a redaction filter can mask secrets in terminal output.

## Session recording (asciicast)

Bifrost records SSH sessions in [asciicast v2](https://docs.asciinema.org/manual/asciicast/v2/) format — the `.cast` files play back in `asciinema` with real timing, exactly as the session happened. Both your input and the server's output are captured.

To record:

1. Right-click inside an SSH terminal → **Capture ▸ Record Session**.
2. While recording, a red pulsing dot appears on the tab and next to the **Capture** submenu, and the menu item changes to **Stop Recording**.
3. Right-click → **Capture ▸ Stop Recording**. A toast shows the saved `.cast` path with **Reveal in folder** and **Copy path** actions.

Recordings are saved under Bifrost's user-data folder in `recordings/` (on Linux typically `~/.config/bifrost/recordings/`). Recording is available for SSH sessions only — the menu item is hidden on local terminals.

### Replay a recording

```bash
asciinema play ~/.config/bifrost/recordings/rec-1720620000000-abc123.cast
```

You need [asciinema](https://asciinema.org/) installed (`sudo apt install asciinema` or equivalent). You can also upload a `.cast` with `asciinema upload <file>` to share it.

### The recordings manager

Right-click a terminal → **Capture ▸ Recordings…** opens a manager listing every recording with its date, duration, and file size. Per row you can:

- Copy the ready-to-run `asciinema play "<path>"` command
- Reveal the file in your file manager
- Delete the recording

An **Open folder** button opens the whole `recordings/` directory. Recording start and stop are also written to the [audit log](#audit-log).

## Session logs (plain-text transcripts)

Independently of recording, you can log a session's output to a plain-text file — useful for evidence, change tickets, or grepping later. This works for both SSH and local sessions.

- Right-click → **Capture ▸ Save Session Log** starts logging. A toast shows the file path (with Reveal/Copy actions), the menu item becomes **Stop Session Log**, and a subtle log glyph appears on the tab while logging is active.
- Log files land in the user-data `session-logs/` folder. Each file starts with a header noting the start time and connection, and ends with a session-end marker.

The file name comes from the connection's **Log pattern** field if you set one; otherwise the default is `%N_%Y%M%D_%H%m%s` (local terminals use `local_%Y%M%D_%H%m%s`). Available tokens:

| Token | Expands to |
| --- | --- |
| `%Y` | Year (4 digits) |
| `%M` | Month (01–12) |
| `%D` | Day (01–31) |
| `%H` | Hour (00–23) |
| `%m` | Minute (00–59) |
| `%s` | Second (00–59) |
| `%N` | Connection name |
| `%h` | Host |
| `%U` | Username |

The **Capture** menu also offers **Open Logs Folder** and **Open Recordings Folder**, and **Settings → Terminal** has a **Session Capture** section showing both folder paths with Open buttons.

## Audit log

Bifrost appends every significant event to an append-only JSON Lines file (`audit.jsonl` in the user-data folder). Logged events include:

- Connect / disconnect, authentication success / failure, MFA prompts
- Host-key verified / rejected / changed
- Port-forward start / stop
- Recording start / stop
- Credential events: vault password changed, key file stored
- Pre/post-connection hook executions (executed, skipped, or failed — see [Automation](08-automation.md))

Entries older than 30 days are rotated out. The audit log is also what powers the per-connection statistics you see in the sidebar (total connects, last connected, accumulated session time).

## Health monitoring

Bifrost periodically pings your hosts and shows a live health dot next to each connection in the sidebar, along with the measured latency. Dots update in the background — a red dot before you connect saves you a timeout.

## Error detection

Terminal output is matched against a library of known error patterns (command not found, permission denied, connection refused, and many more). When a command fails, a badge appears on the terminal identifying the error; you can dismiss it. Detected errors also feed the AI features below.

## Idle-session AI summary

When a session has been idle past a threshold *and* produced meaningful output, Bifrost offers an AI-generated summary of what happened:

- The affordance appears briefly, then collapses to a small icon in the pane corner — it never stays as a persistent banner.
- Expanding the icon generates the summary on demand (works for local, SSH, and Mosh sessions — it summarizes the real output buffer).
- You can save the summary as a connection note, or dismiss it until the session goes idle again.
- If there is nothing worth summarizing, no UI appears at all.

Summaries use the AI provider you configure in Settings — see [AI & MCP](10-ai-mcp.md).

## Desktop notifications

If a long-running command finishes while you are away from the tab, Bifrost sends a desktop notification so you don't have to keep checking.

## Secret redaction

**Settings → Security → Redact secrets in terminal output** enables a display filter that masks known secret patterns before they render in the terminal: AWS access/secret keys, GitHub and GitLab tokens, `sk-…` API keys, `Bearer`/`Authorization` headers, passwords embedded in URLs, `password=`/`token=` style assignments, private-key blocks, and Slack tokens.

- The toggle is **off by default** — you must enable it.
- Your choice now **persists across restarts** (it used to reset per session).
- Redaction affects what is *displayed*; it is a screen-sharing/shoulder-surfing guard, not encryption. The data still reaches your terminal application.

## Credential security

- Stored secrets are encrypted with the **OS keychain** via Electron's `safeStorage`.
- On Linux **without a keyring** (no gnome-keyring or kwallet), Bifrost falls back to base64 obfuscation and warns you. This is *not* encryption — install a keyring for real protection.
- Encrypted storage covers connection passwords and key passphrases, tunnel credentials, jump-host hop passwords, and TOTP secrets.
- The edit form shows stored passwords masked with a reveal control; clearing the field deletes the stored secret.

## Not available yet

For honesty's sake, these are **not** working in this release:

- **External password managers** (1Password, Bitwarden, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault): backend code exists but no UI reaches it.
- **SSH certificate authority** signing: no UI.
- **Vault re-encryption** (change vault password): no UI.
- **Database encryption at rest**: incomplete.

> Source specs: `openspec/specs/session-observability/spec.md`, `openspec/specs/secrets-management/spec.md` — documentation reflects the implementation as of v0.3.x.
