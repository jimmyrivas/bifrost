## ADDED Requirements

### Requirement: Stored credentials are visible and removable in the connection editor

The connection form SHALL prefill the password and key-passphrase fields from
the credential vault when editing a connection that has stored values, so the
value appears as masked dots and can be revealed with the field's show/hide
toggle. The credentials IPC SHALL expose read access (`getPassword`,
`getPassphrase`) alongside the existing write access, decrypting only on
demand for the edit form.

Saving the form with a credential field emptied SHALL remove the stored value
from the vault — but only when the form actually loaded a stored value, so a
save that races the asynchronous prefill (or follows a failed decryption)
never deletes a credential the user did not intentionally clear.

#### Scenario: Editing a connection with a stored password

- **WHEN** the user opens Edit Connection for a connection whose password is in the vault
- **THEN** the password field shows the stored value as masked dots
- **AND** the eye toggle reveals it

#### Scenario: Removing a stored password

- **WHEN** the user clears the prefilled password field and saves
- **THEN** the stored password is removed from the vault

#### Scenario: Save racing the prefill does not wipe the vault

- **WHEN** the user saves before the stored password has loaded (or decryption failed)
- **THEN** the stored password is left untouched
