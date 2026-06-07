import { clipboard } from 'electron'
import type { SFTPWrapper } from 'ssh2'
import { sshManager } from './ssh-manager'

/**
 * Pasted-image upload: when the user pastes an image while attached to an SSH
 * session, write it to the remote host over a fresh SFTP channel on the SAME
 * (already authenticated) ssh2 client, and hand back the absolute remote path
 * so the renderer can type it into the terminal.
 */

interface SessionUploads {
  paths: string[]
  deleteOnClose: boolean
}

// sshSessionId -> uploaded remote paths flagged for cleanup on quit
const uploads = new Map<string, SessionUploads>()

function openSftp(client: { sftp: (cb: (err: Error | undefined, sftp: SFTPWrapper) => void) => void }): Promise<SFTPWrapper> {
  return new Promise((resolve, reject) => {
    client.sftp((err, sftp) => (err ? reject(err) : resolve(sftp)))
  })
}

function realpath(sftp: SFTPWrapper, p: string): Promise<string> {
  return new Promise((resolve, reject) => {
    sftp.realpath(p, (err, abs) => (err ? reject(err) : resolve(abs)))
  })
}

/** Recursive mkdir over SFTP. Ignores per-segment errors (e.g. already exists). */
async function mkdirp(sftp: SFTPWrapper, dir: string): Promise<void> {
  const absolute = dir.startsWith('/')
  const parts = dir.split('/').filter(Boolean)
  let cur = absolute ? '' : '.'
  for (const part of parts) {
    cur = cur === '' ? `/${part}` : `${cur}/${part}`
    await new Promise<void>((resolve) => sftp.mkdir(cur, () => resolve()))
  }
}

function writeBuffer(sftp: SFTPWrapper, remotePath: string, data: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    sftp.writeFile(remotePath, data, (err) => (err ? reject(err) : resolve()))
  })
}

function timestamp(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}

export function hasClipboardImage(): boolean {
  return !clipboard.readImage().isEmpty()
}

/**
 * Upload the current clipboard image to the remote host of `sshSessionId`.
 * Returns the absolute remote path, or null if the clipboard has no image.
 */
export async function pasteImageToRemote(
  sshSessionId: string,
  remoteDir: string,
  deleteOnClose: boolean
): Promise<string | null> {
  const image = clipboard.readImage()
  if (image.isEmpty()) return null

  const session = sshManager.getSession(sshSessionId)
  if (!session) throw new Error(`SSH session ${sshSessionId} not found`)

  const buf = image.toPNG()
  const sftp = await openSftp(session.client)
  try {
    let dir = (remoteDir || '~/.bifrost/pastes').trim().replace(/\/+$/, '')
    if (dir === '~' || dir.startsWith('~/')) {
      const home = await realpath(sftp, '.')
      dir = dir === '~' ? home : `${home}/${dir.slice(2)}`
    }
    await mkdirp(sftp, dir)

    const name = `paste-${timestamp()}-${Math.random().toString(36).slice(2, 6)}.png`
    const remotePath = `${dir}/${name}`
    await writeBuffer(sftp, remotePath, buf)

    if (deleteOnClose) {
      const entry = uploads.get(sshSessionId) ?? { paths: [], deleteOnClose: true }
      entry.paths.push(remotePath)
      entry.deleteOnClose = true
      uploads.set(sshSessionId, entry)
    }
    return remotePath
  } finally {
    sftp.end()
  }
}

/** True if any uploads are flagged for deletion (cheap pre-check on quit). */
export function hasPendingCleanup(): boolean {
  for (const entry of uploads.values()) {
    if (entry.deleteOnClose && entry.paths.length > 0) return true
  }
  return false
}

/**
 * Delete every upload flagged with deleteOnClose, using the still-alive SSH
 * sessions. Best-effort and time-bounded so app shutdown can't hang on it.
 */
export async function cleanupImagePastes(): Promise<void> {
  const work = (async (): Promise<void> => {
    for (const [sshSessionId, entry] of uploads) {
      if (!entry.deleteOnClose || entry.paths.length === 0) continue
      const session = sshManager.getSession(sshSessionId)
      if (!session) continue
      try {
        const sftp = await openSftp(session.client)
        for (const p of entry.paths) {
          await new Promise<void>((resolve) => sftp.unlink(p, () => resolve()))
        }
        sftp.end()
      } catch {
        /* best-effort */
      }
    }
    uploads.clear()
  })()

  const timeout = new Promise<void>((resolve) => setTimeout(resolve, 3000))
  await Promise.race([work, timeout])
}
