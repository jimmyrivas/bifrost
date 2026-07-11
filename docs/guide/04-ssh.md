[← Guide index](README.md)

# SSH, Mosh & jump hosts

This chapter covers how Bifrost reaches remote hosts: the connection methods that work today, authentication, host-key trust, 2FA, reconnection, and multi-hop jump chains.

## Connection methods

Two remote connection methods work today:

| Method | What it is | Notes |
|---|---|---|
| **SSH** | Built-in client (pure-JS `ssh2`), no external `ssh` binary needed | Full feature set: auth methods below, host-key verification, jump chains, tunnels, SFTP |
| **Mosh** | Mobile Shell — survives roaming and flaky links | Spawned via PTY using your system `mosh` client; jump chains supported |

The protocol dropdown in the connection form also lists RDP, VNC, and Telnet. **These do not connect yet** — backend launchers exist, but selecting them is not wired up. Stick to SSH and Mosh for now (see [Not available yet](#not-available-yet)).

### Mosh requirements

- `mosh` must be installed on **both** your machine (`mosh` client) and the server (`mosh-server`).
- UDP ports 60000–61000 (or your server's configured range) must be reachable.
- With a jump chain configured, the Mosh session is bootstrapped through the chain.
- Not available on Bifrost for Windows.

## Authentication

Pick an auth method on the **Basics** tab of the connection form ([chapter 2](02-connections.md)):

| Tab | Method | Details |
|---|---|---|
| PASSWORD | Username + password | Stored passwords are encrypted with the OS keychain |
| KEY FILE | Private key file | Path supports `~` expansion (e.g. `~/.ssh/id_ed25519`) |
| CERTIFICATE | Private key + passphrase | Passphrase is stored encrypted and applied when loading the key |
| HARDWARE KEY | FIDO2 security key | Works **only through your ssh-agent** — see the honest note below |

On top of whatever you configure:

- **SSH agent** — if `SSH_AUTH_SOCK` points to a running agent, Bifrost automatically offers agent-held keys as an additional auth source, mirroring what the system `ssh` command does.
- **Keyboard-interactive (MFA/2FA)** — when the server sends keyboard-interactive challenges (e.g. Duo, PAM OTP), each prompt is forwarded to you in a dialog and your answers are sent back.
- **Actionable failures** — if every method fails, the error names the methods that were attempted (e.g. `password, ssh-agent`) and suggests what to check, instead of a bare "authentication failed".

> **FIDO2 honesty note**: the bundled `ssh2` library cannot talk to `ed25519-sk` / `ecdsa-sk` key files directly (it cannot trigger the touch ceremony). A hardware-backed key works **only if your ssh-agent holds the resident key** (`ssh-add -K`), in which case Bifrost's automatic agent support picks it up.

## Host-key verification

Bifrost verifies host keys on a **trust-on-first-use (TOFU)** basis:

1. **First connection** to a host: a dialog shows the server's **SHA-256 fingerprint** and asks you to confirm before anything else happens. Compare it against a fingerprint you obtained out-of-band.
2. **Accepted keys** are persisted and checked on every subsequent connection.
3. **Changed key**: if the server presents a key that no longer matches the stored one, Bifrost warns you about a possible man-in-the-middle and **never connects silently**.

Manage stored keys in **Settings → Known Hosts**: the panel lists each trusted host with its fingerprint, and removing an entry forces re-verification on the next connect.

## TOTP / 2FA auto-type

You can store a **Base32 TOTP secret** per connection (Basics tab). When a verification-code prompt appears **in the session output**, Bifrost computes the current code and types it for you.

Note the scope: this fires on in-session prompts (e.g. a bank-style "Verification code:" after login, or a `sudo` OTP), **not** during the SSH handshake itself — handshake-time 2FA is handled by the keyboard-interactive flow above.

## Auto-reconnect

If an SSH session drops unexpectedly, Bifrost reconnects automatically:

- Exponential backoff: 3 s → 6 s → 12 s → 24 s → 48 s → capped at 60 s.
- Up to **50 attempts**, with the attempt counter shown in the terminal.
- After giving up, press **Enter** in the terminal to retry manually.

## Connection reuse

Internally, Bifrost keeps **one SSH connection per host** and shares it across consumers — your shell, the SFTP panel, and tunnels to the same host ride the same TCP/SSH session. The connection closes only when the last consumer releases it. You don't manage this; it just means opening SFTP next to an existing shell doesn't re-authenticate or create a second connection.

## Jump-host chains (ProxyJump)

To reach targets behind one or more bastions, open the **Routing** tab of the connection form (available for SSH and Mosh). The visual chain editor lets you:

- **Add hops** in order — traffic flows *your machine → hop 1 → hop 2 → … → target*, each hop an SSH-over-SSH tunnel to the next.
- **Reference a saved connection** as a hop — its host, credentials, and host-key trust are reused.
- **Define a hop inline** — host, port, username, and auth (password, key file, key + passphrase, or agent). Inline hop passwords are **encrypted at rest**.
- **Reorder** hops with the up/down arrows, remove them individually.

Jump chains apply to **SSH shells, Mosh sessions, and tunnels** (see [chapter 5](05-tunnels.md) for tunnels through bastions). Host keys are verified per hop, with the same TOFU flow as direct connections.

## Not available yet

Honest list of what you may see in the UI but should not rely on:

- **SSH options panel** (X11 forwarding, agent forwarding, `Ciphers`, `KexAlgorithms`, `MACs`, `HostKeyAlgorithms`, HTTP proxy): the connection form **saves** these fields, but the connect path **does not apply them yet**. Setting them has no effect on the session.
- **RDP, VNC, Telnet** appear in the protocol dropdown but do not connect; **FTP, TN3270, WebDAV, and AWS SSM** have backend launchers only. Today only **SSH and Mosh** connect.
- **FIDO2 sk-keys** cannot be used directly (see the note under Authentication) — agent-resident keys only.
- **SSH certificate-authority signing** (user certs signed by a CA) has no UI yet.

> Source specs: `openspec/specs/ssh-connectivity/spec.md`, `openspec/specs/jump-hosts/spec.md`, `openspec/specs/alternative-protocols/spec.md` — documentation reflects the implementation as of v0.3.x.
