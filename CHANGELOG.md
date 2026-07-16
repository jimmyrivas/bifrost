# Changelog

All notable changes to Bifrost will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.4] - Unreleased

Phases 3 and 4 of the post-audit wiring plan: reach the import, discovery, tray,
variables, macros, expect, and cluster backends that shipped without any UI.

### Added
- **Import / Export** (Settings → Import / Export): import `~/.ssh/config`,
  Ansible inventories, and Terraform state as connections with a preview →
  select → import flow, plus JSON backup export/restore. Wires the existing
  `import.*` handlers and `discovery.terraform`.
- **Cloud discovery** (Settings → Discovery): a provider grid (AWS, GCP, Azure,
  Docker, Podman, Kubernetes) gated by the local CLI's availability, per-provider
  scan, and multi-select import of running instances as SSH connections.
- **System tray connections**: the tray menu is now fed the connection list with
  favorites and recents (pushed from the renderer via a new `tray:update` IPC);
  clicking a connection shows the window and opens it.
- **Global variables editor** (Keys view): a real editor over
  `variables:listGlobal/setGlobal/deleteGlobal` with secret masking — the
  `<GV:>` resolver now has a UI to define its values.
- **Expect automation** (connection editor → EXPECT tab, SSH): define
  regex→response rules per connection; they run automatically on the live SSH
  session (matched output triggers the response, with send-Enter and
  hide-from-log options). Wired in the main process so responses go straight to
  the pty.
- **Macros editor** (Automation view) with global and per-connection scopes,
  persisted via a new `macros:save` handler; run a macro from the terminal's
  right-click **Macros** submenu (remote macros type into the session with
  variable resolution; local macros run and echo their output; honors the
  confirm flag).
- **Clusters** (Clusters view): the cluster manager is wired to the real
  backend — create/delete, a member picker and regex auto-cluster, a live tree
  inspector; "Open cluster" opens every member connection in its own tab and
  turns on all-tabs broadcast.
- Preload namespaces for `cluster.*`, `macros.*`, `variables.*`, and the full
  `expect.*` surface.
- **Database encryption at rest** (Settings → Security): encrypt the whole
  database file with a passphrase (AES-256-GCM). Bifrost decrypts it on startup
  (a passphrase prompt) and re-encrypts on quit. Enabling shows a hard warning —
  a lost passphrase means unrecoverable data. Protects the file when the app is
  closed (not SQLCipher; the DB is plaintext on disk while running).
- `success` toast variant (green) for positive feedback.

## [0.3.3] - 2026-07-14

Follow-up to Phase 2: close the session-id prefix debt so the new protocols
behave like SSH/Mosh everywhere.

### Fixed
- **Capture indicators and session summaries** now work for Telnet/FTP/SSM
  sessions. The recording/logging badges, the global REC indicator, and the
  idle session summary keyed off a `mosh:`-only prefix strip, so they missed
  every other prefixed protocol.
- **Command/runbook/snippet writes** to Telnet/FTP/SSM sessions now go to the
  PTY launcher (`protocols.writePty`) instead of the local-terminal channel;
  the terminal context menu also mis-sent Mosh input to the local channel.
- All session-id handling is centralized in `lib/session-id.ts`
  (`parseSessionId`/`rawSessionId`/`writeToSession`), which recognizes every
  protocol prefix (`ssh`/`mosh`/`telnet`/`ftp`/`ssm`/`rdp`/`vnc`).

## [0.3.2] - 2026-07-12

Phase 2 of the post-audit wiring plan (protocol routing & SSH options) plus two
correctness fixes found during GUI verification. All GUI-verified.

### Added
- **Protocol routing**: RDP/VNC now launch the external client (with stored
  options and the vault password passed through so `xfreerdp` doesn't prompt on
  a dead stdin); Telnet/FTP/SSM/Mosh run on the shared PTY-backed data path;
  Custom Command and Local open a local PTY. Custom command and RDP options are
  now persisted in the connection form (previously discarded on save).
