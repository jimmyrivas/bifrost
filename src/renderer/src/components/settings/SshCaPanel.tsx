import { useState, useEffect, useCallback } from 'react'
import { ScrollText } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { showToast } from '@renderer/lib/protocol-dispatch'

type SignResult = Awaited<ReturnType<typeof window.bifrost.sshCa.signWithLocalCa>>

const fieldLabel = 'text-xs text-[var(--on-surface-variant)] mb-1 block'
const card = 'rounded-[var(--radius)] bg-[var(--surface-container-high)] p-4 flex flex-col gap-3'

/**
 * Minimal SSH certificate-authority panel (#91): sign a public key with a local
 * CA key (ssh-keygen) or a HashiCorp Vault SSH role, and show the resulting
 * certificate path. Local CA is verifiable with the ubiquitous ssh-keygen.
 */
export function SshCaPanel(): JSX.Element {
  const [mode, setMode] = useState<'local' | 'vault'>('local')
  const [avail, setAvail] = useState<{ keygen: boolean; vault: boolean }>({ keygen: false, vault: false })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SignResult | null>(null)

  // Local CA
  const [pubKeyPath, setPubKeyPath] = useState('')
  const [caKeyPath, setCaKeyPath] = useState('')
  const [identity, setIdentity] = useState('')
  const [principals, setPrincipals] = useState('')
  // Vault
  const [vaultAddr, setVaultAddr] = useState('')
  const [vaultToken, setVaultToken] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    Promise.all([
      window.bifrost.sshCa.isSshKeygenAvailable().catch(() => false),
      window.bifrost.sshCa.isVaultCliAvailable().catch(() => false)
    ]).then(([keygen, vault]) => setAvail({ keygen, vault }))
  }, [])

  const pick = useCallback(async (setter: (v: string) => void) => {
    const paths = await window.bifrost.window.showOpenDialog()
    if (paths && paths.length > 0) setter(paths[0])
  }, [])

  const sign = useCallback(async () => {
    setBusy(true)
    setResult(null)
    try {
      const principalList = principals.split(',').map((p) => p.trim()).filter(Boolean)
      const res = mode === 'local'
        ? await window.bifrost.sshCa.signWithLocalCa({
            pubKeyPath, caKeyPath, identity, principals: principalList
          })
        : await window.bifrost.sshCa.signWithVault({
            pubKeyPath, vaultAddr, vaultToken, role, validPrincipals: principalList
          })
      setResult(res)
      showToast({ variant: 'success', message: `Certificate signed → ${res.certificatePath}` })
    } catch (err) {
      showToast({ variant: 'error', message: err instanceof Error ? err.message : String(err) })
    } finally {
      setBusy(false)
    }
  }, [mode, pubKeyPath, caKeyPath, identity, principals, vaultAddr, vaultToken, role])

  const canSign = mode === 'local'
    ? pubKeyPath && caKeyPath && identity
    : pubKeyPath && vaultAddr && vaultToken && role

  const PathField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element => (
    <div>
      <label className={fieldLabel}>{label}</label>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 font-[family-name:var(--font-mono)] text-xs" placeholder="~/.ssh/…" />
        <Button variant="outline" size="sm" onClick={() => pick(onChange)}>Browse</Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4 max-w-lg">
      <h3 className="text-sm font-semibold text-[var(--on-surface)] flex items-center gap-2">
        <ScrollText className="h-4 w-4" /> SSH certificate authority
      </h3>
      <p className="text-xs text-[var(--on-surface-variant)]">
        Sign an SSH public key into a certificate. Local CA needs <code>ssh-keygen</code>{' '}
        ({avail.keygen ? 'available' : 'not found'}); Vault needs the <code>vault</code> CLI{' '}
        ({avail.vault ? 'available' : 'not found'}).
      </p>

      <div className="flex gap-1">
        {(['local', 'vault'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={
              'px-3 py-1.5 text-xs font-semibold uppercase tracking-wider rounded-[var(--radius)] ' +
              (mode === m ? 'bg-[var(--surface-container-high)] text-[var(--on-surface)]' : 'text-[var(--on-surface-variant)]')
            }
          >
            {m === 'local' ? 'Local CA' : 'Vault'}
          </button>
        ))}
      </div>

      <div className={card}>
        <PathField label="PUBLIC KEY TO SIGN" value={pubKeyPath} onChange={setPubKeyPath} />
        {mode === 'local' ? (
          <>
            <PathField label="CA PRIVATE KEY" value={caKeyPath} onChange={setCaKeyPath} />
            <div>
              <label className={fieldLabel}>IDENTITY (KEY ID)</label>
              <Input value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="jrivas@laptop" className="text-xs" />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className={fieldLabel}>VAULT ADDRESS</label>
              <Input value={vaultAddr} onChange={(e) => setVaultAddr(e.target.value)} placeholder="https://vault:8200" className="text-xs" />
            </div>
            <div>
              <label className={fieldLabel}>VAULT TOKEN</label>
              <Input type="password" value={vaultToken} onChange={(e) => setVaultToken(e.target.value)} className="text-xs" />
            </div>
            <div>
              <label className={fieldLabel}>ROLE</label>
              <Input value={role} onChange={(e) => setRole(e.target.value)} placeholder="ssh-role" className="text-xs" />
            </div>
          </>
        )}
        <div>
          <label className={fieldLabel}>PRINCIPALS (COMMA-SEPARATED, OPTIONAL)</label>
          <Input value={principals} onChange={(e) => setPrincipals(e.target.value)} placeholder="root, deploy" className="text-xs" />
        </div>
        <Button onClick={sign} disabled={busy || !canSign} className="self-start">
          {busy ? 'Signing…' : 'Sign certificate'}
        </Button>
        {result && (
          <div className="rounded-[var(--radius)] bg-[var(--surface-container-highest)] p-3 text-[11px] font-[family-name:var(--font-mono)] text-[var(--on-surface-variant)]">
            <div><span className="text-[#6bff6b]">✓ signed</span> · serial {result.serial}</div>
            <div className="truncate">cert: {result.certificatePath}</div>
            <div>valid until {result.validUntil}</div>
          </div>
        )}
      </div>
    </div>
  )
}
