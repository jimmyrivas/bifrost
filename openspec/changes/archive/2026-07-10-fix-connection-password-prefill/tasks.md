## 1. IPC surface

- [x] 1.1 Add `credentials:getPassword` and `credentials:getPassphrase` handlers decrypting the stored value (null when absent or decryption fails).
- [x] 1.2 Add `credentials:clearPassphrase` mirroring `clearPassword`.
- [x] 1.3 Expose `getPassword`, `getPassphrase`, `clearPassphrase` in the preload types and bridge.

## 2. Connection form

- [x] 2.1 Prefill password and passphrase from the vault in the edit-load effect.
- [x] 2.2 Track loaded values in a `loadedCreds` ref; on save, clear a stored credential only when the form loaded one and the user emptied the field.
- [x] 2.3 Run `pnpm typecheck` and ESLint on the changed files.

## 3. Verification

- [x] 3.1 Manual GUI verification: edit a connection with a saved password → masked dots visible, eye reveals; clear the field and save → password removed; re-add and save → connect works.
