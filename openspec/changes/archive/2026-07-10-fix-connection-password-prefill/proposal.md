## Why

Editing a connection showed an empty password/passphrase field even when a
credential was stored in the vault: the form wrote credentials on save
(`credentials:setPassword`) but the credentials IPC surface was write-only, so
nothing was loaded back. The user couldn't tell whether a password was saved
(no masked dots) and the reveal (eye) toggle had nothing to show. Worse, the
save path only wrote non-empty values, so emptying the field silently kept the
old stored password — there was no way to remove one from the form.

## What Changes

- Add `credentials:getPassword` / `credentials:getPassphrase` IPC handlers that
  decrypt the stored value for a connection (architecturally consistent with
  the existing `credentials:getKeyFile`, which already returns decrypted key
  material to the renderer), plus `credentials:clearPassphrase` to mirror
  `clearPassword`. Exposed through the typed preload API.
- On edit, `ConnectionForm` prefills the password and passphrase fields from
  the vault: the field shows masked dots and the existing eye toggle reveals
  the value.
- Clearing a prefilled field and saving now removes the stored credential.
  The clear only fires when the form actually loaded a stored value
  (`loadedCreds` guard), so a save racing the async prefill — or a failed
  decryption on systems without a keyring — can never wipe the vault entry.

## Capabilities

### Modified Capabilities

- `connection-management`: gains a requirement for stored-credential
  visibility and removal in the connection editor.

## Impact

- **Main**: `src/main/ipc/credentials.ipc.ts` (+3 handlers).
- **Preload**: `src/preload/index.ts` (types + 3 bridge methods).
- **Renderer**: `src/renderer/src/components/connections/ConnectionForm.tsx`
  (prefill on load, guarded clear-on-empty on save).
- No schema changes; no new dependencies. Credentials still never leave the
  local machine — the value goes vault → main → renderer form only.
