# Infrastructure Discovery

## Purpose

Discover and import remote targets from cloud providers, container/orchestration runtimes,
and infrastructure-as-code sources, turning them into Bifrost connections. Implemented in
`src/main/services/cloud-discovery.ts`.

## Requirements

### Requirement: Cloud Provider Discovery

The system SHALL discover instances from AWS EC2, GCP, and Azure using the respective CLI
tools and present them as importable connections.

#### Scenario: Discover AWS EC2

- **WHEN** a user runs AWS discovery
- **THEN** the system lists EC2 instances via `describe-instances` as importable targets

#### Scenario: Discover GCP and Azure

- **WHEN** a user runs GCP or Azure discovery
- **THEN** the system lists instances via `gcloud instances list` / `az vm list`

### Requirement: Container and Orchestration Discovery

The system SHALL discover and open exec sessions into Docker containers, Podman
containers, Kubernetes pods, and AWS SSM-managed instances.

#### Scenario: Exec into a container

- **WHEN** a user selects a discovered Docker or Podman container
- **THEN** the system opens an interactive exec session into it

#### Scenario: Exec into a pod

- **WHEN** a user selects a discovered Kubernetes pod
- **THEN** the system opens a `kubectl exec` session into it

#### Scenario: AWS SSM session

- **WHEN** a user selects an SSM-managed instance
- **THEN** the system starts an SSM session to it

### Requirement: Inventory Import from IaC and Config

The system SHALL import targets from Ansible inventories (INI and YAML), Terraform state
(`.tfstate`), and the user's `~/.ssh/config`.

#### Scenario: Import Ansible inventory

- **WHEN** a user imports an Ansible inventory file
- **THEN** its hosts are parsed into importable connections

#### Scenario: Import from ssh config

- **WHEN** a user imports `~/.ssh/config`
- **THEN** its Host entries are parsed into importable connections
