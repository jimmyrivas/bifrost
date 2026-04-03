/**
 * Command security filter for the MCP server.
 * Blocks dangerous commands that could cause system damage.
 * Adapted from src/renderer/src/lib/dangerous-commands.ts
 */

interface DangerousPattern {
  regex: RegExp
  severity: 'critical' | 'warning'
  description: string
}

const DANGEROUS_PATTERNS: DangerousPattern[] = [
  // Critical: destructive filesystem operations
  { regex: /rm\s+(-[a-zA-Z]*r[a-zA-Z]*\s+)?(-[a-zA-Z]*f[a-zA-Z]*\s+)?\/(\s|$|\*)/, severity: 'critical', description: 'Recursive delete of root filesystem' },
  { regex: /rm\s+-[a-zA-Z]*rf[a-zA-Z]*\s+\//, severity: 'critical', description: 'Recursive force delete from root' },
  { regex: /rm\s+-[a-zA-Z]*rf[a-zA-Z]*\s+~/, severity: 'critical', description: 'Recursive force delete of home directory' },
  { regex: /rm\s+-[a-zA-Z]*rf[a-zA-Z]*\s+\*/, severity: 'critical', description: 'Recursive force delete with wildcard' },
  // Critical: disk overwrite
  { regex: />\s*\/dev\/sd[a-z]/, severity: 'critical', description: 'Direct overwrite of disk device' },
  { regex: />\s*\/dev\/nvme/, severity: 'critical', description: 'Direct overwrite of NVMe device' },
  // Critical: dd destructive operations
  { regex: /dd\s+.*if=\/dev\/(zero|random|urandom)/, severity: 'critical', description: 'dd writing zeros/random data (potential disk wipe)' },
  // Critical: mkfs
  { regex: /mkfs(\.[a-z0-9]+)?\s+/, severity: 'critical', description: 'Filesystem format operation' },
  // Critical: fork bomb
  { regex: /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;?\s*:/, severity: 'critical', description: 'Fork bomb' },
  // Critical: SQL destructive
  { regex: /DROP\s+(TABLE|DATABASE|SCHEMA)\s/i, severity: 'critical', description: 'SQL DROP operation' },
  { regex: /TRUNCATE\s+TABLE\s/i, severity: 'critical', description: 'SQL TRUNCATE operation' },
  { regex: /DELETE\s+FROM\s+\S+\s*;?\s*$/im, severity: 'critical', description: 'SQL DELETE without WHERE clause' },
  // Warning: pipe to shell
  { regex: /curl\s+.*\|\s*(ba)?sh/, severity: 'warning', description: 'Piping remote content to shell' },
  { regex: /wget\s+.*\|\s*(ba)?sh/, severity: 'warning', description: 'Piping remote content to shell' },
  // Warning: dangerous permissions
  { regex: /chmod\s+-R\s+777\s/, severity: 'critical', description: 'Recursively setting world-writable permissions' },
  { regex: /chmod\s+777\s/, severity: 'warning', description: 'Setting world-writable permissions' },
  // Warning: system control
  { regex: /\bshutdown\b/, severity: 'warning', description: 'System shutdown command' },
  { regex: /\breboot\b/, severity: 'warning', description: 'System reboot command' },
]

export interface CommandCheckResult {
  allowed: boolean
  severity?: 'critical' | 'warning'
  reason?: string
}

export function checkCommand(command: string): CommandCheckResult {
  for (const { regex, severity, description } of DANGEROUS_PATTERNS) {
    if (regex.test(command)) {
      if (severity === 'critical') {
        return { allowed: false, severity, reason: `Blocked: ${description}` }
      }
      return { allowed: true, severity: 'warning', reason: `Warning: ${description}` }
    }
  }
  return { allowed: true }
}
