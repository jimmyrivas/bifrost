import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plus, Trash2, Save, Play, FileText, ChevronDown, ChevronRight,
  Check, X, AlertTriangle, Shield, Monitor, SkipForward, Eye,
  Loader2, CheckCircle2, XCircle, Circle, PlayCircle
} from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { cn } from '@renderer/lib/utils'
import { useSessionsStore, type Tab } from '@renderer/stores/sessions.store'
import { detectDangerousCommands, type DangerousMatch } from '@renderer/lib/dangerous-commands'

interface Runbook {
  id: string
  name: string
  content: string
  updatedAt: string
}

type BlockStatus = 'idle' | 'running' | 'done' | 'error' | 'skipped'

interface CodeBlock {
  type: 'code'
  value: string
  lang?: string
  index: number
  dangers: DangerousMatch[]
  commented: boolean // all lines start with #
}

interface TextBlock {
  type: 'text'
  value: string
  index: number
}

type Block = CodeBlock | TextBlock

const sectionLabel = 'text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--on-surface-variant)] mb-2'

// ═══════════════════════════════════════════
// Terminal write helper
// ═══════════════════════════════════════════

function writeToTab(tabId: string, command: string): void {
  const { tabs } = useSessionsStore.getState()
  const tab = tabs.find((t) => t.id === tabId)
  const termId = tab?.rootPane.terminalId
  if (!termId) return
  if (termId.startsWith('ssh:')) {
    window.bifrost?.ssh?.write(termId.slice(4), command + '\n')
  } else if (termId.startsWith('mosh:')) {
    window.bifrost?.protocols?.writePty(termId.slice(5), command + '\n')
  } else {
    window.bifrost?.terminal?.write(termId, command + '\n')
  }
}

// ═══════════════════════════════════════════
// Block parser with danger detection
// ═══════════════════════════════════════════

function parseBlocks(content: string): Block[] {
  const blocks: Block[] = []
  const lines = content.split('\n')
  let inCode = false
  let codeLang = ''
  let buffer: string[] = []
  let blockIdx = 0

  for (const line of lines) {
    if (line.startsWith('```') && !inCode) {
      if (buffer.length > 0) {
        blocks.push({ type: 'text', value: buffer.join('\n'), index: blockIdx++ })
        buffer = []
      }
      inCode = true
      codeLang = line.slice(3).trim()
    } else if (line.startsWith('```') && inCode) {
      const code = buffer.join('\n')
      const dangers = detectDangerousCommands(code)
      const nonEmpty = buffer.filter((l) => l.trim())
      const commented = nonEmpty.length > 0 && nonEmpty.every((l) => l.trimStart().startsWith('#'))
      blocks.push({
        type: 'code',
        value: code,
        lang: codeLang || 'bash',
        index: blockIdx++,
        dangers,
        commented
      })
      buffer = []
      inCode = false
    } else {
      buffer.push(line)
    }
  }
  if (buffer.length > 0) {
    if (inCode) {
      const code = buffer.join('\n')
      blocks.push({ type: 'code', value: code, lang: codeLang, index: blockIdx++, dangers: detectDangerousCommands(code), commented: false })
    } else {
      blocks.push({ type: 'text', value: buffer.join('\n'), index: blockIdx++ })
    }
  }
  return blocks
}

// ═══════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════

const STORAGE_KEY = 'bifrost:runbooks'

const SAMPLE = `# Server Health Check

Run these commands to verify server status.

\`\`\`bash
uptime
\`\`\`

Check disk usage:

\`\`\`bash
df -h /
\`\`\`

Check memory:

\`\`\`bash
free -h
\`\`\`

Check running services:

\`\`\`bash
systemctl list-units --type=service --state=running | head -20
\`\`\`
`

