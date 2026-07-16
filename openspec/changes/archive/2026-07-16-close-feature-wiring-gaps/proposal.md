## Why

The 2026-07-10 four-agent code audit showed that a large set of capabilities is
fully implemented in the main process but unreachable from the UI, plus a
handful of features that look wired but silently do nothing (recording writes
header-only casts, connection hooks are saved but never executed, tab reattach
emits an event nobody listens to). The public README now discloses all of this
under "Built in the backend, UI pending" and "Known limitations" — this change
is the phased plan to burn that list down so the disclosures can be deleted.

## What Changes

- **Phase 1 — Trust traps** (features that pretend to work): feed real data
  into session recordings, execute pre/post-connection hooks, fix tab
  reattach, wire find/clear/reset/save-log terminal actions, persist the
  secret-redaction preference, implement or hide dynamic (SOCKS) tunnels.
- **Phase 2 — Protocol routing & SSH options**: route non-SSH connection
  methods (RDP, VNC, Telnet, FTP, AWS SSM, custom command) from the terminal
  hook to their existing launchers instead of falling through to SSH; make
  `ssh:connect` consume the saved SSH options (X11, agent forwarding,
  algorithms, HTTP proxy).
- **Phase 3 — Import & discovery UI**: menu/dialog surfaces for the existing
  ssh-config/Ansible/Terraform/JSON import handlers and a discovery panel over
  the existing AWS/GCP/Azure/Docker/Podman/K8s scanners.
- **Phase 4 — Automation surfaces**: wire the expect engine to live SSH
  streams with a working rules editor, connect the clusters panel to its real
  backend, expose global variables and macros in preload and give each a
  functional editor.
- **Phase 5 — Secrets integrations**: settings UI + connect-path usage for
  external password managers, minimal SSH-CA UI, vault re-encryption button;
  complete or remove the write-only DB-encryption path.
- **Phase 6 — Polish**: honest FIDO2 copy, keybindings editor that actually
  overrides shortcuts (or is removed), tray menus fed with real connections,
  session file logging wired, quake terminal registered or deleted, SFTP
  rename button.
- After each phase: move the corresponding README (EN/ES) entries out of
  "pending/limitations" into Features.

## Capabilities

### New Capabilities

<!-- none — every gap is already described by an existing capability spec -->

### Modified Capabilities

- `terminal-ui`: gains requirements for in-terminal search and clear/reset
  actions (currently rendered as menu items but unspecified and unwired).

Note: most phases make the implementation catch up to requirements the
existing specs already state (alternative-protocols, ssh-connectivity,
infrastructure-discovery, secrets-management, automation, clusters,
session-observability, variable-expansion) — those specs need no deltas.

## Impact

- Renderer: `useTerminal.ts` (protocol branch, terminal action listeners),
  `TerminalContextMenu.tsx`, `App.tsx`/`AppShell.tsx` (reattach listener,
  import/discovery views), `ClusterManagerUI`, `VariableManager`,
  `MacroEditor`, `ExpectEditor`, Preferences panels.
- Preload: expose the currently-missing namespaces (cluster, macros, global
  variables, expect create/start/feed) — additive only.
- Main: `ssh.ipc.ts` (consume sshConfig.options, run exec-command hooks, feed
  recordings), `tunnels.ipc.ts` (SOCKS), `index.ts` (tray feed, quake).
- No schema migrations expected; all DB tables already exist.