- **Launcher-missing feedback**: a global toast with a per-protocol install hint
  (`apt install …`) when `xfreerdp`/`vncviewer`/`lftp`/`aws`/`mosh` is absent,
  mirrored inline in the pane.
- **SSH advanced options**: `Ciphers`/`MACs`/`KexAlgorithms`/`HostKeyAlgorithms`
  and `ForwardX11` from a connection's SSH options are now applied at connect
  time (parsed by `services/ssh-options.ts`).

### Fixed
- **Saving Mosh/Custom connections failed** with `SQLITE_CONSTRAINT_CHECK`: the
  `connections.method` CHECK constraint only allowed six methods. A table-rebuild
  migration widens it to include `mosh`, `custom`, and `ssm`. Foreign-key
  enforcement is disabled around the migration so the parent-table rebuild does
  **not** cascade-delete existing hooks/macros/expect rules.
- **Removing all connection hooks didn't persist**: the editor skipped the save
  when the hook list was empty, leaving stale rows in the database. It now always
  syncs the list.

## [0.3.1] - 2026-07-11

Phase 1 of the post-audit wiring plan: every "pretends to work" feature now
works end-to-end, plus a new observability home. All features GUI-verified.

### Added
- **Session recording, for real**: asciicast v2 `.cast` files now capture input
  and output. Full UX: Capture submenu with dynamic Record/Stop, pulsing tab
  badge, blinking REC indicator in the status bar, stop-toast with the file
  path, and replay via `asciinema play`.
- **Session logs**: plain-text transcripts for SSH, local, and Mosh sessions
  with start/stop from the Capture menu, pattern-based file names, and honest
  headers. Captures auto-finalize when a session closes.
- **Session Captures browser**: one two-tab browser (Recordings | Session
  Logs) with per-file actions (play command / open, reveal, delete, active-log
  guard), reachable from the Capture menu and Preferences → Session Capture.
- **Activity view** (sidebar): the audit log as a day-grouped timeline with
  category filters, connection/host search, 24h/7d/30d ranges, live refresh,
  expandable details, per-connection drill-down (plus a "View activity" link
  in connection stats), insights counters, log rotation, and CSV/JSONL export
  of the filtered events. New `session_log_start/stop` audit events.
- **Tab reattach**: closing a detached window returns the tab to the main
  window *adopting the same live session* — scrollback replayed, process
  still running.
- **Pre/post-connection hooks**: exec commands stored on a connection now run
  on connect/disconnect (locally), honoring per-command confirmation; every
  execution is audit-logged.
- **Dynamic (SOCKS5) tunnels**: a real RFC 1928 proxy per tunnel backed by the
  SSH connection (CONNECT, IPv4/domain/IPv6, 127.0.0.1-only), integrated with
  start/stop/list/auto-start.
- **Find in terminal**: `Ctrl+Shift+F` (plain `Ctrl+F` stays with the shell),
  highlighted matches, Esc clears. Clear/Reset terminal actions wired.
- **User guide**: bilingual chapter-by-chapter documentation under
  `docs/guide/` (EN) and `docs/guide/es/`, verified against the code.

### Changed
- Terminal context menu redesigned: ~32 flat items → grouped submenus
  (Copy as / Layout / Automation / Capture / Session). Everything dynamic
  re-evaluates when the menu opens; empty submenus show a hint instead of
  disappearing; recording is visibly "SSH only" on local/mosh panes.
- Secret-redaction preference persists across restarts (still off by default).
- Sidebar "Logs" section renamed to "Activity".
- Early planning documents moved to `docs/archive/` with an honesty note —
  `docs/guide/` and `openspec/specs/` are the source of truth.

### Fixed
- **AppImage portability**: the v0.3.0 AppImage was linked against the build
  host's glibc 2.43 and crashed on most distros with a misleading
  `pty.node` error. Releases are now built inside a Debian 11 container
  (`scripts/build-appimage-docker.sh`) and run on glibc ≥ 2.28 systems
  (Ubuntu 20.04+, Debian 11+, RHEL 8+).