const SAMPLE_RUNBOOKS: Array<{ name: string; content: string }> = [
  {
    name: 'Preventive Maintenance — Full',
    content: `# Preventive Maintenance — Full Server Audit

Complete maintenance runbook for Linux servers. Run monthly or before/after change windows.

## 1. System Overview

\`\`\`bash
echo "=== HOSTNAME ===" && hostname -f && echo "=== OS ===" && cat /etc/os-release | grep -E "^(NAME|VERSION)=" && echo "=== KERNEL ===" && uname -r && echo "=== UPTIME ===" && uptime -p
\`\`\`

## 2. Disk Usage

Check for partitions above 80% usage:

\`\`\`bash
df -hT | awk 'NR==1 || +$6 >= 80'
\`\`\`

Find the 20 largest files on the system:

\`\`\`bash
find / -xdev -type f -size +100M -exec du -h {} + 2>/dev/null | sort -rh | head -20
\`\`\`

Check inode usage:

\`\`\`bash
df -i | awk 'NR==1 || +$5 >= 80'
\`\`\`

## 3. Memory & Swap

\`\`\`bash
free -h && echo "---" && echo "Top 10 memory consumers:" && ps aux --sort=-%mem | head -11
\`\`\`

Check for swap pressure:

\`\`\`bash
vmstat 1 3
\`\`\`

## 4. CPU & Load

\`\`\`bash
echo "Load average:" && cat /proc/loadavg && echo "CPUs:" && nproc && echo "---" && ps aux --sort=-%cpu | head -11
\`\`\`

## 5. Systemd Failed Services

\`\`\`bash
systemctl --failed --no-pager
\`\`\`

## 6. Pending Updates (Debian/Ubuntu)

\`\`\`bash
apt update -qq && apt list --upgradable 2>/dev/null | tail -n +2 | wc -l && echo "packages pending"
\`\`\`

## 7. Kernel & Reboot

\`\`\`bash
echo "Kernel: $(uname -r)" && if [ -f /var/run/reboot-required ]; then echo "*** REBOOT REQUIRED ***"; else echo "No reboot required"; fi
\`\`\`

## 8. Log Errors (24h)

\`\`\`bash
journalctl --since "24 hours ago" -p err --no-pager | tail -30
\`\`\`

## 9. Zombie Processes

\`\`\`bash
ps aux | awk '$8 ~ /Z/' | wc -l && echo "zombie processes"
\`\`\`

## 10. NTP Sync

\`\`\`bash
timedatectl status | grep -E "(synchronized|NTP|Time zone)"
\`\`\`

## 11. Disk I/O

\`\`\`bash
iostat -xz 1 3 2>/dev/null || echo "Install sysstat: apt install sysstat"
\`\`\`
`
  },
  {
    name: 'Security Hardening — SSH',
    content: `# Security Hardening — SSH

Audit and harden SSH configuration.

## 1. SSHD Config Audit

\`\`\`bash
sshd -T 2>/dev/null | grep -E "^(permitrootlogin|passwordauthentication|pubkeyauthentication|maxauthtries|x11forwarding|permitemptypasswords|loglevel|clientaliveinterval)" | sort
\`\`\`

## 2. Root Login Check

\`\`\`bash
grep -i "^PermitRootLogin" /etc/ssh/sshd_config || echo "PermitRootLogin not set (default: prohibit-password)"
\`\`\`

Disable root login:

\`\`\`bash
# sudo sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
\`\`\`

## 3. Key-Only Authentication

\`\`\`bash
grep -E "^(PasswordAuthentication|KbdInteractiveAuthentication)" /etc/ssh/sshd_config
\`\`\`

Disable password auth:

\`\`\`bash
# sudo sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
\`\`\`

## 4. Brute Force Attempts (7 days)

\`\`\`bash
journalctl -u sshd --since "7 days ago" --no-pager | grep -i "failed password" | awk '{print $(NF-3)}' | sort | uniq -c | sort -rn | head -10
\`\`\`

## 5. Authorized Keys Audit

\`\`\`bash
for d in /home/* /root; do f="$d/.ssh/authorized_keys"; [ -f "$f" ] && echo "=== $(basename $d): $(wc -l < $f) keys ==="; done
\`\`\`

## 6. Validate & Reload

\`\`\`bash
sudo sshd -t && echo "Config OK" || echo "CONFIG ERROR"
\`\`\`

\`\`\`bash
# sudo systemctl reload sshd
\`\`\`
`
  },
  {
    name: 'Security Hardening — Firewall',
    content: `# Security Hardening — Firewall & Network

## 1. Open Ports

\`\`\`bash
ss -tlnp | column -t
\`\`\`

## 2. Firewall Status

\`\`\`bash
sudo ufw status verbose 2>/dev/null || sudo iptables -L -n -v --line-numbers 2>/dev/null | head -30 || sudo firewall-cmd --list-all 2>/dev/null || echo "No firewall found"
\`\`\`

## 3. IP Forwarding

\`\`\`bash
sysctl net.ipv4.ip_forward net.ipv6.conf.all.forwarding
\`\`\`

## 4. SYN Cookies & ICMP

\`\`\`bash
sysctl net.ipv4.tcp_syncookies net.ipv4.conf.all.accept_redirects net.ipv4.conf.all.send_redirects
\`\`\`

## 5. Established Connections

\`\`\`bash
ss -tnp | grep ESTABLISHED | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -15
\`\`\`

## 6. Services on 0.0.0.0 (should be localhost-only?)

\`\`\`bash
ss -tlnp | grep "0.0.0.0\\|:::" | grep -v "127.0.0.1\\|::1"
\`\`\`
`
  },
  {
    name: 'Security Hardening — Users & Permissions',
    content: `# Security Hardening — Users & Permissions

## 1. Users with Login Shells

\`\`\`bash
awk -F: '$7 !~ /(nologin|false)$/ {print $1, $3, $7}' /etc/passwd | column -t
\`\`\`

## 2. UID 0 Users (should only be root)

\`\`\`bash
awk -F: '$3 == 0 {print $1}' /etc/passwd
\`\`\`

## 3. Empty Passwords

\`\`\`bash
sudo awk -F: '$2 == "" {print $1}' /etc/shadow 2>/dev/null || echo "Cannot read shadow"
\`\`\`

## 4. Sudo Audit

\`\`\`bash
grep -v "^#" /etc/sudoers 2>/dev/null | grep -v "^$" && cat /etc/sudoers.d/* 2>/dev/null | grep -v "^#" | grep -v "^$"
\`\`\`

## 5. SUID/SGID Binaries

\`\`\`bash
find / -xdev \\( -perm -4000 -o -perm -2000 \\) -type f -exec ls -la {} \\; 2>/dev/null | sort -k9
\`\`\`

## 6. World-Writable Files

\`\`\`bash
find / -xdev -type f -perm -0002 -not -path "/proc/*" -not -path "/sys/*" 2>/dev/null | head -20
\`\`\`

## 7. Unnecessary Services

\`\`\`bash
for svc in avahi-daemon cups bluetooth rpcbind nfs-server xinetd; do s=$(systemctl is-active $svc 2>/dev/null); [ "$s" = "active" ] && echo "ACTIVE: $svc"; done; echo "Done"
\`\`\`
`
  },
  {
    name: 'Preventive Maintenance — Docker',
    content: `# Preventive Maintenance — Docker

## 1. Status

\`\`\`bash
docker version --format '{{.Server.Version}}' && docker info --format '{{.ContainersRunning}} running, {{.ContainersStopped}} stopped'
\`\`\`

## 2. Container Health

\`\`\`bash
docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Size}}" | head -20
\`\`\`

Unhealthy containers:

\`\`\`bash
docker ps --filter health=unhealthy --format "{{.Names}} — {{.Status}}"
\`\`\`

## 3. Disk Usage

\`\`\`bash
docker system df -v | head -30
\`\`\`

## 4. Cleanup (dangling images, stopped containers)

\`\`\`bash
# docker system prune -f
\`\`\`

## 5. Containers without Memory Limits

\`\`\`bash
docker ps -q | xargs docker inspect --format '{{.Name}} mem={{.HostConfig.Memory}}' 2>/dev/null | grep "mem=0"
\`\`\`

## 6. Network Audit

\`\`\`bash
docker network ls
\`\`\`
`
  }
]

