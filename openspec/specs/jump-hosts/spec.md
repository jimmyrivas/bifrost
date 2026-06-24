# Jump Hosts

## Purpose

Reach targets that are only accessible through one or more intermediate hosts
(ProxyJump / bastion chains), for SSH sessions, Mosh, and tunnels. Implemented in
`src/main/services/jump-host/` (`chain.ts`, `mosh.ts`, `resolver.ts`, `runtime.ts`,
`seal.ts`).

## Requirements

### Requirement: ProxyJump Chains

The system SHALL connect to a target through an ordered chain of one or more jump hosts,
resolving each hop's connection settings.

#### Scenario: Single bastion

- **WHEN** a connection specifies one jump host
- **THEN** the system establishes the session to the target through that bastion

#### Scenario: Multi-hop chain

- **WHEN** a connection specifies multiple jump hosts in order
- **THEN** the system chains through each hop to reach the target

### Requirement: Jump Host Resolution

The system SHALL resolve jump host references to concrete connection settings, including
credentials and host-key trust for each hop.

#### Scenario: Resolve referenced jump host

- **WHEN** a connection references another saved connection as its jump host
- **THEN** the referenced connection's settings are used for that hop

### Requirement: Jump Support Across Transports

The system SHALL apply jump-host chains to SSH shells, Mosh sessions, and port-forwarding
tunnels.

#### Scenario: Mosh through a jump host

- **WHEN** a Mosh connection specifies a jump host
- **THEN** the Mosh session is established through the jump host chain

#### Scenario: Tunnel through a jump host

- **WHEN** a tunnel's target is only reachable via a bastion
- **THEN** the forward is established through the jump host chain
