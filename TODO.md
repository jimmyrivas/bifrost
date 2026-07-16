# TODO

Running list of work that still needs attention. Keep it honest.

## GUI verification pending (shipped in v0.3.4, not yet hands-on verified)

These features are implemented, type-checked, linted, and unit-tested, and their
UI → IPC → main paths exist — but they have **not** had a dedicated manual GUI
pass. Treat them as beta until checked on a real setup. (Phases 1, 2, and 5.3/
5.4/5.5, plus the SFTP panel polish, WERE GUI-verified.)

- [ ] **Import / Export panel** (Settings → Import/Export): ssh-config, Ansible,
      Terraform, JSON round-trips.
- [ ] **Cloud discovery panel** (Settings → Discovery): provider scans + import.
- [ ] **System tray** connections list + click-to-open.
- [ ] **Clusters** (Clusters view): create/auto-cluster, "Open cluster" opens
      member tabs + enables all-tabs broadcast.
- [ ] **Expect automation** (connection editor → EXPECT tab): rules auto-firing
      on a live SSH session (watch mode).
- [ ] **Password managers** (Settings → Secret Managers): detection panel;
      per-connection `op://` reference resolving at connect (needs `op` CLI).
- [ ] **SSH CA** panel: local-CA (`ssh-keygen`) and Vault signing.
- [ ] **FIDO2**: Generate sk-key / Detect type buttons in the connection editor.
- [ ] **Auto-save session logs**: transcript auto-started on connect for
      connections with the option enabled.
- [ ] **Combine tabs**: per-pane `connectionId` preserved after merging.

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
