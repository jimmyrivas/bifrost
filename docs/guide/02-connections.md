[← Guide index](README.md)

# Managing connections

The connection tree in the sidebar is Bifrost's system of record: every session, tunnel, and automation feature reads from it. This chapter covers creating and organizing connections, templates, workspaces, notes, statistics, stored credentials, TOTP, variables, and syncing your configuration via git.

## Creating a connection

Click the new-connection button in the sidebar (or use the command palette) to open the connection form. Fill in at least a **name** and **host**; **port** and **user** as needed, then save. The connection appears in the tree, and the form validates required fields before persisting anything.

> **Connection methods:** the form's protocol dropdown lists several methods, but **only SSH and Mosh connect today**. RDP, VNC, Telnet, and the rest are visible in the form and will be wired to their (already built) backend launchers in a future release — selecting them does nothing useful yet. See [SSH, Mosh & jump hosts](04-ssh.md).

To edit later, right-click the connection → **Edit Connection**. To delete, use the same context menu.

## Groups and the tree

Connections are organized into **hierarchical groups** (folders inside folders), which is how Bifrost stays usable with hundreds of targets.

- Create sub-groups under any existing group; nesting persists.
- Right-click a group → **Open All Connections** to open a session for every connection in that group and its subgroups.
- **Tag badges** show each connection's tags directly in the tree.

## Favorites, recents, and search

- Toggle **Add to Favorites** from a connection's context menu (or the star) — favorites get their own section and the state persists.
- The **Recent** section lists the last 10 connections you opened, with timestamps.
- The **live search** box filters the tree as you type — it matches names and **tags** too.

## Clone and templates

- Right-click a connection → **Clone Connection** to create a copy with identical settings and an editable name.
- Right-click → **Save as Template** to store a connection's settings as a reusable template.
- When creating a new connection, the **From Template…** dropdown at the top of the form prefills it from any saved template.

## Workspaces

Workspaces are **named connection filters** that scope the sidebar to what you're working on right now. Create one from the workspace selector in the navbar, choose which connections belong to it, and switch between workspaces to swap the whole sidebar view. The full tree is always one switch away.

## Per-connection notes

Bifrost keeps a notes log tied to connections:

- In a session, select terminal output, right-click → **Save as Note** and pick a tag: **note**, **evidence**, **command**, or **error**.
- Open the **Notes** view in the sidebar to browse everything: full-text **search**, filtering by tag, copy to clipboard, and delete. Each note shows which connection (or tab) it came from.

## Statistics and health

- Each connection in the tree shows a **health dot**: green (reachable), red (unreachable), or gray (unknown), refreshed by a periodic ping. Hover it for host/port/protocol details.
- Open **Edit Connection** to see the connection's **statistics** — total connects, last connected, and accumulated session time — derived from the append-only audit log.

## Wake-on-LAN

If a connection has a **MAC address** configured in its form, you can right-click it → **Wake On LAN** to broadcast a magic packet to that host. Without a MAC address the action has nothing to send.

## Stored credentials

- Passwords and key passphrases you save are **encrypted with the OS keychain** (Electron `safeStorage`).
- On Linux **without a keyring** (gnome-keyring/kwallet), Bifrost falls back to obfuscated (base64) storage and warns you — install a keyring for real encryption.
- When you edit a connection that has a stored password, the field is **prefilled masked** (dots) with an eye toggle to reveal it.
- **Clearing a prefilled credential field and saving deletes the stored value** from the vault. (Bifrost guards against accidental deletion: a save that happens before the stored value finished loading leaves the vault untouched.)

## TOTP / 2FA

You can store a **Base32 TOTP secret** per connection. When a verification-code prompt appears during a session, Bifrost computes the current code and **auto-types it** for you.

## Variables in tab titles and remote commands

Tab titles and remote commands expand placeholder variables at the point of use:

| Token | Expands to |
| --- | --- |
| `<IP>` | The connection's host |
| `<PORT>` | The connection's port |
| `<USER>` | The connection's username |
| `<NAME>` | The connection's name |
| `<ENV:name>` | An environment variable |
| `<GV:name>` | A global variable (see note below) |
| `<DATE_Y>` `<DATE_M>` `<DATE_D>` | Current year / month / day |
| `<TIME_H>` `<TIME_M>` `<TIME_S>` | Current hour / minute / second |
| `<TIMESTAMP>` | Current Unix timestamp |

> **Global variables:** the `<GV:name>` resolver works, but there is **no UI to define global variables yet** — a value only resolves if it already exists in Bifrost's database (for example, brought in by an imported configuration). Until the editor ships, prefer `<ENV:name>`.

## Config sync via git

Settings → **Git Config Sync** lets you keep your connection inventory in a git repository you point it at:

1. Enter the **repository path** (a local clone).
2. Use **Export** to write your connections there, **Import** to load new ones from it, or **Sync** to do both.

Connections are exported **without passwords or private keys** — credentials stay in your local vault.

## Not available yet

- **Import** from `~/.ssh/config`, Ansible inventories, Terraform state, or JSON files (the parsers exist in the backend; no UI reaches them).
- **Cloud discovery** (AWS EC2, GCP, Azure, Docker, Podman, Kubernetes) — scanners are built, but there is no panel.
- **External password managers** (1Password, Bitwarden, HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, KeePassXC).
- **Advanced per-connection SSH options** (X11 forwarding, agent forwarding, cipher/KEX/MAC selection, HTTP proxy): the form saves them, but the connect path does not apply them yet.
- **Global variables editor** — see the note under Variables above.

> Source specs: `openspec/specs/connection-management/spec.md`, `openspec/specs/variable-expansion/spec.md` — documentation reflects the implementation as of v0.3.x.
