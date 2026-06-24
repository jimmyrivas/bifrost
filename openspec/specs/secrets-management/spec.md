# Secrets Management

## Purpose

Store connection credentials securely and integrate with external secret stores and SSH
certificate authorities. Implemented in `src/main/services/credential-store.ts`,
`password-manager.ts`, and related TOTP/CA services.

## Requirements

### Requirement: Encrypted Credential Vault

The system SHALL store credentials using the OS keychain via `electron.safeStorage`, and
SHALL fall back to base64 encoding with a clear warning when no keyring is available.

#### Scenario: Store with keyring available

- **WHEN** `safeStorage` is available and a credential is saved
- **THEN** the credential is encrypted with the OS keychain

#### Scenario: Fallback without keyring

- **WHEN** no keyring is available on the host
- **THEN** the system stores the credential as base64 and SHALL warn that storage is not
  encrypted

### Requirement: File Secrets and Config Encryption

The system SHALL store SSH key files as secrets and SHALL support a vault password that
encrypts configuration using AES-256-GCM with a scrypt-derived key.

#### Scenario: Store a key file

- **WHEN** a user stores an SSH key file
- **THEN** it is persisted via the credential store and retrievable for authentication

#### Scenario: Change vault password

- **WHEN** a user changes the vault password
- **THEN** the system re-encrypts protected configuration under the new password

### Requirement: External Password Managers

The system SHALL retrieve secrets from 1Password CLI, Bitwarden CLI, HashiCorp Vault, AWS
Secrets Manager, and Azure Key Vault.

#### Scenario: Resolve from 1Password

- **WHEN** a connection references a 1Password item
- **THEN** the system retrieves the secret via the `op` CLI at connect time

#### Scenario: Resolve from a cloud secret store

- **WHEN** a connection references an AWS Secrets Manager or Azure Key Vault secret
- **THEN** the system retrieves it via the provider's API at connect time

### Requirement: SSH Certificate Authority and FIDO2

The system SHALL sign SSH keys via a certificate authority (HashiCorp Vault API or local
signing) and SHALL detect and generate FIDO2 (`ed25519-sk`) keys.

#### Scenario: Sign an SSH key

- **WHEN** a user requests a signed certificate for an SSH key
- **THEN** the system obtains a signed certificate via the configured CA

#### Scenario: Detect a FIDO2 key

- **WHEN** the system inspects available keys
- **THEN** it identifies `ed25519-sk` hardware-backed keys
