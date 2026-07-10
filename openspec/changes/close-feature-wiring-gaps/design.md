## Context

The audit traced every unreachable feature to three chokepoints:

1. **`useTerminal.initConnection` branches only on `mosh`** — every other
   non-SSH method (rdp, vnc, telnet, ftp, ssm, custom) falls through to
   `ssh.connect`. The launchers in `external-protocol.ts` are complete and
   IPC-wired but have zero renderer callers.
2. **`ssh:connect` (ssh.ipc.ts:35-45) rebuilds the connect config from
   scratch** and drops `sshConfig.options`, so everything SshOptionsPanel
   saves (X11, ForwardAgent, ciphers/KEX/MACs/host keys) is stored but inert.
   The same handler never calls `feedRecording` or the exec-command hooks.
3. **Preload gaps / zero-caller namespaces** — `cluster`, `macros`, global
   `variables`, and `expect.create/start/feed` are not exposed;
   `import.*`, `discovery.*`, `sshCa.*`, `passwordManagers.*` are exposed but
   no component calls them.

Dead-event pattern: several context-menu items dispatch pane-level
CustomEvents (`terminal:search`, `terminal:clear`, `terminal:reset`,
`terminal:save-log`, `terminal:pane-resize`, `window:tabReattached`) that have
no listener. Only document-level events (`zoom-*`, `paste`, `paste-image`)
work today.

## Goals / Non-Goals

**Goals:**
- Every UI affordance either works end-to-end or is removed — no silent no-ops.
- Reuse the existing, tested main-process implementations; this is wiring
  work, not new engines.
- Keep phases independently shippable so the README pending/limitations lists
  shrink after every phase.

**Non-Goals:**
- Windows/macOS support, Ásbrú import, real ZMODEM, SFTP dual-pane — separate
  roadmap items with their own future changes.
- Rewriting engines that already work (expect engine, cloud scanners,
  password-manager services stay as-is).
- New DB schema.

## Decisions

- **Protocol routing** happens in `useTerminal.initConnection`: a
  `method → protocols.*` dispatch table. RDP/VNC open external clients (no
  xterm binding); Telnet/FTP/SSM/Mosh-style PTY-backed protocols bind their
  PTY id to the existing terminal data path. `custom` runs through
  `terminal.create` with the command as the shell.
- **SSH options plumb-through**: parse `sshConfig.options` once in
  `ssh:connect` into typed fields (`x11Forward`, `agentForward`, `algorithms`,
  `httpProxy`) rather than teaching ssh-manager to read the raw blob —
  ssh-manager already consumes those typed fields.
- **Hooks execution** lives in `ssh.ipc.ts` around connect/disconnect using
  the existing `macro-executor.executeExecCommands`; `ask: true` commands
  round-trip a renderer prompt via the existing keyboard-interactive bridge
  pattern.
- **Dead events → real listeners**: standardize on the pane-element CustomEvent
  contract; `XTerminal` registers the listeners next to where it already
  handles `terminal:paste`. SearchAddon is already loaded — wire
  `findNext/findPrevious` to the existing search bar.
- **Reattach**: subscribe once in `App.tsx` to `window.onTabReattached`,
  recreate the tab from the payload, and claim ownership via the same
  `transferOwnership` used by detach.
- **Dynamic SOCKS**: implement with a minimal SOCKS5 server per tunnel using
  `client.forwardOut` per CONNECT — if it exceeds the phase budget, hide the
  option from TunnelManager instead of shipping the stub.
- **Clusters/variables/macros/expect**: additive preload namespaces mirroring
  the existing IPC names; replace the mockup panels' local state with store
  calls — keep the visual design untouched.
- **DB encryption**: decide inside phase 5 — either implement decrypt-on-start
  (env passphrase prompt) or remove the Settings switch; the write-only state
  is the worst of both.

## Risks / Trade-offs

- Consuming `sshConfig.options` changes live connection behavior for existing
  saved connections (options that never applied suddenly apply). Mitigate:
  release note + treat unknown/invalid algorithm lists as absent.
- Protocol routing turns "silently wrong" (SSH attempt) into visible external
  spawns; missing client binaries must surface a clear toast (launchers
  already detect availability).
- Executing stored hooks is new remote side-effect surface — confirm `ask`
  prompts and audit-log each execution.
- Recording payloads grow files quickly; keep the existing rotation/size
  guards in session-recorder.