function loadRunbooks(): Runbook[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Runbook[]
      if (parsed.length > 0) return parsed
    }
  } catch { /* ignore */ }

  const now = new Date().toISOString()
  const seeded = SAMPLE_RUNBOOKS.map((s, i) => ({
    id: `rb-seed-${i}`,
    name: s.name,
    content: s.content,
    updatedAt: now
  }))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded))
  return seeded
}

function saveRunbooks(runbooks: Runbook[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(runbooks))
}

// ═══════════════════════════════════════════
// Status icon component
// ═══════════════════════════════════════════

function StatusIcon({ status }: { status: BlockStatus }): JSX.Element {
  switch (status) {
    case 'running':
      return <Loader2 size={12} className="animate-spin text-[#6bd5ff]" />
    case 'done':
      return <CheckCircle2 size={12} className="text-[#22c55e]" />
    case 'error':
      return <XCircle size={12} className="text-[var(--error)]" />
    case 'skipped':
      return <SkipForward size={12} className="text-[#c7c4d7]/40" />
    default:
      return <Circle size={10} className="text-[#c7c4d7]/20" />
  }
}

// ═══════════════════════════════════════════
// Tab target picker
// ═══════════════════════════════════════════

function TabPicker({
  targetTabId,
  onChange
}: {
  targetTabId: string | null
  onChange: (tabId: string) => void
}): JSX.Element {
  const tabs = useSessionsStore((s) => s.tabs)
  const activeTabId = useSessionsStore((s) => s.activeTabId)

  // Auto-select active tab if none selected
  useEffect(() => {
    if (!targetTabId && activeTabId) {
      onChange(activeTabId)
    }
  }, [targetTabId, activeTabId, onChange])

  const selectedTab = tabs.find((t) => t.id === targetTabId)

  return (
    <div className="flex items-center gap-2">
      <Monitor size={12} className="text-[#c7c4d7]/50 shrink-0" />
      <span className="text-[9px] font-semibold uppercase tracking-wider text-[#c7c4d7]/50">Target:</span>
      <select
        value={targetTabId ?? ''}
        onChange={(e) => onChange(e.target.value)}
        className="bg-[var(--surface-container-highest)] text-xs text-[var(--on-surface)] rounded-[var(--radius)] px-2 py-1 outline-none border border-[#39393c]/15 focus:border-[#6bd5ff]/30"
      >
        {tabs.length === 0 && <option value="">No terminals open</option>}
        {tabs.map((tab) => (
          <option key={tab.id} value={tab.id}>
            {tab.title}{tab.id === activeTabId ? ' (active)' : ''}
          </option>
        ))}
      </select>
      {selectedTab && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
          <span className="text-[10px] text-[#c7c4d7]/50">{selectedTab.connectionId ? 'SSH' : 'Local'}</span>
        </span>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════

export function RunbookEditor(): JSX.Element {
  const [runbooks, setRunbooks] = useState<Runbook[]>(loadRunbooks)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [preview, setPreview] = useState(true)
  const [saving, setSaving] = useState(false)
  const [targetTabId, setTargetTabId] = useState<string | null>(null)
  const [dryRun, setDryRun] = useState(false)
  const [blockStatuses, setBlockStatuses] = useState<Map<number, BlockStatus>>(new Map())
  const [executing, setExecuting] = useState(false)
  const cancelRef = useRef(false)

  const selected = runbooks.find((r) => r.id === selectedId)

  const selectRunbook = useCallback((r: Runbook) => {
    setSelectedId(r.id)
    setName(r.name)
    setContent(r.content)
    setBlockStatuses(new Map())
    cancelRef.current = false
  }, [])

  const handleNew = useCallback(() => {
    setSelectedId(null)
    setName('New Runbook')
    setContent(SAMPLE)
    setBlockStatuses(new Map())
  }, [])

  const handleSave = useCallback(() => {
    setSaving(true)
    const now = new Date().toISOString()
    let updated: Runbook[]
    if (selectedId) {
      updated = runbooks.map((r) => r.id === selectedId ? { ...r, name, content, updatedAt: now } : r)
    } else {
      const id = `rb-${Date.now()}`
      updated = [...runbooks, { id, name, content, updatedAt: now }]
      setSelectedId(id)
    }
    setRunbooks(updated)
    saveRunbooks(updated)
    setSaving(false)
  }, [selectedId, name, content, runbooks])

  const handleDelete = useCallback(() => {
    if (!selectedId) return
    if (!window.confirm(`Delete runbook "${name}"?`)) return
    const updated = runbooks.filter((r) => r.id !== selectedId)
    setRunbooks(updated)
    saveRunbooks(updated)
    setSelectedId(null)
    setName('')
    setContent('')
    setBlockStatuses(new Map())
  }, [selectedId, name, runbooks])

  // Execute a single code block
  const executeBlock = useCallback((block: CodeBlock, tabId: string, isDryRun: boolean) => {
    if (!tabId) return

    const lines = block.value.split('\n').filter((l) => l.trim())
    if (lines.length === 0) return

    // Check for commented block
    if (block.commented) {
      setBlockStatuses((prev) => new Map(prev).set(block.index, 'skipped'))
      return
    }

    // Check for dangerous commands
    if (block.dangers.length > 0 && !isDryRun) {
      const dangerList = block.dangers.map((d) => `- ${d.severity.toUpperCase()}: ${d.description}`).join('\n')
      if (!window.confirm(`This block contains dangerous commands:\n\n${dangerList}\n\nExecute anyway?`)) {
        setBlockStatuses((prev) => new Map(prev).set(block.index, 'skipped'))
        return
      }
    }

    setBlockStatuses((prev) => new Map(prev).set(block.index, 'running'))

    for (const line of lines) {
      if (line.trimStart().startsWith('#')) continue // skip comments
      if (isDryRun) {
        writeToTab(tabId, `echo "[DRY-RUN] ${line.replace(/"/g, '\\"')}"`)
      } else {
        writeToTab(tabId, line)
      }
    }

    // Mark done after a short delay (commands are fire-and-forget to PTY)
    setTimeout(() => {
      setBlockStatuses((prev) => new Map(prev).set(block.index, 'done'))
    }, 500)
  }, [])

  // Run all code blocks sequentially with delay
  const runAll = useCallback(async (fromIndex = 0) => {
    if (!targetTabId || executing) return
    const blocks = parseBlocks(content)
    const codeBlocks = blocks.filter((b): b is CodeBlock => b.type === 'code' && b.index >= fromIndex)

    setExecuting(true)
    cancelRef.current = false

    for (const block of codeBlocks) {
      if (cancelRef.current) break

      if (block.commented) {
        setBlockStatuses((prev) => new Map(prev).set(block.index, 'skipped'))
        continue
      }

      if (block.dangers.length > 0 && !dryRun) {
        const dangerList = block.dangers.map((d) => `- ${d.severity.toUpperCase()}: ${d.description}`).join('\n')
        if (!window.confirm(`Step ${block.index + 1} contains dangerous commands:\n\n${dangerList}\n\nExecute? (Cancel to skip)`)) {
          setBlockStatuses((prev) => new Map(prev).set(block.index, 'skipped'))
          continue
        }
      }

      setBlockStatuses((prev) => new Map(prev).set(block.index, 'running'))

      const lines = block.value.split('\n').filter((l) => l.trim() && !l.trimStart().startsWith('#'))
      for (const line of lines) {
        if (dryRun) {
          writeToTab(targetTabId, `echo "[DRY-RUN] ${line.replace(/"/g, '\\"')}"`)
        } else {
          writeToTab(targetTabId, line)
        }
      }

      // Wait between steps
      await new Promise((r) => setTimeout(r, 1500))
      setBlockStatuses((prev) => new Map(prev).set(block.index, 'done'))
    }

    setExecuting(false)
  }, [targetTabId, content, dryRun, executing])

  const cancelExecution = useCallback(() => {
    cancelRef.current = true
    setExecuting(false)
  }, [])

  const resetStatuses = useCallback(() => {
    setBlockStatuses(new Map())
  }, [])

  const blocks = parseBlocks(content)
  const codeBlockCount = blocks.filter((b) => b.type === 'code').length
  const doneCount = Array.from(blockStatuses.values()).filter((s) => s === 'done').length
  const skippedCount = Array.from(blockStatuses.values()).filter((s) => s === 'skipped').length

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-[var(--on-surface)]">Runbooks</h2>
          <p className={sectionLabel}>INTERACTIVE NOTEBOOKS — STEP-BY-STEP EXECUTION</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleNew}>
            <Plus className="h-3 w-3" /> NEW
          </Button>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* List */}
        <div className="w-48 shrink-0 surface-2 rounded-[var(--radius)] p-2 overflow-y-auto flex flex-col gap-0.5">
          <p className={cn(sectionLabel, 'px-2')}>SAVED</p>
          {runbooks.length === 0 ? (
            <p className="text-xs text-[var(--on-surface-variant)] px-2 py-4 text-center">No runbooks yet</p>
          ) : runbooks.map((r) => (
            <button
              key={r.id}
              onClick={() => selectRunbook(r)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-[var(--radius)] transition-colors text-xs',
                selectedId === r.id
                  ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]'
                  : 'text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] hover:bg-[var(--surface-container-high)]/50'
              )}
            >
              <FileText className="h-3 w-3 shrink-0" />
              <span className="truncate">{r.name}</span>
            </button>
          ))}
        </div>

        {/* Editor / Preview */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Toolbar */}
          <div className="flex items-center gap-3 shrink-0 flex-wrap">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Runbook name" className="flex-1 min-w-[200px]" />
            <div className="flex gap-0">
              <button
                onClick={() => setPreview(false)}
                className={cn('px-3 py-1.5 text-[10px] font-semibold tracking-wider rounded-l-[var(--radius)]',
                  !preview ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]' : 'text-[var(--on-surface-variant)]'
                )}
              >EDIT</button>
              <button
                onClick={() => setPreview(true)}
                className={cn('px-3 py-1.5 text-[10px] font-semibold tracking-wider rounded-r-[var(--radius)]',
                  preview ? 'bg-[var(--surface-container-highest)] text-[var(--on-surface)]' : 'text-[var(--on-surface-variant)]'
                )}
              >PREVIEW</button>
            </div>
          </div>

          {/* Tab target + dry-run toggle */}
          {preview && (
            <div className="flex items-center gap-4 shrink-0 flex-wrap">
              <TabPicker targetTabId={targetTabId} onChange={setTargetTabId} />
              <button
                onClick={() => setDryRun(!dryRun)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] text-[10px] font-semibold uppercase tracking-wider transition-colors',
                  dryRun
                    ? 'bg-[#eab308]/15 text-[#eab308]'
                    : 'text-[#c7c4d7]/50 hover:text-[#c7c4d7]/70'
                )}
                title="Dry-run mode: echo commands instead of executing"
              >
                <Eye size={12} />
                {dryRun ? 'DRY-RUN ON' : 'DRY-RUN'}
              </button>
              {blockStatuses.size > 0 && (
                <span className="text-[10px] text-[#c7c4d7]/50">
                  {doneCount}/{codeBlockCount} done
                  {skippedCount > 0 && `, ${skippedCount} skipped`}
                </span>
              )}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto rounded-[var(--radius)] bg-[var(--surface-container-lowest)]">
            {!preview ? (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-full bg-transparent text-xs text-[var(--on-surface)] p-3 resize-none outline-none font-[family-name:var(--font-mono)] leading-relaxed whitespace-pre"
                spellCheck={false}
                placeholder="# My Runbook&#10;&#10;Write markdown with ```bash code blocks..."
              />
            ) : (
              <div className="p-3 flex flex-col gap-2">
                {blocks.map((block) => {
                  if (block.type === 'text') {
                    return (
                      <div key={block.index} className="text-xs text-[var(--on-surface-variant)] leading-relaxed whitespace-pre-wrap">
                        {block.value.split('\n').map((line, li) => {
                          if (line.startsWith('# ')) return <h2 key={li} className="text-sm font-semibold text-[var(--on-surface)] mt-2 mb-1">{line.slice(2)}</h2>
                          if (line.startsWith('## ')) return <h3 key={li} className="text-xs font-semibold text-[var(--on-surface)] mt-1.5 mb-0.5">{line.slice(3)}</h3>
                          if (line.startsWith('**') && line.endsWith('**')) return <p key={li} className="font-semibold text-[var(--on-surface)]">{line.slice(2, -2)}</p>
                          if (line.trim() === '') return <div key={li} className="h-2" />
                          return <p key={li}>{line}</p>
                        })}
                      </div>
                    )
                  }

                  const codeBlock = block as CodeBlock
                  const status = blockStatuses.get(codeBlock.index) ?? 'idle'
                  const hasDangers = codeBlock.dangers.length > 0
                  const isCommented = codeBlock.commented

                  return (
                    <div
                      key={codeBlock.index}
                      className={cn(
                        'rounded-[var(--radius)] overflow-hidden border',
                        hasDangers && !isCommented
                          ? 'border-[var(--warning)]/30'
                          : status === 'done'
                            ? 'border-[#22c55e]/20'
                            : status === 'error'
                              ? 'border-[var(--error)]/30'
                              : 'border-transparent'
                      )}
                    >
                      {/* Block header */}
                      <div className={cn(
                        'flex items-center justify-between px-2 py-1',
                        hasDangers && !isCommented
                          ? 'bg-[var(--warning)]/5'
                          : 'bg-[var(--surface-container-highest)]'
                      )}>
                        <div className="flex items-center gap-2">
                          <StatusIcon status={status} />
                          <span className="text-[9px] font-semibold text-[var(--on-surface-variant)] uppercase">{codeBlock.lang}</span>
                          {hasDangers && !isCommented && (
                            <span className="flex items-center gap-1 text-[9px] text-[var(--warning)]" title={codeBlock.dangers.map((d) => d.description).join(', ')}>
                              <AlertTriangle size={10} />
                              {codeBlock.dangers[0].severity === 'critical' ? 'DANGEROUS' : 'CAUTION'}
                            </span>
                          )}
                          {isCommented && (
                            <span className="text-[9px] text-[#c7c4d7]/30 italic">commented out</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {/* Run from here */}
                          <button
                            onClick={() => runAll(codeBlock.index)}
                            disabled={executing || !targetTabId}
                            className="flex items-center gap-1 text-[9px] text-[#c7c4d7]/50 hover:text-[var(--on-surface)] disabled:opacity-30"
                            title="Run from here"
                          >
                            <PlayCircle size={10} />
                          </button>
                          {/* Run this block */}
                          <button
                            onClick={() => targetTabId && executeBlock(codeBlock, targetTabId, dryRun)}
                            disabled={executing || !targetTabId}
                            className="flex items-center gap-1 text-[9px] text-[#6bd5ff] hover:text-[#6bd5ff]/80 disabled:opacity-30"
                            title={dryRun ? 'Echo (dry-run)' : 'Run this block'}
                          >
                            <Play size={10} /> Run
                          </button>
                        </div>
                      </div>
                      {/* Code content */}
                      <pre className={cn(
                        'px-3 py-2 text-[11px] font-[family-name:var(--font-mono)] leading-relaxed overflow-x-auto',
                        isCommented
                          ? 'text-[#c7c4d7]/30 bg-[var(--surface-container-high)]/50'
                          : 'text-[var(--on-surface)] bg-[var(--surface-container-high)]'
                      )}>
                        {codeBlock.value}
                      </pre>
                      {/* Danger details */}
                      {hasDangers && !isCommented && (
                        <div className="px-3 py-1.5 bg-[var(--warning)]/5 border-t border-[var(--warning)]/10">
                          {codeBlock.dangers.map((d, di) => (
                            <div key={di} className="flex items-center gap-1.5 text-[9px] text-[var(--warning)]">
                              <Shield size={9} />
                              <span>{d.description}: <code className="text-[var(--on-surface)]/60">{d.pattern}</code></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {executing ? (
              <Button variant="outline" size="sm" onClick={cancelExecution} className="text-[var(--error)]">
                <X className="h-3 w-3" /> CANCEL
              </Button>
            ) : (
              <Button
                variant="spectral"
                size="sm"
                onClick={() => { resetStatuses(); runAll(0) }}
                disabled={!content.trim() || !targetTabId}
              >
                <Play className="h-3 w-3" /> {dryRun ? 'DRY-RUN ALL' : 'RUN ALL'}
              </Button>
            )}
            {blockStatuses.size > 0 && !executing && (
              <Button variant="ghost" size="sm" onClick={resetStatuses}>
                RESET
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !name.trim()}>
              <Save className="h-3 w-3" /> SAVE
            </Button>
            {selectedId && (
              <Button variant="ghost" size="sm" onClick={handleDelete} className="ml-auto text-[var(--error)]">
                <Trash2 className="h-3 w-3" /> DELETE
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
