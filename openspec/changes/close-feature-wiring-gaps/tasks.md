## 1. Phase 1 — Trust traps (features that pretend to work)

- [x] 1.1 Session recording: call `feedRecording(sessionId, data)` from the shell `stream.on('data')` handler in `ssh.ipc.ts` so `.cast` files contain real asciicast events; verify a recorded file plays in `asciinema`. — feeds both output (shell `data`) and input (`ssh:write`); no-ops unless a recording is active.
- [x] 1.2 Pre/post-connection hooks: execute stored `execCommands` (phase `pre` on connect, `post` on disconnect) via `macro-executor.executeExecCommands` from `ssh.ipc.ts`, honoring `ask: true` with a confirmation prompt; audit-log each execution. — `ask:true` uses the existing native `dialog.showMessageBox` confirm (already wired end-to-end for exec commands) rather than a new renderer round-trip; each run audit-logged executed/skipped/error.
- [x] 1.3 Tab reattach: subscribe to `window.onTabReattached` in `App.tsx`, recreate the tab (title, connectionId, terminal id) and reclaim ownership; verify detach → reattach round-trip keeps the live session. — full adopt path added: `adoptSessionId` threads store→TerminalPane→XTerminal→`useTerminal.adoptSession`, which `transferOwnership` + `getBuffer` replay + binds I/O to the live SSH/PTY session (no reconnect, no orphan).
- [x] 1.4 Find in Terminal: wire the search bar to the already-loaded `SearchAddon` (`findNext`/`findPrevious`, highlight, Esc clears); listener on the pane element for `terminal:search`/`terminal:search-next`.
- [x] 1.5 Clear/Reset/Save-log: add pane-element listeners for `terminal:clear`, `terminal:reset`, `terminal:save-log` in `XTerminal`/`useTerminal`; Save-log calls `system.startLogging` with the connection's `logPattern`.
- [x] 1.6 Secret redaction: persist the toggle in preferences (load on startup) instead of in-memory module state. — persisted via the renderer `preferences` persist store (key `secretRedactionEnabled`), mirroring other terminal toggles; default remains off.
- [x] 1.7 Dynamic (SOCKS) tunnels: implement a per-tunnel SOCKS5 listener backed by `client.forwardOut`, or hide the Dynamic option in TunnelManager until it exists — no stub messages. — IMPLEMENTED: real SOCKS5 (RFC 1928, no-auth, CONNECT, IPv4/domain/IPv6) via Node `net` + `forwardOut`, integrated with start/stop/list/auto-start.
- [x] 1.8 Run typecheck/lint/tests; update README EN/ES: remove resolved items from "Known limitations". — typecheck/lint(0 errors)/tests(316 pass) green; user GUI-verified on a second machine (2026-07-11); README EN/ES updated (recording/logs/hooks/reattach/find/SOCKS/redaction moved to Features, dead Ctrl+K-chord claim removed, docs/guide linked). Phase 1 additionally shipped: capture UX (Recordings manager, capture store, REC status-bar indicator, tab badges, Preferences → Session Capture), context-menu redesign (grouped submenus, open-time re-evaluation), Ctrl+Shift+F find binding, session-log feeds for local/mosh PTYs, auto-finalize of captures on session close, and the portable Docker AppImage build (host glibc 2.43 made host-built AppImages non-portable).

## 2. Phase 2 — Protocol routing & SSH options plumb-through

