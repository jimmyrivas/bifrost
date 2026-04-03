/**
 * MCP Tools: SFTP file operations
 * Security Level: 1 (read), 2 (write/delete)
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { SFTPWrapper, FileEntry, Stats } from 'ssh2'
import { __sessions as sshSessions } from './ssh.tools'

interface ManagedSftpSession {
  id: string
  sshSessionId: string
  sftp: SFTPWrapper
}

const sftpSessions = new Map<string, ManagedSftpSession>()
let sftpCounter = 0

export function registerSftpTools(server: McpServer): void {
  server.tool(
    'sftp_open',
    'Open an SFTP session on an existing SSH connection for file operations.',
    {
      sshSessionId: z.string().describe('SSH session ID from ssh_connect')
    },
    async ({ sshSessionId }) => {
      const sshSession = sshSessions.get(sshSessionId)
      if (!sshSession) {
        return { content: [{ type: 'text' as const, text: `SSH session ${sshSessionId} not found` }], isError: true }
      }

      try {
        const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
          sshSession.client.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
            if (err) reject(err)
            else resolve(sftp)
          })
        })

        const sftpId = `mcp-sftp-${++sftpCounter}`
        sftpSessions.set(sftpId, { id: sftpId, sshSessionId, sftp })

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ sftpId, sshSessionId, status: 'open' })
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to open SFTP: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'sftp_list_directory',
    'List files and directories at a remote path via SFTP.',
    {
      sftpId: z.string().describe('SFTP session ID from sftp_open'),
      path: z.string().default('/').describe('Remote directory path to list')
    },
    async ({ sftpId, path }) => {
      const session = sftpSessions.get(sftpId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `SFTP session ${sftpId} not found` }], isError: true }
      }

      try {
        const entries = await new Promise<FileEntry[]>((resolve, reject) => {
          session.sftp.readdir(path, (err, list) => {
            if (err) reject(err)
            else resolve(list)
          })
        })

        const result = entries.map((e) => ({
          name: e.filename,
          size: e.attrs.size,
          isDirectory: (e.attrs.mode & 0o170000) === 0o040000,
          permissions: (e.attrs.mode & 0o7777).toString(8),
          modified: new Date(e.attrs.mtime * 1000).toISOString(),
          owner: e.attrs.uid,
          group: e.attrs.gid
        }))

        return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `SFTP readdir failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'sftp_read_file',
    'Read the contents of a remote file via SFTP. Limited to 1MB for safety.',
    {
      sftpId: z.string().describe('SFTP session ID'),
      remotePath: z.string().describe('Remote file path to read'),
      encoding: z.enum(['utf-8', 'base64']).default('utf-8').optional().describe('Output encoding')
    },
    async ({ sftpId, remotePath, encoding }) => {
      const session = sftpSessions.get(sftpId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `SFTP session ${sftpId} not found` }], isError: true }
      }

      try {
        // Check file size first
        const stats = await new Promise<Stats>((resolve, reject) => {
          session.sftp.stat(remotePath, (err, stats) => {
            if (err) reject(err)
            else resolve(stats)
          })
        })

        if (stats.size > 1024 * 1024) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Maximum is 1MB. Use sftp_download for larger files.`
              }
            ],
            isError: true
          }
        }

        const content = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = []
          const stream = session.sftp.createReadStream(remotePath)
          stream.on('data', (chunk: Buffer) => chunks.push(chunk))
          stream.on('end', () => resolve(Buffer.concat(chunks)))
          stream.on('error', reject)
        })

        const enc = encoding ?? 'utf-8'
        const text = enc === 'base64' ? content.toString('base64') : content.toString('utf-8')
        return { content: [{ type: 'text' as const, text }] }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `SFTP read failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )

  server.tool(
    'sftp_stat',
    'Get file or directory metadata (size, permissions, timestamps) via SFTP.',
    {
      sftpId: z.string().describe('SFTP session ID'),
      remotePath: z.string().describe('Remote path to stat')
    },
    async ({ sftpId, remotePath }) => {
      const session = sftpSessions.get(sftpId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `SFTP session ${sftpId} not found` }], isError: true }
      }

      try {
        const stats = await new Promise<Stats>((resolve, reject) => {
          session.sftp.stat(remotePath, (err, stats) => {
            if (err) reject(err)
            else resolve(stats)
          })
        })

        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  size: stats.size,
                  isDirectory: (stats.mode & 0o170000) === 0o040000,
                  permissions: (stats.mode & 0o7777).toString(8),
                  modified: new Date(stats.mtime * 1000).toISOString(),
                  accessed: new Date(stats.atime * 1000).toISOString(),
                  owner: stats.uid,
                  group: stats.gid
                },
                null,
                2
              )
            }
          ]
        }
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `SFTP stat failed: ${err instanceof Error ? err.message : String(err)}`
            }
          ],
          isError: true
        }
      }
    }
  )

  // --- Phase 2: Write operations (Security Level 2) ---

  server.tool(
    'sftp_write_file',
    'Write text content to a remote file via SFTP. Creates the file if it does not exist, overwrites if it does.',
    {
      sftpId: z.string().describe('SFTP session ID'),
      remotePath: z.string().describe('Remote file path to write'),
      content: z.string().describe('Text content to write'),
      mode: z.number().optional().describe('File permissions (octal, e.g. 0o644). Default: 0o644')
    },
    async ({ sftpId, remotePath, content, mode }) => {
      const session = sftpSessions.get(sftpId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `SFTP session ${sftpId} not found` }], isError: true }
      }

      try {
        const buffer = Buffer.from(content, 'utf-8')
        await new Promise<void>((resolve, reject) => {
          const stream = session.sftp.createWriteStream(remotePath, { mode: mode ?? 0o644 })
          stream.on('error', reject)
          stream.on('close', () => resolve())
          stream.end(buffer)
        })

        return {
          content: [
            { type: 'text' as const, text: `Written ${buffer.length} bytes to ${remotePath}` }
          ]
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `SFTP write failed: ${(err as Error).message}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'sftp_mkdir',
    'Create a directory on the remote host via SFTP.',
    {
      sftpId: z.string().describe('SFTP session ID'),
      remotePath: z.string().describe('Remote directory path to create')
    },
    async ({ sftpId, remotePath }) => {
      const session = sftpSessions.get(sftpId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `SFTP session ${sftpId} not found` }], isError: true }
      }

      try {
        await new Promise<void>((resolve, reject) => {
          session.sftp.mkdir(remotePath, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
        return { content: [{ type: 'text' as const, text: `Created directory: ${remotePath}` }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `SFTP mkdir failed: ${(err as Error).message}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'sftp_delete',
    'Delete a file or empty directory on the remote host via SFTP.',
    {
      sftpId: z.string().describe('SFTP session ID'),
      remotePath: z.string().describe('Remote path to delete'),
      isDirectory: z.boolean().default(false).optional().describe('Set true to remove a directory (must be empty)')
    },
    async ({ sftpId, remotePath, isDirectory }) => {
      const session = sftpSessions.get(sftpId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `SFTP session ${sftpId} not found` }], isError: true }
      }

      try {
        await new Promise<void>((resolve, reject) => {
          const cb = (err: Error | null | undefined): void => {
            if (err) reject(err)
            else resolve()
          }
          if (isDirectory) {
            session.sftp.rmdir(remotePath, cb)
          } else {
            session.sftp.unlink(remotePath, cb)
          }
        })
        return { content: [{ type: 'text' as const, text: `Deleted: ${remotePath}` }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `SFTP delete failed: ${(err as Error).message}` }],
          isError: true
        }
      }
    }
  )

  server.tool(
    'sftp_rename',
    'Rename or move a file/directory on the remote host via SFTP.',
    {
      sftpId: z.string().describe('SFTP session ID'),
      oldPath: z.string().describe('Current remote path'),
      newPath: z.string().describe('New remote path')
    },
    async ({ sftpId, oldPath, newPath }) => {
      const session = sftpSessions.get(sftpId)
      if (!session) {
        return { content: [{ type: 'text' as const, text: `SFTP session ${sftpId} not found` }], isError: true }
      }

      try {
        await new Promise<void>((resolve, reject) => {
          session.sftp.rename(oldPath, newPath, (err) => {
            if (err) reject(err)
            else resolve()
          })
        })
        return { content: [{ type: 'text' as const, text: `Renamed: ${oldPath} → ${newPath}` }] }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `SFTP rename failed: ${(err as Error).message}` }],
          isError: true
        }
      }
    }
  )
}

// Expose internal sessions for sftp_open to access SSH clients
// This is accessed by the ssh.tools module
export function getSftpSession(id: string): ManagedSftpSession | undefined {
  return sftpSessions.get(id)
}

export function cleanupAllSftpSessions(): void {
  sftpSessions.clear()
}
