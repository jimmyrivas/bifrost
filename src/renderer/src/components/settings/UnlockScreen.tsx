import { useState, useCallback } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'

/**
 * Startup unlock screen shown in the small pre-boot window when the database is
 * encrypted at rest. On success the main process closes this window and boots.
 */
export function UnlockScreen(): JSX.Element {
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = useCallback(async () => {
    if (!passphrase || busy) return
    setBusy(true)
    setError(null)
    try {
      const { ok } = await window.bifrost.dbEncryption.unlock(passphrase)
      if (!ok) {
        setError('Incorrect passphrase — try again.')
        setPassphrase('')
      }
      // On success the main process closes this window; nothing more to do.
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }, [passphrase, busy])

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center gap-5 bg-[var(--surface)] p-8">
      <div className="w-14 h-14 rounded-full bg-[var(--surface-container-high)] flex items-center justify-center">
        <Lock className="w-6 h-6 text-[var(--on-surface-variant)]" />
      </div>
      <div className="text-center">
        <h1 className="text-base font-semibold text-[var(--on-surface)]">Bifrost is locked</h1>
        <p className="text-xs text-[var(--on-surface-variant)] mt-1">
          Enter your passphrase to decrypt the database.
        </p>
      </div>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <Input
          type="password"
          value={passphrase}
          autoFocus
          placeholder="Passphrase"
          onChange={(e) => setPassphrase(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          aria-label="Passphrase"
        />
        {error && <p className="text-xs text-[#ff6b6b]">{error}</p>}
        <Button onClick={submit} disabled={!passphrase || busy} className="w-full">
          {busy ? 'Unlocking…' : 'Unlock'}
        </Button>
      </div>
    </div>
  )
}
