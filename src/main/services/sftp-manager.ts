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
