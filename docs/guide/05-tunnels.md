[← Guide index](README.md)

# Port forwarding (tunnels)

Bifrost creates and manages SSH port-forwarding tunnels — local, remote, and dynamic (SOCKS5) — persisted as first-class objects you can start, stop, and auto-start, independent of any open terminal tab.

## The Tunnel Manager

Open **Tunnels** in the left sidebar. The manager shows every saved tunnel with its live status (active/stopped and uptime, refreshed every 5 seconds) plus **Start**, **Stop**, and **Stop All** controls.

A tunnel definition consists of:

| Field | Meaning |
|---|---|
| Name | Label shown in the list |
| Source | Either a **saved connection** (reuses its host, credentials, and jump chain resolution) or a **manually entered host** with its own credentials |
| Forwards | One or more forwards (a single tunnel can carry several) |
| Jump chain | Optional bastion chain, same editor as connections ([chapter 4](04-ssh.md#jump-host-chains-proxyjump)) |
| Auto-start | Start this tunnel automatically when Bifrost launches |

## Tunnel types

| Type | Direction | Fields |
|---|---|---|
| **Local** | `127.0.0.1:localPort` on your machine → `remoteHost:remotePort` as seen from the server | Local port, remote host, remote port |
| **Remote** | Port on the server → an address reachable from your machine | Local port, remote host, remote port |
| **Dynamic** | SOCKS5 proxy on `127.0.0.1:localPort` — destination chosen per request | Local port only |

### Local forward example

Database on `db.internal:5432`, only reachable from the SSH server: create a local forward `5432 → db.internal:5432`, start the tunnel, then point your client at `127.0.0.1:5432`.

### Dynamic (SOCKS5) forward

A dynamic forward runs a real SOCKS5 proxy bound to `127.0.0.1`, backed by the tunnel's SSH connection. Every TCP connection you send through it egresses from the SSH server. Supported: no-auth handshake, `CONNECT` command, IPv4, domain-name, and IPv6 destination addresses.

Use it from the command line:

```bash
curl --socks5 127.0.0.1:1080 http://internal-service.corp/
# or with remote DNS resolution:
curl --socks5-hostname 127.0.0.1:1080 http://internal-service.corp/
```

Or configure it as a browser/system SOCKS proxy (`127.0.0.1`, your chosen port) to browse an internal network through the SSH server.

## Lifecycle

- **Save** a definition; it persists across restarts.
- **Start** — the SSH connection is established (or reused, if one to that host already exists) and each forward comes up; status flips to active with an uptime counter.
- **Stop** — forwards are torn down; **Stop All** stops every active tunnel.
- **Auto-start** — tunnels flagged auto-start are established when the app launches, no user action needed.

## Per-tunnel credentials

Manual-host tunnels carry their own username and auth (password, key file, key + passphrase). Passwords and passphrases are **encrypted with the system keychain** when saved — the form shows only whether a stored password exists, never the value.

## Tunnels through jump hosts

If the tunnel's target is only reachable via a bastion, add a jump chain in the tunnel editor. The forward is then established through the chain, hop by hop — same behavior as SSH sessions ([chapter 4](04-ssh.md)).

## Security notes

- Local and dynamic listeners bind to **`127.0.0.1` only** — nothing on your LAN can reach your tunnels or SOCKS proxy.
- The SOCKS5 proxy accepts no-auth connections **by design**, precisely because it is localhost-only. Do not port-forward or otherwise expose it to other machines.

## Not available yet

Nothing major. Two deliberate scope limits on the SOCKS5 proxy:

- No SOCKS authentication (localhost-only by design, see above).
- `UDP ASSOCIATE` and `BIND` commands are unsupported — TCP `CONNECT` only, the same limitation as OpenSSH's `-D`.

> Source specs: `openspec/specs/port-forwarding/spec.md`, `openspec/specs/jump-hosts/spec.md`, `openspec/specs/ssh-connectivity/spec.md` — documentation reflects the implementation as of v0.3.x.
