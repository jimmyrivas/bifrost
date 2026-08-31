# TODO

Running list of work that still needs attention. Keep it honest.

## GUI verification — DONE (all items verified 2026-08-30/31, fixes in v0.3.5)

All items below were verified hands-on. Several uncovered real bugs that were
fixed and shipped in v0.3.5 (see CHANGELOG). Kept here as a record.

- [x] **Import / Export panel** (Settings → Import/Export): ssh-config, Ansible,
      Terraform, JSON round-trips. — GUI-verified 2026-07-16.
- [x] **Cloud discovery panel** (Settings → Discovery): provider scans + import. — GUI-verified 2026-07-16.
- [x] **System tray** connections list + click-to-open. — GUI-verified 2026-08-30;
      fixed a real packaging bug: the tray icon (buildResources, not shipped) never
      reached runtime, so the tray was invisible on KDE/Wayland — now shipped via
      extraResources + passed as a real file path to Tray.
- [x] **Clusters** (Clusters view): create/auto-cluster, "Open cluster" opens
      member tabs + enables all-tabs broadcast. — GUI-verified 2026-08-30. Fixed 2
      PCC-broadcast-bar bugs: invisible typed text (opaque textarea bg covered the
      highlight overlay) and commands not executing (Send didn't append a newline;
      also only routed ssh: — now uses writeToSession).
- [x] **Expect automation** (connection editor → EXPECT tab): rules auto-firing
      on a live SSH session (watch mode). — GUI-verified 2026-08-30.
- [x] **Password managers** (Settings → Secret Managers): detection panel
      verified 2026-08-30 (KeePassXC detected). Per-connection `op://` reference
      resolve-at-connect NOT tested (needs the 1Password `op` CLI) — see deferred:
      it's 1Password-only for now.
- [x] **SSH CA** panel: local-CA (`ssh-keygen`) signing verified 2026-08-30;
      Vault signing not tested (needs the `vault` CLI + server).
- [x] **FIDO2**: Generate sk-key / Detect type buttons — UI verified 2026-08-30
      (honest ssh-agent copy shown, buttons respond); real sk-key generation NOT
      tested (no physical security key available).
- [x] **Auto-save session logs**: transcript auto-started on connect for
      connections with the option enabled. — GUI-verified 2026-08-30 (log written
      to ~/.config/bifrost/session-logs/ with the session transcript).
- [x] **Combine tabs**: per-pane `connectionId` preserved after merging. —
      GUI-verified 2026-08-30. Fixed 4 real bugs uncovered during verification:
      (1) split panes didn't close/reflow when their process exited
      (closePaneByTerminalId); (2) combine remounted panes as fresh local shells,
      losing SSH servers (now adopt live sessions + detaching guard so unmount
      doesn't disconnect); (3) explode had the same loss (same fix); (4) escape-
      sequence garbage (OSC color / DSR / DA query replies) leaked onto the prompt
      after adoption (stripReplayQueries on the replayed buffer).

## Known deferred / future work

- [ ] Custom **keybindings** remapping is saved but not applied yet (editor is a
      reference only).
- [ ] Password-manager references beyond 1Password (Bitwarden / Vault / AWS SM /
      Azure KV are detected + in the backend but not wired to the connect path).
- [ ] Per-connection SSH **agent forwarding** and **HTTP proxy** (saved by the
      form, not consumed by the connect path).
- [ ] SFTP **chmod** editing and a dual-pane local/remote browser.
- [ ] **Zmodem** in-terminal transfers (detection + SFTP redirect only today).
- [ ] Protocol launchers without a form entry: FTP, TN3270, WebDAV, AWS SSM.
- [ ] Windows/macOS support (see `docs/WINDOWS_COMPAT_PLAN.md`).
