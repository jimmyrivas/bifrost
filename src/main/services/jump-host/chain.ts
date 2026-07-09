import { Client, type ConnectConfig } from 'ssh2'
import type { Socket } from 'net'
import { readFileSync, existsSync } from 'fs'
import type { ResolvedHop } from './types'

/**
 * Minimal interface used by chain orchestration. Lets tests substitute a mock
 * client factory without pulling in ssh2's real socket machinery.
 */
export interface ChainClient {
  on(event: string, listener: (...args: unknown[]) => void): this
  once(event: string, listener: (...args: unknown[]) => void): this
  connect(config: ConnectConfig): unknown
  forwardOut(
    srcIP: string,
    srcPort: number,
    dstIP: string,
    dstPort: number,
    cb: (err: Error | undefined, stream: Socket) => void
  ): unknown
  end(): unknown
}

export type ChainClientFactory = () => ChainClient

const defaultFactory: ChainClientFactory = () => new Client() as unknown as ChainClient

export interface HostKeyHooks {
  hostKey(host: string, port: number): string
  computeFingerprint(key: Buffer): string
  loadKnownHosts(): Record<string, { fingerprint: string }>
  storeHostKey(host: string, port: number, fingerprint: string, algorithm: string): void
}

export interface EstablishOptions {
  /** Replaces ssh2.Client construction in tests. */
  factory?: ChainClientFactory
  /** Host-key TOFU helpers. Tests pass no-op stubs. */
  hostKeyHooks?: HostKeyHooks
  /** Override file reader (private keys) — tests use an in-memory map. */
  readKeyFile?: (path: string) => Buffer
}

/**
 * Build a ConnectConfig for a single hop. `sock` (when present) is the upstream
 * channel from a previous hop; ssh2 then runs SSH over that duplex stream.
 */
export function buildHopConnectConfig(
  hop: ResolvedHop,
  sock: Socket | undefined,
  opts: EstablishOptions = {}
): ConnectConfig {
  const cc: ConnectConfig = {
    host: hop.host,
    port: hop.port,
    username: hop.username,
    readyTimeout: 30000
  }

  if (opts.hostKeyHooks) {
    const hooks = opts.hostKeyHooks
    cc.hostVerifier = (key: Buffer) => {
      const fingerprint = hooks.computeFingerprint(key)
      const known = hooks.loadKnownHosts()[hooks.hostKey(hop.host, hop.port)]
      if (known) return known.fingerprint === fingerprint
      hooks.storeHostKey(hop.host, hop.port, fingerprint, 'ssh-rsa')
      return true
    }
  }

  if (sock) cc.sock = sock

  const readKey = opts.readKeyFile ?? readFileSync

  switch (hop.authType) {
    case 'userpass':
      if (hop.password) cc.password = hop.password
      break
    case 'key':
      if (hop.privateKeyPath) {
        try {
          cc.privateKey = readKey(hop.privateKeyPath)
        } catch (err) {
          throw new Error(
            `Cannot read jump-host key ${hop.privateKeyPath}: ${(err as Error).message}`
          )
        }
      }
      break
    case 'key_pass':
      if (hop.privateKeyPath) {
        try {
          cc.privateKey = readKey(hop.privateKeyPath)
        } catch (err) {
          throw new Error(
            `Cannot read jump-host key ${hop.privateKeyPath}: ${(err as Error).message}`
          )
        }
      }
      if (hop.passphrase) cc.passphrase = hop.passphrase
      break
    case 'agent': {
      const sock = process.env.SSH_AUTH_SOCK
      if (sock && existsSync(sock)) {
        cc.agent = sock
      } else {
        throw new Error(
          `Jump host "${hop.host}" requiere SSH agent, pero SSH_AUTH_SOCK ` +
            `${sock ? `apunta a un socket inexistente (${sock})` : 'no está definido'}. ` +
            `Inicia ssh-agent y añade tu clave (ssh-add), o cambia el auth del jump host a key/password.`
        )
      }
      break
    }
  }

  return cc
}

/**
 * Walks a resolved jump chain. For each hop:
 *   1. Connect a fresh ssh client to the hop (using upstream sock if any).
 *   2. Open a forwardOut channel from that hop to the next destination
 *      (next hop, or the final target on the last iteration).
 *   3. Pass the resulting stream as the transport for the next leg.
 *
 * On any failure, all already-connected upstream clients are closed in reverse
 * order to avoid leaking bastion sessions.
 */
export async function establishJumpChain(
  chain: ResolvedHop[],
  finalTarget: { host: string; port: number },
  opts: EstablishOptions = {}
): Promise<{ sock: Socket; clients: ChainClient[] }> {
  if (chain.length === 0) {
    throw new Error('Empty jump chain')
  }
  const factory = opts.factory ?? defaultFactory
  const clients: ChainClient[] = []
  let upstreamSock: Socket | undefined

  const cleanup = (): void => {
    clients.slice().reverse().forEach((c) => {
      try { c.end() } catch { /* ignore */ }
    })
  }

  for (let i = 0; i < chain.length; i++) {
    const hop = chain[i]
    const hopClient = factory()
    const hopCC = buildHopConnectConfig(hop, upstreamSock, opts)

    try {
      await new Promise<void>((resolve, reject) => {
        hopClient.once('ready', () => resolve())
        hopClient.once('error', (...args: unknown[]) => {
          const err = args[0] as Error
          reject(new Error(`hop ${i + 1} (${hop.host}:${hop.port}): ${err.message}`))
        })
        hopClient.connect(hopCC)
      })
    } catch (err) {
      cleanup()
      throw err
    }
    clients.push(hopClient)

    const nextDest =
      i < chain.length - 1
        ? { host: chain[i + 1].host, port: chain[i + 1].port }
        : finalTarget

    upstreamSock = await new Promise<Socket>((resolve, reject) => {
      hopClient.forwardOut('localhost', 0, nextDest.host, nextDest.port, (err, stream) => {
        if (err) {
          cleanup()
          return reject(
            new Error(
              `forward via hop ${i + 1} to ${nextDest.host}:${nextDest.port} failed: ${err.message}`
            )
          )
        }
        resolve(stream)
      })
    })
  }

  if (!upstreamSock) {
    cleanup()
    throw new Error('Jump chain produced no upstream socket')
  }
  return { sock: upstreamSock, clients }
}
