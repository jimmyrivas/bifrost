import type { SFTPWrapper, FileEntry, Stats, InputAttributes } from 'ssh2'
import { sshManager } from './ssh-manager'

export interface SftpFileEntry {
  name: string
  size: number
  permissions: number
  modifiedDate: number
  accessDate: number
  isDirectory: boolean
  isSymlink: boolean
  owner: number
  group: number
}

export interface SftpFileStat {
  size: number
  permissions: number
  modifiedDate: number
  accessDate: number
  isDirectory: boolean
  isSymlink: boolean
  owner: number
  group: number
}

interface SftpSession {
  id: string
  sshSessionId: string
  sftp: SFTPWrapper
}

const sessions = new Map<string, SftpSession>()
let sftpIdCounter = 0

function toFileEntry(entry: FileEntry): SftpFileEntry {
  const attrs = entry.attrs
  return {
    name: entry.filename,
    size: attrs.size,
    permissions: attrs.mode & 0o7777,
    modifiedDate: attrs.mtime * 1000,
    accessDate: attrs.atime * 1000,
    isDirectory: (attrs.mode & 0o170000) === 0o040000,
    isSymlink: (attrs.mode & 0o170000) === 0o120000,
    owner: attrs.uid,
    group: attrs.gid
  }
}

function toFileStat(stats: Stats): SftpFileStat {
  return {
    size: stats.size,
    permissions: stats.mode & 0o7777,
    modifiedDate: stats.mtime * 1000,
    accessDate: stats.atime * 1000,
    isDirectory: (stats.mode & 0o170000) === 0o040000,
    isSymlink: (stats.mode & 0o170000) === 0o120000,
    owner: stats.uid,
    group: stats.gid
  }
}

function getSession(sftpId: string): SftpSession {
  const session = sessions.get(sftpId)
  if (!session) {
    throw new Error(`SFTP session ${sftpId} not found`)
  }
  return session
}

