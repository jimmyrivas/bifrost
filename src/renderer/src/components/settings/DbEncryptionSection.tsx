import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, Lock, Unlock } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { showToast } from '@renderer/lib/protocol-dispatch'

const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'
const MIN_LEN = 8

/**
 * At-rest database encryption (Phase 5.5). Enable sets a passphrase that
 * encrypts the DB file when Bifrost closes and requires it on next launch.
 * Includes a hard warning: a lost passphrase means unrecoverable data.
 */
export function DbEncryptionSection(): JSX.Element {
  const [enabled, setEnabled] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const { enabled } = await window.bifrost.dbEncryption.status()
      setEnabled(enabled)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const enable = useCallback(async () => {
    if (pass.length < MIN_LEN || pass !== confirm) return
    const confirmed = window.confirm(
      'Encrypt the database with this passphrase?\n\n' +
        'There is NO recovery and NO backdoor. If you forget this passphrase, ' +
        'every stored connection, credential, and note is permanently lost.\n\n' +
        'Encryption is finalized when you close Bifrost; you will be asked for the ' +
        'passphrase on next launch.'
    )
    if (!confirmed) return
    setBusy(true)
    try {
      await window.bifrost.dbEncryption.enable(pass)
      setEnabled(true)
      setShowForm(false)
      setPass('')
      setConfirm('')
      showToast({ variant: 'success', message: 'Encryption enabled — it takes effect when you close Bifrost' })
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }, [pass, confirm])

  const disable = useCallback(async () => {
    if (!window.confirm('Disable database encryption? The database will be stored unencrypted after you close Bifrost.')) return
    setBusy(true)
    try {
      await window.bifrost.dbEncryption.disable()
      setEnabled(false)
      showToast({ variant: 'info', message: 'Encryption disabled — the database will be plaintext after you close Bifrost' })
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }, [])

  const mismatch = confirm.length > 0 && pass !== confirm
  const tooShort = pass.length > 0 && pass.length < MIN_LEN

  return (
    <div>
      <label className={fieldLabel}>DATABASE ENCRYPTION (AT REST)</label>
      <p className="text-xs text-[var(--on-surface-variant)] mb-3">
        Encrypt the whole database file with a passphrase (AES-256-GCM). It is decrypted while Bifrost runs
        and re-encrypted when you close it, so you are asked for the passphrase on startup. This protects the
        file when the app is closed; it does not hide data from your own running session.
      </p>

      {enabled ? (
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--success)] flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Encryption enabled
          </span>
          <Button variant="outline" size="sm" onClick={disable} disabled={busy}>
            <Unlock className="w-3.5 h-3.5 mr-1" /> Disable
          </Button>
        </div>
      ) : showForm ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-[var(--radius)] bg-[#ff6b6b]/10 p-3">
            <AlertTriangle className="w-4 h-4 text-[#ff6b6b] shrink-0 mt-0.5" />
            <p className="text-[11px] text-[#ff6b6b]">
              There is no recovery and no backdoor. If you forget this passphrase, every stored connection,
              credential, and note is <strong>permanently lost</strong>. Store it somewhere safe.
            </p>
          </div>
          <div>
            <label className={fieldLabel} htmlFor="db-enc-pass">PASSPHRASE (min {MIN_LEN} chars)</label>
            <Input id="db-enc-pass" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="new-password" />
          </div>
          <div>
            <label className={fieldLabel} htmlFor="db-enc-confirm">CONFIRM PASSPHRASE</label>
            <Input id="db-enc-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {tooShort && <p className="text-[11px] text-[#ff6b6b]">Passphrase must be at least {MIN_LEN} characters.</p>}
          {mismatch && <p className="text-[11px] text-[#ff6b6b]">Passphrases do not match.</p>}
          <div className="flex gap-2">
            <Button size="sm" onClick={enable} disabled={busy || pass.length < MIN_LEN || pass !== confirm}>
              Enable encryption
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setPass(''); setConfirm('') }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
          <Lock className="w-3.5 h-3.5 mr-1" /> Set passphrase & enable
        </Button>
      )}
    </div>
  )
}
