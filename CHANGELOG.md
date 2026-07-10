# Changelog

All notable changes to Bifrost will be documented in this file.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
