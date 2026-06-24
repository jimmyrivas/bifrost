# Port Forwarding

## Purpose

Create and manage SSH port-forwarding tunnels (local, remote, and dynamic) tied to
connections, including tunnels that auto-start. Backed by the `tunnels` table and
forwarding methods in `ssh-manager.ts`.

## Requirements

### Requirement: Tunnel Types

The system SHALL support local forwards, remote forwards, and dynamic (SOCKS) forwards.

#### Scenario: Local forward

- **WHEN** a user creates a local forward from a local port to a remote address/port
- **THEN** connections to the local port are tunneled to the remote address

#### Scenario: Remote forward

- **WHEN** a user creates a remote forward
- **THEN** connections to the remote port are tunneled back to the specified local address

### Requirement: Tunnel Lifecycle Management

The system SHALL persist tunnel definitions, let users start and stop them, and report
their status.

#### Scenario: Start a tunnel

- **WHEN** a user starts a saved tunnel
- **THEN** the forward is established and its status reflects "active"

#### Scenario: Stop a tunnel

- **WHEN** a user stops an active tunnel
- **THEN** the forward is torn down and its status reflects "stopped"

### Requirement: Auto-Start Tunnels

The system SHALL automatically start tunnels marked for auto-start when the app launches.

#### Scenario: Auto-tunnel on launch

- **WHEN** the app starts and a tunnel is marked auto-start
- **THEN** the system establishes that tunnel without user action