- [x] 2.1 Route non-SSH methods in `useTerminal.initConnection`: `rdp`/`vnc` → `protocols.connectRDP/connectVNC` (session tracked by id; stored RDP options + vault password passed so xfreerdp doesn't prompt on a piped stdin; client output/exit shown in the pane), `telnet`/`ftp`/`ssm` → PTY/socket launchers on the same data path as mosh (shared `wirePtyBackedProtocol`, initial PTY size sync), `custom`/`local` → `terminal.create` (custom command now persisted in sshConfig JSON — ConnectionForm saves/loads `customCommand` and `rdp` options). Cleanup disconnects every `protocols.*` session on tab close (was leaked for mosh). TN3270/WebDAV remain backend-only (not offered by the form); FTP/SSM route correctly for imported/discovered connections.
- [x] 2.2 Launcher availability errors (missing xfreerdp/vncviewer/lftp/aws/mosh) surface as a global toast with a per-protocol install hint (`ToastHost` in App.tsx via `app:toast` CustomEvent; hints in `lib/protocol-dispatch.ts`), plus the same hint inline in the pane. VNC's synchronous "no viewer found" error is caught by registering the error listener before connect (prefix match until the session id is known).
- [x] 2.3 Parse `sshConfig.options` in `ssh:connect` via `services/ssh-options.ts` into typed config: `algorithms` (Ciphers/MACs/KexAlgorithms/HostKeyAlgorithms) + `x11Forward` — both already consumed by ssh-manager; empty/invalid → absent. Agent forwarding + `httpProxy` intentionally NOT surfaced (connect path doesn't consume them — would be inert).
- [~] 2.4 HTTP proxy field: DEFERRED — ssh-manager doesn't consume `httpProxy` yet, so a form field would be an inert control. Kept honest in README pending until the connect path wires HTTP CONNECT.
- [x] 2.5 Unit tests for the options parser (`ssh-options.test.ts`, 6 cases; 335 total). Method dispatch verified by GUI. README EN/ES: RDP/VNC/Telnet/Custom + ciphers/KEX/MAC/X11 → Features; agent-forward/HTTP-proxy + FTP/SSM/3270/WebDAV kept honest in pending.

## 3. Phase 3 — Import/export & discovery UI

- [x] 3.1 Add an Import/Export section (Settings → Import / Export): ssh-config import (preview → apply), Ansible inventory (preview → apply), Terraform state (file-pick → build connections), JSON export/import. New `ImportExportPanel.tsx` wires the existing `import.*` handlers + `discovery.terraform`; a shared `SelectTable` + `usePreview` hook drive the preview/select/apply flow; store refresh + success/error toasts. (Surface is Settings, not a native app menu — kept scoped.)
- [x] 3.2 Discovery panel (Settings → Discovery): provider grid (AWS/GCP/Azure/Docker/Podman/K8s) gated by `discovery.available` (CLI-name → provider mapping), per-provider scan, accumulated results table with multi-select, "Import as connections" via `connections:create`. New `DiscoveryPanel.tsx`.
- [x] 3.3 Feed the tray: renderer pushes the connection list (with favorites/recents, which live in localStorage) via a new `tray:update` IPC (system.ipc → `trayManager.updateConnections`), pushed from `AppShell` on every store change through `useConnectionsStore.subscribe`; `trayManager.create(cb)` now receives a connect callback that shows the window + sends `tray:open-connection`, which `AppShell` opens via `handleConnectSSH`. New preload `tray` namespace.
- [x] 3.4 Tests + README: pure mappers extracted to `lib/discovery-import.ts` (discovered/terraform host → connection, connections → tray entries) with `discovery-import.test.ts` (7 cases, 349 total). README EN/ES: import/export + discovery + tray moved to Features. `success` toast variant added.

## 4. Phase 4 — Automation surfaces (expect, clusters, variables, macros)

- [ ] 4.1 Preload: expose `cluster.*`, `macros.*`, `variables.*`, and `expect.create/start/stop/feed` namespaces (additive, mirroring existing IPC names).
- [ ] 4.2 Expect: per-connection rules editor (new tab or panel backed by `expectRules` table), feed live SSH output through `expect:feed`, wire debug mode; remove the dead `ExpectEditor` mockup props.
- [ ] 4.3 Clusters: connect `ClusterManagerUI` to the real backend — persistent CRUD, member picker, "open cluster" opens all member sessions, cluster broadcast via `cluster:broadcastInput`.
- [ ] 4.4 Global variables: make `VariableManager` a real editor over `variables:listGlobal/setGlobal/deleteGlobal` (with `isPassword` masking); document `<GV:>` usage in the panel.
- [ ] 4.5 Macros: render `MacroEditor` (Automation view), CRUD via `macros:*`, run from the terminal context menu with confirm flag.
- [ ] 4.6 Tests + README: move expect/clusters/variables/macros out of pending.

## 5. Phase 5 — Secrets integrations

- [ ] 5.1 Password managers settings panel: availability detection per manager, credential reference field on connections (e.g. `op://…`), resolved at connect time; wire KeePass "Test Connection".
- [ ] 5.2 SSH CA: minimal panel — pick Vault role or local CA key, sign the connection's public key, store cert path.
- [ ] 5.3 Vault re-encryption: Settings button calling `credentials:changeVaultPassword` with progress/result feedback.
- [ ] 5.4 File secret storage: use stored `encryptedKeyContent` in the connect path when the key file is absent; UI affordance to store a key into the vault.
- [ ] 5.5 DB encryption: decide — implement decrypt-on-startup (passphrase prompt) or remove the Settings switch and the orphaned handlers.
- [ ] 5.6 Tests + README updates.

## 6. Phase 6 — Polish & honesty debt

- [ ] 6.1 FIDO2: honest UI copy (works via ssh-agent resident keys only) and wire `detectFido2Key`/`generateFido2Key` buttons, or drop the tab until sk-key auth lands.
- [ ] 6.2 Keybindings: apply user overrides from the editor to the real shortcut handling, or remove the editor.
- [ ] 6.3 Quake terminal: register `QuakeTerminal` + a real `#/quake` route with a preference toggle, or delete the dead class.
- [ ] 6.4 Auto session logging: honor per-connection `autoSaveLog`/`logPattern` on connect (uses 1.5 wiring).
- [ ] 6.5 SFTP: add Rename to the panel (backend exists); file issue for chmod/dual-pane.
- [ ] 6.6 Combine-tabs: preserve each pane's `connectionId` when merging.
- [ ] 6.7 Keyboard pane-resize: implement the `terminal:pane-resize` listener over `react-resizable-panels` or remove the hotkeys.
- [ ] 6.8 Full suite + lint green; final README/README.es sweep — delete emptied "pending/limitations" entries; openspec validate --strict.
