export interface DangerousMatch {
  pattern: string
  severity: 'critical' | 'warning'
  description: string
}

interface DangerousPattern {
  regex: RegExp
  severity: 'critical' | 'warning'
  description: string
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // Critical: destructive filesystem operations
  {
    regex: /rm\s+(-[a-zA-Z]*f[a-zA-Z]*\s+)?(-[a-zA-Z]*r[a-zA-Z]*\s+)?\/(\s|$|\*)/,
    severity: 'critical',
    description: 'Recursive delete of root filesystem'
  },
  {
    regex: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/(\s|$|\*)/,
    severity: 'critical',
    description: 'Recursive delete of root filesystem'
  },
  {
    regex: /rm\s+-[a-zA-Z]*rf[a-zA-Z]*\s+\//,
    severity: 'critical',
    description: 'Recursive force delete from root'
  },
  {
    regex: /rm\s+-[a-zA-Z]*rf[a-zA-Z]*\s+~/,
    severity: 'critical',
    description: 'Recursive force delete of home directory'
  },
  {
    regex: /rm\s+-[a-zA-Z]*rf[a-zA-Z]*\s+\*/,
    severity: 'critical',
    description: 'Recursive force delete with wildcard'
  },
  // Critical: disk overwrite
  {
    regex: />\s*\/dev\/sd[a-z]/,
    severity: 'critical',
    description: 'Direct overwrite of disk device'
  },
  {
    regex: />\s*\/dev\/nvme/,
    severity: 'critical',
    description: 'Direct overwrite of NVMe device'
  },
  // Critical: dd destructive operations
  {
    regex: /dd\s+.*if=\/dev\/(zero|random|urandom)/,
    severity: 'critical',
    description: 'dd writing zeros/random data (potential disk wipe)'
  },
  // Critical: mkfs on any device
  {
    regex: /mkfs(\.[a-z0-9]+)?\s+/,
    severity: 'critical',
    description: 'Filesystem format operation'
  },
  // Critical: fork bomb
  {
    regex: /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?\s*:/,
    severity: 'critical',
    description: 'Fork bomb - will crash the system'
  },
  // Critical: SQL destructive
  {
    regex: /DROP\s+(TABLE|DATABASE|SCHEMA)\s/i,
    severity: 'critical',
    description: 'SQL DROP operation - data loss'
  },
  {
    regex: /TRUNCATE\s+TABLE\s/i,
    severity: 'critical',
    description: 'SQL TRUNCATE operation - data loss'
  },
  {
    regex: /DELETE\s+FROM\s+\S+\s*;?\s*$/im,
    severity: 'critical',
    description: 'SQL DELETE without WHERE clause - deletes all rows'
  },
  // Warning: pipe to shell (remote code execution)
  {
    regex: /curl\s+.*\|\s*(ba)?sh/,
    severity: 'warning',
    description: 'Piping remote content to shell - potential RCE'
  },
  {
    regex: /wget\s+.*\|\s*(ba)?sh/,
    severity: 'warning',
    description: 'Piping remote content to shell - potential RCE'
  },
  {
    regex: /curl\s+.*\|\s*sudo\s/,
    severity: 'warning',
    description: 'Piping remote content to sudo - elevated RCE risk'
  },
  {
    regex: /wget\s+.*-O\s*-\s*\|\s*(ba)?sh/,
    severity: 'warning',
    description: 'Piping remote download to shell'
  },
  // Warning: dangerous permissions
  {
    regex: /chmod\s+777\s/,
    severity: 'warning',
    description: 'Setting world-writable permissions'
  },
  {
    regex: /chmod\s+-R\s+777\s/,
    severity: 'critical',
    description: 'Recursively setting world-writable permissions'
  },
  // Warning: system control
  {
    regex: /\bshutdown\b/,
    severity: 'warning',
    description: 'System shutdown command'
  },
  {
    regex: /\breboot\b/,
    severity: 'warning',
    description: 'System reboot command'
  },
  {
    regex: /\binit\s+0\b/,
    severity: 'warning',
    description: 'System halt via init'
  },
  {
    regex: /\binit\s+6\b/,
    severity: 'warning',
    description: 'System reboot via init'
  },
  // Warning: destructive history/env manipulation
  {
    regex: />\s*\/dev\/null\s*2>&1\s*&/,
    severity: 'warning',
    description: 'Silently backgrounded command with suppressed output'
  },
  {
    regex: /\beval\s+.*\$\(/,
    severity: 'warning',
    description: 'Eval with command substitution - potential injection'
  }
]

export function detectDangerousCommands(text: string): DangerousMatch[] {
  const matches: DangerousMatch[] = []
  const seen = new Set<string>()

  for (const { regex, severity, description } of DANGEROUS_PATTERNS) {
    const match = text.match(regex)
    if (match) {
      const key = `${severity}:${description}`
      if (!seen.has(key)) {
        seen.add(key)
        matches.push({
          pattern: match[0].trim(),
          severity,
          description
        })
      }
    }
  }

  // Sort critical first
  matches.sort((a, b) => {
    if (a.severity === b.severity) return 0
    return a.severity === 'critical' ? -1 : 1
  })

  return matches
}
