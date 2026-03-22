export interface ErrorPattern {
  pattern: RegExp
  severity: 'error' | 'warning'
  label: string
  suggestion: string
}

export const ERROR_PATTERNS: ErrorPattern[] = [
  {
    pattern: /command not found/i,
    severity: 'error',
    label: 'Command Not Found',
    suggestion: 'The command is not installed or not in PATH. Try installing it or check spelling.'
  },
  {
    pattern: /permission denied/i,
    severity: 'error',
    label: 'Permission Denied',
    suggestion: 'Insufficient permissions. Try running with sudo or check file permissions.'
  },
  {
    pattern: /no such file or directory/i,
    severity: 'error',
    label: 'File Not Found',
    suggestion: 'The specified path does not exist. Check the path and try again.'
  },
  {
    pattern: /connection refused/i,
    severity: 'error',
    label: 'Connection Refused',
    suggestion: 'The target service is not running or the port is blocked.'
  },
  {
    pattern: /connection timed out/i,
    severity: 'error',
    label: 'Connection Timeout',
    suggestion: 'Network connectivity issue or firewall blocking the connection.'
  },
  {
    pattern: /name or service not known/i,
    severity: 'error',
    label: 'DNS Resolution Failed',
    suggestion: 'Cannot resolve hostname. Check DNS settings or use an IP address.'
  },
  {
    pattern: /disk full|no space left on device/i,
    severity: 'error',
    label: 'Disk Full',
    suggestion: 'No disk space remaining. Free space with du -sh /* and rm old files.'
  },
  {
    pattern: /out of memory|cannot allocate memory/i,
    severity: 'error',
    label: 'Out of Memory',
    suggestion: 'System is out of RAM. Check memory usage with free -h.'
  },
  {
    pattern: /segmentation fault/i,
    severity: 'error',
    label: 'Segfault',
    suggestion: 'Program crashed due to invalid memory access.'
  },
  {
    pattern: /killed|oom-killer/i,
    severity: 'error',
    label: 'Process Killed',
    suggestion: 'Process was killed, likely by the OOM killer. Check dmesg for details.'
  },
  {
    pattern: /authentication fail/i,
    severity: 'error',
    label: 'Auth Failed',
    suggestion: 'Wrong credentials. Verify username and password or SSH key.'
  },
  {
    pattern: /host key verification failed/i,
    severity: 'warning',
    label: 'Host Key Changed',
    suggestion: 'Server fingerprint changed. Remove old key from ~/.ssh/known_hosts.'
  },
  {
    pattern: /syntax error/i,
    severity: 'warning',
    label: 'Syntax Error',
    suggestion: 'Check the command syntax. Verify quotes, brackets, and escaping.'
  },
  {
    pattern: /operation not permitted/i,
    severity: 'error',
    label: 'Not Permitted',
    suggestion: 'The operation requires elevated privileges or is restricted.'
  },
  {
    pattern: /too many open files/i,
    severity: 'warning',
    label: 'File Limit',
    suggestion: 'Increase ulimit -n or close unused file descriptors.'
  },
  {
    pattern: /broken pipe/i,
    severity: 'warning',
    label: 'Broken Pipe',
    suggestion: 'The receiving process terminated before data was fully sent.'
  }
]

export interface DetectedError {
  pattern: ErrorPattern
  line: string
  timestamp: number
}

export function scanForErrors(output: string): DetectedError[] {
  const results: DetectedError[] = []
  const lines = output.split('\n')
  const now = Date.now()

  for (const line of lines) {
    for (const pattern of ERROR_PATTERNS) {
      if (pattern.pattern.test(line)) {
        results.push({ pattern, line: line.trim(), timestamp: now })
        break // one match per line
      }
    }
  }

  return results
}
