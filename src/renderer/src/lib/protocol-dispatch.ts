/**
 * Protocol method dispatch table (#2.1) + launcher install hints (#2.2).
 *
 * Pure helpers used by `useTerminal.initConnection` to route a connection's
 * `method` to the right backend and by the toast layer to explain missing
 * external launchers. Kept free of Electron/IPC imports so it is unit-testable.
 */

/** How a connection method is carried out. */
export type DispatchKind =
  | 'ssh' // ssh2 backend (default for unknown methods)
  | 'mosh' // PTY-backed mosh launcher (protocols.connectMosh)
  | 'telnet' // raw socket session (protocols.connectTelnet / writeTelnet)
  | 'protocol-pty' // PTY-backed launcher bound to protocols.writePty/resizePty (ftp, ssm)
  | 'external' // external GUI client (rdp, vnc) — pane shows client output only
  | 'local-shell' // local PTY via terminal.create (custom command / local)

const DISPATCH_TABLE: Record<string, DispatchKind> = {
  ssh: 'ssh',
  mosh: 'mosh',
  telnet: 'telnet',
  ftp: 'protocol-pty',
  ssm: 'protocol-pty',
  rdp: 'external',
  vnc: 'external',
  custom: 'local-shell',
  local: 'local-shell'
}

/** Route a connection `method` to its execution backend. Unknown → ssh. */
export function dispatchKindFor(method: string | null | undefined): DispatchKind {
  if (!method) return 'ssh'
  return DISPATCH_TABLE[method] ?? 'ssh'
}

/** Default port per method, used when the connection has none stored. */
export function defaultPortFor(method: string): number {
  switch (method) {
    case 'rdp':
      return 3389
    case 'vnc':
      return 5900
    case 'telnet':
      return 23
    case 'ftp':
      return 21
    default:
      return 22
  }
}

/**
 * Install hint per method for when the external launcher binary is missing
 * (#2.2). Returns null for methods with no external binary (e.g. telnet,
 * which is a raw socket).
 */
export function launcherInstallHint(method: string): string | null {
  switch (method) {
    case 'rdp':
      return 'Install FreeRDP: sudo apt install freerdp2-x11 (or freerdp3-x11)'
    case 'vnc':
      return 'Install a VNC viewer: sudo apt install tigervnc-viewer'
    case 'ftp':
      return 'Install lftp: sudo apt install lftp (or a classic ftp client)'
    case 'ssm':
      return 'Install the AWS CLI and the SSM plugin: sudo apt install awscli, then the session-manager-plugin'
    case 'mosh':
      return 'Install mosh: sudo apt install mosh'
    default:
      return null
  }
}

/** Human-readable client binary name per method (for error messages). */
export function launcherBinaryFor(method: string): string {
  switch (method) {
    case 'rdp':
      return 'xfreerdp'
    case 'vnc':
      return 'vncviewer'
    case 'ftp':
      return 'lftp/ftp'
    case 'ssm':
      return 'aws'
    case 'mosh':
      return 'mosh'
    default:
      return method
  }
}

/** True when an error message looks like "launcher binary not installed". */
export function isLauncherMissingError(message: string): boolean {
  return /ENOENT|not found|no such file/i.test(message)
}

/** RDP client options persisted in the connection's sshConfig JSON (`rdp` key). */
export interface StoredRdpOptions {
  clipboard?: boolean
  driveRedirect?: boolean
  printerRedirect?: boolean
  audioPlayback?: boolean
  colorDepth?: 15 | 16 | 24 | 32
  fullscreen?: boolean
  resolution?: string
}

function parseSshConfig(sshConfig: string | null | undefined): Record<string, unknown> {
  if (!sshConfig) return {}
  try {
    const parsed = JSON.parse(sshConfig)
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/** Extract stored RDP options from a connection's sshConfig JSON. */
export function parseRdpOptions(sshConfig: string | null | undefined): StoredRdpOptions | undefined {
  const cfg = parseSshConfig(sshConfig)
  const rdp = cfg.rdp
  if (!rdp || typeof rdp !== 'object') return undefined
  return rdp as StoredRdpOptions
}

/** Extract the stored custom command from a connection's sshConfig JSON. */
export function parseCustomCommand(sshConfig: string | null | undefined): string | null {
  const cfg = parseSshConfig(sshConfig)
  return typeof cfg.customCommand === 'string' && cfg.customCommand.trim()
    ? cfg.customCommand.trim()
    : null
}

/** Extract the stored AWS region for SSM sessions (sshConfig `region` key). */
export function parseSsmRegion(sshConfig: string | null | undefined): string | null {
  const cfg = parseSshConfig(sshConfig)
  if (typeof cfg.region === 'string' && cfg.region.trim()) return cfg.region.trim()
  const ssm = cfg.ssm
  if (ssm && typeof ssm === 'object') {
    const region = (ssm as Record<string, unknown>).region
    if (typeof region === 'string' && region.trim()) return region.trim()
  }
  return null
}

/** Detail payload for the global `app:toast` CustomEvent. */
export interface AppToastDetail {
  message: string
  hint?: string
  variant?: 'error' | 'info' | 'success'
}

/** Fire a global toast (rendered by ToastHost in App.tsx). */
export function showToast(detail: AppToastDetail): void {
  document.dispatchEvent(new CustomEvent<AppToastDetail>('app:toast', { detail }))
}
