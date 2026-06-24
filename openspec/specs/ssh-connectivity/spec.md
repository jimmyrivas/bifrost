# SSH Connectivity

## Purpose

Establish and maintain SSH connections and interactive shells using the pure-JS `ssh2`
library, including authentication, host-key trust, algorithm negotiation, forwarding,
connection reuse, and resilience. Implemented primarily in
`src/main/services/ssh-manager.ts`.

## Requirements

### Requirement: SSH Authentication Methods

The system SHALL authenticate using SSH private keys (with home-directory `~` expansion
and passphrase support), passwords, keyboard-interactive (MFA/2FA), and SHALL fall back
to the SSH agent when configured. Authentication errors SHALL produce actionable,
method-aware messages.

#### Scenario: Key-based authentication

- **WHEN** a connection specifies a private key path containing `~`
- **THEN** the path is expanded to the user's home directory before the key is loaded

#### Scenario: Agent fallback

- **WHEN** key and password authentication are unavailable but an SSH agent is configured
- **THEN** the system attempts authentication via the agent

#### Scenario: Multi-factor prompt

- **WHEN** the server requests keyboard-interactive authentication
- **THEN** the system prompts the user for each challenge and submits the responses

#### Scenario: Actionable failure message

- **WHEN** all configured authentication methods fail
- **THEN** the error SHALL name the methods attempted and suggest debugging steps

### Requirement: Host Key Verification (TOFU)

The system SHALL verify host keys on a trust-on-first-use basis using SHA-256
fingerprints, persist trusted keys in `known_hosts.json`, and let users manage stored
keys.

#### Scenario: First connection to a new host

- **WHEN** a user connects to a host whose key is not yet stored
- **THEN** the system shows the SHA-256 fingerprint and asks the user to confirm trust

#### Scenario: Changed host key

- **WHEN** a stored host key no longer matches the server's presented key
- **THEN** the system SHALL warn of a possible mismatch and SHALL NOT connect silently

#### Scenario: Remove a stored host key

- **WHEN** a user removes a host key entry
- **THEN** it is deleted from `known_hosts.json` and re-verified on next connect

### Requirement: Algorithm and Forwarding Options

The system SHALL allow per-connection selection of cipher/kex/host-key algorithms, X11
forwarding, SSH agent forwarding, and connecting through an HTTP proxy.

#### Scenario: Custom algorithms

- **WHEN** a connection specifies non-default algorithms
- **THEN** the system negotiates the SSH session using those algorithms

#### Scenario: Connect via HTTP proxy

- **WHEN** a connection is configured with an HTTP proxy
- **THEN** the SSH transport is tunneled through that proxy

### Requirement: Session Reuse and Multiplexing

The system SHALL share a single underlying SSH connection across consumers that target
the same host, tracking a usage count so the connection is closed only when the last
consumer releases it.

#### Scenario: Acquire and release

- **WHEN** a second feature requests a session to a host that is already connected
- **THEN** the existing connection is reused and its usage count is incremented

#### Scenario: Last release closes

- **WHEN** the final consumer releases a shared session
- **THEN** the underlying SSH connection is closed

### Requirement: Auto-Reconnect

The system SHALL automatically attempt to reconnect a dropped SSH session using
exponential backoff (3s to 60s) for up to 50 attempts.

#### Scenario: Transient drop recovers

- **WHEN** an SSH session drops unexpectedly
- **THEN** the system retries with increasing backoff and restores the session on success

#### Scenario: Give up after max attempts

- **WHEN** reconnection fails 50 consecutive times
- **THEN** the system stops retrying and reports the session as disconnected