- Session logs used to write header/footer only (no output) for local and
  Mosh terminals, with an `undefined (undefined@undefined)` header.
- Context-menu entries could go missing or stale (Record Session, Remote
  Commands) because the menu was evaluated at mount time, not open time.
- The Electron download cache could leak into the packaged asar, inflating
  the AppImage from 132 MB to 233 MB.

## [0.3.0] - 2026-07-10

First public release — the repository is now available on GitHub under
GPL-3.0-or-later.

### Added
- **Copy as CSV / Markdown**: right-click a table (or any selection) in the terminal, the Markdown viewer, or an AI Assistant response to copy it as clean CSV (RFC 4180) or GitHub-flavored Markdown. The Markdown viewer header "Copy" button is now a dropdown with the three formats. Terminal parsing understands ASCII-pipe and box-drawing tables (psql included) and refuses to mangle piped shell commands.
- **Stored password visibility**: Edit Connection now prefills the saved password/passphrase from the vault (masked, with reveal toggle) and clearing the field removes the stored credential safely.
- **CI**: GitHub Actions and GitLab CI pipelines (lint, typecheck, unit tests).
- **Docs**: README, LICENSE (GPL-3.0-or-later), AGENTS.md.

### Fixed
- Ten review findings in the copy-formats feature (false-table detection, partial table selections, code-block fidelity, toast races, stale menu labels).
- Session logger no longer crashes the main process if the log directory disappears mid-write.
- Full unit suite green (316 tests) and zero ESLint errors in `src/`.

## [0.2.0] - 2026-03-24

