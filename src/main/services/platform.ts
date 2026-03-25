/**
 * Cross-platform utilities for Bifrost.
 * Centralizes all platform detection, command resolution, and OS-specific behavior.
 */

import { platform, homedir } from 'os'
import { execFileSync } from 'child_process'
import { existsSync } from 'fs'

const _isWindows = platform() === 'win32'
const _isMac = platform() === 'darwin'
const _isLinux = platform() === 'linux'

export function isWindows(): boolean { return _isWindows }
export function isMac(): boolean { return _isMac }
export function isLinux(): boolean { return _isLinux }

/**
 * Check if a command exists on the system.
 * Uses 'where' on Windows, 'which' on Unix.
 */
export function commandExists(cmd: string): boolean {
  try {
    const checker = _isWindows ? 'where' : 'which'
    execFileSync(checker, [cmd], { encoding: 'utf-8', timeout: 3000, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

/**
 * Resolve the full path of a command, or null if not found.
 */
export function commandPath(cmd: string): string | null {
  try {
    const checker = _isWindows ? 'where' : 'which'
    return execFileSync(checker, [cmd], { encoding: 'utf-8', timeout: 3000, stdio: 'pipe' }).trim().split('\n')[0]
  } catch {
    return null
  }
}

/**
 * Get the default shell for the current platform.
 */
export function getDefaultShell(): string {
  if (_isWindows) return 'powershell.exe'
  if (_isMac) return process.env.SHELL || '/bin/zsh'
  return process.env.SHELL || '/bin/bash'
}

/**
 * Get the user's home directory, safe for all platforms.
 */
export function getHomeDir(): string {
  return process.env.HOME || homedir() || (_isWindows ? process.env.USERPROFILE || 'C:\\' : '/')
}

/**
 * Get ping arguments for the current platform.
 * Linux/macOS: ping -c 1 -W 3 host
 * Windows:     ping -n 1 -w 3000 host
 */
export function getPingArgs(host: string): string[] {
  if (_isWindows) {
    return ['-n', '1', '-w', '3000', host]
  }
  return ['-c', '1', '-W', '3', host]
}

/**
 * Get the process kill signal appropriate for the platform.
 * Windows doesn't support POSIX signals — use default termination.
 */
export function killProcess(proc: { kill: (signal?: string) => void }): void {
  if (_isWindows) {
    proc.kill()
  } else {
    proc.kill('SIGTERM')
  }
}

/**
 * Detect available shells on the system.
 */
export interface ShellInfo {
  name: string
  path: string
  id: string
  args?: string[]  // extra arguments (e.g. for elevated shells)
  elevated?: boolean
}

export function detectShells(): ShellInfo[] {
  if (_isWindows) {
    return detectWindowsShells()
  }
  return detectUnixShells()
}

function detectWindowsShells(): ShellInfo[] {
  const shells: ShellInfo[] = []
  const candidates: Array<{ id: string; name: string; bins: string[] }> = [
    { id: 'pwsh', name: 'PowerShell 7', bins: ['pwsh.exe'] },
    { id: 'powershell', name: 'Windows PowerShell', bins: ['powershell.exe'] },
    { id: 'cmd', name: 'Command Prompt', bins: ['cmd.exe'] },
    { id: 'bash', name: 'Git Bash', bins: [
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe'
    ]},
    { id: 'wsl', name: 'WSL', bins: ['wsl.exe'] }
  ]

  for (const c of candidates) {
    for (const bin of c.bins) {
      if (existsSync(bin) || commandExists(bin)) {
        shells.push({ id: c.id, name: c.name, path: bin })
        break
      }
    }
  }

  // Elevated shells via gsudo (github.com/gerardog/gsudo)
  // gsudo allows running elevated commands inside the same console/PTY
  const hasGsudo = commandExists('gsudo')
  if (hasGsudo) {
    // Add elevated variants for PowerShell shells
    const pwsh = shells.find((s) => s.id === 'pwsh')
    if (pwsh) {
      shells.push({ id: 'pwsh-admin', name: 'PowerShell 7 (Admin)', path: 'gsudo', args: [pwsh.path], elevated: true })
    }
    const ps = shells.find((s) => s.id === 'powershell')
    if (ps) {
      shells.push({ id: 'powershell-admin', name: 'Windows PowerShell (Admin)', path: 'gsudo', args: [ps.path], elevated: true })
    }
    shells.push({ id: 'cmd-admin', name: 'Command Prompt (Admin)', path: 'gsudo', args: ['cmd.exe'], elevated: true })
  } else {
    // Without gsudo: offer PowerShell self-elevation via Start-Process -Verb RunAs
    // This opens a NEW elevated window (not inside Bifrost's PTY) — still useful
    const pwshBin = shells.find((s) => s.id === 'pwsh')?.path ?? shells.find((s) => s.id === 'powershell')?.path
    if (pwshBin) {
      shells.push({
        id: 'powershell-admin',
        name: 'PowerShell (Admin — new window)',
        path: pwshBin,
        args: ['-Command', 'Start-Process', pwshBin, '-Verb', 'RunAs'],
        elevated: true
      })
    }
  }

  return shells
}

function detectUnixShells(): ShellInfo[] {
  const shells: ShellInfo[] = []
  const candidates: Array<{ id: string; name: string; bins: string[] }> = [
    { id: 'bash', name: 'Bash', bins: ['/bin/bash', '/usr/bin/bash'] },
    { id: 'zsh', name: 'Zsh', bins: ['/bin/zsh', '/usr/bin/zsh'] },
    { id: 'fish', name: 'Fish', bins: ['/usr/bin/fish', '/usr/local/bin/fish'] },
    { id: 'pwsh', name: 'PowerShell', bins: ['/usr/bin/pwsh', '/usr/local/bin/pwsh', '/snap/bin/pwsh'] },
    { id: 'sh', name: 'POSIX sh', bins: ['/bin/sh'] }
  ]

  for (const c of candidates) {
    for (const bin of c.bins) {
      if (existsSync(bin)) {
        shells.push({ id: c.id, name: c.name, path: bin })
        break
      }
    }
    // Fallback: try which
    if (!shells.find((s) => s.id === c.id)) {
      const path = commandPath(c.id)
      if (path) shells.push({ id: c.id, name: c.name, path })
    }
  }
  return shells
}

/**
 * Scan for monospace fonts on the system.
 * Linux: fc-list, Windows: PowerShell, macOS: system_profiler
 */
export function scanMonospaceFonts(): string[] {
  try {
    if (_isWindows) {
      return scanWindowsFonts()
    }
    if (_isMac) {
      return scanMacFonts()
    }
    return scanLinuxFonts()
  } catch {
    return []
  }
}

function scanLinuxFonts(): string[] {
  const output = execFileSync('fc-list', [':spacing=mono', 'family'], {
    encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
  })
  const families = new Set<string>()
  for (const line of output.split('\n')) {
    const name = line.split(',')[0].trim()
    if (name) families.add(name)
  }
  return [...families].sort()
}

function scanWindowsFonts(): string[] {
  // Query installed fonts via PowerShell
  const script = `
    Add-Type -AssemblyName System.Drawing
    $fonts = [System.Drawing.Text.InstalledFontCollection]::new()
    $fonts.Families | ForEach-Object { $_.Name }
  `
  const output = execFileSync('powershell.exe', ['-NoProfile', '-Command', script], {
    encoding: 'utf-8', timeout: 10000, stdio: 'pipe'
  })
  // Filter for likely monospace fonts (heuristic: common mono font names)
  const monoPatterns = /mono|courier|consolas|menlo|fira\s*code|jet\s*brains|source\s*code|cascadia|hack|inconsolata|roboto\s*mono|ubuntu\s*mono|liberation\s*mono|droid\s*sans\s*mono|dejavu\s*sans\s*mono|anonymous|input|iosevka|terminus|proggy/i
  return output.split('\n')
    .map((l) => l.trim())
    .filter((l) => l && monoPatterns.test(l))
    .sort()
}

function scanMacFonts(): string[] {
  const output = execFileSync('system_profiler', ['SPFontsDataType', '-json'], {
    encoding: 'utf-8', timeout: 10000, stdio: 'pipe'
  })
  const data = JSON.parse(output) as { SPFontsDataType?: Array<{ _name?: string; type_name?: string }> }
  const monoPatterns = /mono|courier|menlo|fira\s*code|jet\s*brains|source\s*code|cascadia|hack|inconsolata|roboto\s*mono|sf\s*mono|anonymous|input|iosevka|terminus/i
  const families = new Set<string>()
  for (const font of data.SPFontsDataType ?? []) {
    const name = font._name ?? ''
    if (name && monoPatterns.test(name)) families.add(name)
  }
  return [...families].sort()
}