export class SftpManager {
  openSftp(sshSessionId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const sshSession = sshManager.getSession(sshSessionId)
      if (!sshSession) {
        reject(new Error(`SSH session ${sshSessionId} not found`))
        return
      }

      sshSession.client.sftp((err, sftp) => {
        if (err) {
          reject(err)
          return
        }

        const id = `sftp-${++sftpIdCounter}`
        sessions.set(id, { id, sshSessionId, sftp })
        resolve(id)
      })
    })
  }

  listDirectory(sftpId: string, path: string): Promise<SftpFileEntry[]> {
    return new Promise((resolve, reject) => {
      const session = getSession(sftpId)

      session.sftp.readdir(path, (err, list) => {
        if (err) {
          reject(err)
          return
        }

        const entries = list.map(toFileEntry)
        entries.sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) {
            return a.isDirectory ? -1 : 1
          }
          return a.name.localeCompare(b.name)
        })

        resolve(entries)
      })
    })
  }

  readFile(sftpId: string, remotePath: string, localPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = getSession(sftpId)

      session.sftp.fastGet(remotePath, localPath, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  writeFile(sftpId: string, localPath: string, remotePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = getSession(sftpId)

      session.sftp.fastPut(localPath, remotePath, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  mkdir(sftpId: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = getSession(sftpId)

      const attrs: InputAttributes = { mode: 0o755 }
      session.sftp.mkdir(path, attrs, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  delete(sftpId: string, path: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = getSession(sftpId)

      // Try unlink (file) first, fallback to rmdir
      session.sftp.unlink(path, (err) => {
        if (err) {
          session.sftp.rmdir(path, (rmdirErr) => {
            if (rmdirErr) {
              reject(rmdirErr)
              return
            }
            resolve()
          })
          return
        }
        resolve()
      })
    })
  }

  rename(sftpId: string, oldPath: string, newPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const session = getSession(sftpId)

      session.sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          reject(err)
          return
        }
        resolve()
      })
    })
  }

  stat(sftpId: string, path: string): Promise<SftpFileStat> {
    return new Promise((resolve, reject) => {
      const session = getSession(sftpId)

      session.sftp.stat(path, (err, stats) => {
        if (err) {
          reject(err)
          return
        }
        resolve(toFileStat(stats))
      })
    })
  }

  /**
   * Read a small remote text file fully into memory over a short-lived SFTP
   * channel on the live SSH session. Reuses the target's authenticated client,
   * so it works transparently through a JumpHost chain (the SFTP subsystem
   * rides the same tunneled session). Used by the internal Markdown viewer.
   *
   * Bounds the read by `maxBytes`: if the file is larger, only the first
   * `maxBytes` are returned and `truncated` is true. Throws with a stage-tagged
   * message on channel-open / stat / read failures.
   */
  readFileToString(
    sshSessionId: string,
    remotePath: string,
    maxBytes = 2_000_000
  ): Promise<{ content: string; bytes: number; truncated: boolean }> {
    return new Promise((resolve, reject) => {
      const sshSession = sshManager.getSession(sshSessionId)
      if (!sshSession) {
        reject(new Error(`SSH session ${sshSessionId} not found`))
        return
      }

      const host = sshSession.config.host
      const hops = sshSession.chainClients?.length ?? 0
      const hopLabel = hops > 0 ? `${hops} jump hop(s), ` : ''

      sshSession.client.sftp((openErr, sftp) => {
        if (openErr) {
          reject(new Error(`SFTP channel open failed (${hopLabel}target ${host}): ${openErr.message}`))
          return
        }

        const done = (err: Error | null, result?: { content: string; bytes: number; truncated: boolean }): void => {
          try { sftp.end() } catch { /* already closed */ }
          if (err) reject(err)
          else resolve(result!)
        }

        // SFTP does not expand `~` (that's a shell feature). Resolve it against
        // the user's home via realpath('.') before stat/read, matching the
        // behavior the user sees in their interactive shell.
        const withResolvedPath = (cb: (p: string) => void): void => {
          if (remotePath === '~' || remotePath.startsWith('~/')) {
            sftp.realpath('.', (rpErr, home) => {
              if (rpErr) {
                done(new Error(`SFTP realpath('.') failed on ${host}: ${rpErr.message}`))
                return
              }
              cb(remotePath === '~' ? home : `${home}/${remotePath.slice(2)}`)
            })
          } else {
            cb(remotePath)
          }
        }

        withResolvedPath((path) => {
        sftp.stat(path, (statErr, stats) => {
          if (statErr) {
            done(new Error(`SFTP stat ${path} failed on ${host}: ${statErr.message}`))
            return
          }
          if ((stats.mode & 0o170000) === 0o040000) {
            done(new Error(`${path} is a directory, not a file`))
            return
          }

          const totalSize = stats.size
          const stream = sftp.createReadStream(path, { start: 0, end: maxBytes - 1 })
          const chunks: Buffer[] = []
          let received = 0

          stream.on('data', (chunk: Buffer) => {
            received += chunk.length
            chunks.push(chunk)
          })
          stream.on('error', (readErr: Error) => {
            done(new Error(`SFTP read ${path} failed on ${host}: ${readErr.message}`))
          })
          stream.on('end', () => {
            const buf = Buffer.concat(chunks)
            done(null, {
              content: buf.toString('utf-8'),
              bytes: received,
              truncated: totalSize > received
            })
          })
        })
        })
      })
    })
  }

  closeSftp(sftpId: string): void {
    const session = sessions.get(sftpId)
    if (session) {
      session.sftp.end()
      sessions.delete(sftpId)
    }
  }

  closeAll(): void {
    for (const [id] of sessions) {
      this.closeSftp(id)
    }
  }

  isOpen(sftpId: string): boolean {
    return sessions.has(sftpId)
  }
}

export const sftpManager = new SftpManager()