### Added
- **Session Notes**: Save selected terminal text as notes with tags (note, evidence, command, error, AI prompt). Notes panel in sidebar with search and tag filtering. Stored in SQLite.
- **Session Resume**: Idle detection (5min threshold) with banner showing idle duration. AI-powered session summary using terminal buffer. Save summaries as notes.
- **AI Session Detection**: Auto-detect AI CLI tools (claude, sgpt, aichat, ollama, copilot, aider, etc.) in terminal output. Purple "AI" badge on tab.
- **AI Assistant Improvements**: Markdown rendering (code blocks, headers, lists, bold/italic). Inline code clickable to insert in terminal. Rich context from connection metadata + last 20 lines of terminal output. Clear conversation button.
- **Runbook Execution Overhaul**: Tab target selector (choose which terminal runs the runbook). Per-step status indicators (idle/running/done/error/skipped). Dangerous command detection with confirmation dialogs. Dry-run/echo mode. Run From Here. Cancel execution. 5 sample runbooks (preventive maintenance, SSH hardening, firewall, users/permissions, Docker).
- **Shell Selection**: Detect available shells (bash, zsh, fish, pwsh, sh). Shell picker dropdown on TabBar "+" button. PowerShell (pwsh) support on Linux.
- **PCC Broadcast Toggle**: New `hidden` state that removes PCCBar entirely. Cycle: hidden → off → panes → all-tabs. Toggle button in StatusBar and context menu.
- **Workspace Improvements**: Prominent pill-style workspace indicator in navbar (cyan when active). Inline rename (no broken window.prompt). Delete confirmation dialog.
- **Sidebar Visual Overhaul**: Raised card backgrounds (#222225) for nav, recent, and bottom actions. Section labels with icons. Active nav item with cyan icon.
- **StatusBar Enhancements**: AI toggle button. PCC broadcast toggle with colored state. Workspace indicator. Removed redundant "Cluster: Alpha" label.
- **Context Menu Additions**: AI Assistant toggle (Ctrl+Shift+A). Broadcast mode toggle. Save as Note (with tag submenu). Runbooks submenu for direct execution.

### Fixed
- **AI config persistence**: AI provider settings (provider, API key, model, URL) now persist to SQLite `preferences` table and load on startup.
- **Broadcast banner on startup**: "Broadcasting to all tabs" no longer appears incorrectly on fresh start (was showing because `hidden` state wasn't handled).
- **PCCBar reactivity**: AppShell now uses reactive Zustand selectors instead of static `getState()` for broadcast mode.
- **Workspace rename**: Replaced broken `window.prompt()` (doesn't work in Electron) with inline input field.
- **Runbook template literal escaping**: Fixed `${days_left}` being interpreted as JS interpolation in runbook sample content.
- **Recent section**: Collapsible by default, shows connection count. Expands on click.

### Security
- **C-03**: password-manager.ts — All 19 `execSync` calls replaced with `execFileSync` + argument arrays (1Password, Bitwarden, Vault/curl, AWS, Azure).
- **H-03**: macro-executor.ts — `exec()` replaced with `execFile()` + `parseCommand()` tokenizer for safe argument splitting.
- **H-04**: keepass-bridge.ts — `execSync('keepassxc-cli ${args}')` replaced with `execFileSync('keepassxc-cli', args)`.
- **H-06**: script-engine.ts — `new Function()` replaced with isolated Worker thread + `vm.createContext()` sandbox. `validateScript` uses `vm.compileFunction()`. Script execution moved from renderer to main process via IPC.

## [0.1.0] - 2026-03-23

### Added
- Initial release with 107 features implemented from IMPLEMENTATION_PLAN.md.
- **Core**: Electron 34 + React 18 + TypeScript + Vite 6 + Tailwind v4.
- **Terminal**: xterm.js with WebGL renderer, fit addon, search, web links, zoom, paste warning, dangerous command detection, error pattern detection, Zmodem detection.
- **SSH**: ssh2 pure-JS client with key auth, password, FIDO2, keyboard-interactive, host key verification, agent forwarding, TOTP auto-inject.
- **Connections**: SQLite + Drizzle ORM. Groups, favorites, recents, quick connect, SSH config import, Ansible inventory import, Terraform state import.
- **Clusters**: Cluster manager, PCC bar with syntax highlighting, broadcast to panes/all-tabs.
- **Terminal Management**: Tabs, split panes (horizontal/vertical), maximize pane, detach to window with PTY proxy, SFTP side panel.
- **Automation**: Expect engine (regex state machine), macro executor, variable engine (<IP>, <ENV:>, <GV:>, <ASK:>, <CMD:>), script engine (JavaScript), remote commands (Asbru-style), snippets browser (43 DevOps commands), runbooks (markdown + executable code blocks).
- **Security**: Credential store (safeStorage + base64 fallback), audit logging (JSON Lines, 30-day rotation), session recording (asciicast v2), secret redaction (13 patterns), known hosts management.
- **AI Assistant**: Multi-provider LLM (Ollama, OpenRouter, OpenAI, DeepSeek). Streaming responses. Fallback command suggestion library. Command explanation.
- **Integrations**: 1Password, Bitwarden, KeePassXC, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault. Cloud discovery (AWS, GCP, Azure, Docker, K8s, Podman).
- **Protocols**: SSH, Mosh, RDP (xfreerdp), VNC, Telnet, FTP, SSM, TN3270, WebDAV.
- **Settings**: 9 tabs (Terminal, AI, SSH, Security, Language, Network, KeePass, Sync, Plugins). 50+ color schemes. Per-connection terminal styles. Font picker. Plugin extension API.
- **Design System**: Spectral Command — rainbow gradient focus indicators, tonal background shifts, ghost borders, JetBrains Mono / Inter typography.
- **Packaging**: AppImage, deb, rpm via electron-builder.

### Security (initial audit — 7 of 11 critical/high fixed)
- C-01: Variable engine CMD injection → execFileSync
- C-02: Ping injection → execFile + host validation
- C-04: Plugin manager → execFileSync + name validation
- H-01: TOTP one-time-use (delete after first injection)
- H-02: AI prompt sanitization (strip control chars, limit length)
- H-05: Git config sync → execFileSync
- H-07: Script path traversal → safePath() validation
