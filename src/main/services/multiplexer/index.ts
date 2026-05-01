import { exec as cpExec } from 'child_process'
import { promisify } from 'util'
import { sshManager } from '../ssh-manager'
import { dtach } from './dtach'
import { tmux } from './tmux'
import type {
  AttachOptions,
  Multiplexer,
  MultiplexerKind,
  ProbeResult,
  RemoteExecutor
} from './types'

export type {
  AttachOptions,
  MultiplexerKind,
  MultiplexerSession,
  ProbeResult,
  RemoteExecutor
} from './types'

const cpExecP = promisify(cpExec)

const IMPL: Record<MultiplexerKind, Multiplexer> = { dtach, tmux }

export type Transport =
  | { type: 'ssh'; sessionId: string }
  | { type: 'local' }

function sshExecutor(sessionId: string): RemoteExecutor {
  return {
    run: (cmd: string) =>
      new Promise((resolve, reject) => {
        const session = sshManager.getSession(sessionId)
        if (!session) {
          reject(new Error(`SSH session ${sessionId} not found`))
          return
        }
        session.client.exec(cmd, (err, stream) => {
          if (err) {
            reject(err)
            return
          }
          let stdout = ''
          let stderr = ''
          stream.on('data', (d: Buffer) => {
            stdout += d.toString()
          })
          stream.stderr.on('data', (d: Buffer) => {
            stderr += d.toString()
          })
          stream.on('close', (code: number | null) => {
            resolve({ stdout, stderr, code: code ?? 0 })
          })
          stream.on('error', reject)
        })
      })
  }
}

function localExecutor(): RemoteExecutor {
  return {
    run: async (cmd: string) => {
      try {
        const { stdout, stderr } = await cpExecP(cmd, { shell: '/bin/sh' })
        return { stdout, stderr, code: 0 }
      } catch (err) {
        const e = err as { stdout?: string; stderr?: string; code?: number; message?: string }
        return {
          stdout: e.stdout ?? '',
          stderr: e.stderr ?? e.message ?? '',
          code: e.code ?? 1
        }
      }
    }
  }
}

function executorFor(transport: Transport): RemoteExecutor {
  return transport.type === 'ssh' ? sshExecutor(transport.sessionId) : localExecutor()
}

export interface ProbeRequest {
  preferred: MultiplexerKind
  /** When set and the preferred kind is not installed, probe this fallback too. */
  fallback?: MultiplexerKind
  socketDir?: string
}

export interface ProbeResponse {
  primary: ProbeResult
  fallback?: ProbeResult
}

export async function probe(transport: Transport, req: ProbeRequest): Promise<ProbeResponse> {
  const exec = executorFor(transport)
  const primary = await IMPL[req.preferred].probe(exec, { socketDir: req.socketDir })

  let fallback: ProbeResult | undefined
  if (req.fallback && req.fallback !== req.preferred && !primary.installed) {
    fallback = await IMPL[req.fallback].probe(exec, { socketDir: req.socketDir })
  }
  return { primary, fallback }
}

export function buildAttachCmd(
  kind: MultiplexerKind,
  target: string,
  opts: AttachOptions = {}
): string {
  return IMPL[kind].buildAttachCmd(target, opts)
}

export async function killSession(
  transport: Transport,
  kind: MultiplexerKind,
  target: string
): Promise<void> {
  await IMPL[kind].killSession(executorFor(transport), target)
}

export async function cleanStale(
  transport: Transport,
  kind: MultiplexerKind,
  socketDir?: string
): Promise<number> {
  return IMPL[kind].cleanStale(executorFor(transport), { socketDir })
}
