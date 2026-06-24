# Clusters

## Purpose

Group connections into clusters and operate on all members at once — opening sessions and
broadcasting input across the group. Backed by the `clusters` and `clusterMembers` tables
and `cluster-manager.ts`.

## Requirements

### Requirement: Cluster Membership

The system SHALL let users create clusters and assign connections as members.

#### Scenario: Add a member

- **WHEN** a user adds a connection to a cluster
- **THEN** the membership is persisted in `clusterMembers`

### Requirement: Open Cluster Sessions

The system SHALL open a session for every member of a cluster in one action.

#### Scenario: Open all cluster members

- **WHEN** a user opens a cluster
- **THEN** the system opens a session for each member connection

### Requirement: Cluster Broadcast

The system SHALL broadcast input to all sessions opened for a cluster's members.

#### Scenario: Broadcast across a cluster

- **WHEN** a user types with cluster broadcast active
- **THEN** the input is sent to every member session of that cluster
