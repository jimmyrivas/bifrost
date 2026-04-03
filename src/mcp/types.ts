/**
 * Shared types for the Bifrost MCP server.
 * Mirrors relevant types from the Electron main process without importing Electron.
 */

export interface Connection {
  id: string
  groupId: string | null
  name: string
  method: 'ssh' | 'mosh' | 'rdp' | 'vnc' | 'telnet' | 'local' | 'ftp'
  host: string | null
  port: number | null
  authType: string | null
  username: string | null
  privateKeyPath: string | null
  launchOnStartup: boolean
  reconnectOnDisconnect: boolean
  runWithSudo: boolean
  useAutossh: boolean
  tabTitle: string | null
  networkMode: string | null
  sortOrder: number
  createdAt: string | null
  updatedAt: string | null
}

export interface Group {
  id: string
  name: string
  parentId: string | null
  sortOrder: number
  icon: string | null
}

export interface Tunnel {
  id: string
  name: string
  host: string
  port: number
  username: string | null
  authType: string | null
  privateKeyPath: string | null
  forwards: string
  autoStart: boolean
  createdAt: string | null
}

export interface Cluster {
  id: string
  name: string
  createdAt: string | null
}

export interface AuditEvent {
  timestamp: string
  connectionId: string
  connectionName: string
  host: string
  event: string
  details: Record<string, unknown>
}

export interface SshSessionInfo {
  id: string
  host: string
  port: number
  username: string
  connectedAt: string
  hasShell: boolean
}

export interface TerminalSessionInfo {
  id: string
  shell: string
  createdAt: string
}

export type SecurityLevel = 0 | 1 | 2
