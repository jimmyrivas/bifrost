import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join, basename } from 'path'
import { rmSync, mkdirSync, writeFileSync, existsSync, utimesSync } from 'fs'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/bifrost-test-logger') }
}))

import { SessionLogger } from '../../src/main/services/session-logger'

const testLogDir = '/tmp/bifrost-test-logger'

describe('SessionLogger', () => {
  let logger: SessionLogger

  beforeEach(() => {
    rmSync(testLogDir, { recursive: true, force: true })
    mkdirSync(testLogDir, { recursive: true })
    logger = new SessionLogger()
  })

  afterEach(() => {
    logger.stopAll()
    rmSync(testLogDir, { recursive: true, force: true })
  })

  it('returns path with connection name from pattern', () => {
    const path = logger.startLogging('s1', '%N_%Y%M%D', {
      name: 'prod-server',
      host: '10.0.0.1',
      user: 'root'
    })
    expect(path).toContain('prod-server')
    expect(path).toMatch(/\.log$/)
  })

  it('returns correct log directory path', () => {
    expect(logger.getLogDir()).toBe(join(testLogDir, 'session-logs'))
  })

  it('sanitizes special characters in filename', () => {
    const path = logger.startLogging('s1', 'bad:name*test', { name: 'test' })
    const filename = basename(path)
    expect(filename).not.toContain(':')
    expect(filename).not.toContain('*')
    expect(filename).toMatch(/\.log$/)
  })

  it('appends .log extension when missing', () => {
    const path = logger.startLogging('s1', 'noext', { name: 'test' })
    expect(path).toMatch(/\.log$/)
  })

  it('replaces pattern variables', () => {
    const path = logger.startLogging('s1', '%N_%h_%U', {
      name: 'myserver',
      host: '10.0.0.1',
      user: 'admin'
    })
    expect(basename(path)).toContain('myserver')
    expect(basename(path)).toContain('10.0.0.1') // dots preserved in filenames
    expect(basename(path)).toContain('admin')
  })

  it('stopAll does not throw', () => {
    logger.startLogging('s1', 'a', { name: 'a' })
    logger.startLogging('s2', 'b', { name: 'b' })
    expect(() => logger.stopAll()).not.toThrow()
  })

  describe('listLogs', () => {
    it('lists only .log files, newest first', () => {
      const dir = logger.getLogDir()
      writeFileSync(join(dir, 'older.log'), 'a')
      writeFileSync(join(dir, 'notes.txt'), 'not a log')
      // Ensure a strictly newer mtime for the second log.
      const newer = join(dir, 'newer.log')
      writeFileSync(newer, 'bb')
      // Set an explicitly newer mtime to avoid same-millisecond ties.
      const future = new Date(Date.now() + 5000)
      utimesSync(newer, future, future)

      const logs = logger.listLogs()
      expect(logs.map((l) => l.name)).toEqual(['newer.log', 'older.log'])
      expect(logs[0].size).toBe(2)
      expect(logs.every((l) => !l.active)).toBe(true)
    })

    it('flags a log that is actively being written', () => {
      const dir = logger.getLogDir()
      writeFileSync(join(dir, 'active-test.log'), 'seed')
      logger.startLogging('s1', 'active-test', { name: 'x' })

      const entry = logger.listLogs().find((l) => l.name === 'active-test.log')
      expect(entry?.active).toBe(true)
    })
  })

  describe('deleteLog', () => {
    it('refuses paths outside the session-logs directory', () => {
      expect(logger.deleteLog('/etc/passwd')).toBe(false)
      expect(logger.deleteLog(join(logger.getLogDir(), '..', 'escape.log'))).toBe(false)
      expect(logger.deleteLog(logger.getLogDir())).toBe(false)
    })

    it('refuses to delete an active log, allows it after stop', () => {
      const dir = logger.getLogDir()
      const filePath = join(dir, 'busy.log')
      writeFileSync(filePath, 'seed')
      logger.startLogging('s1', 'busy', { name: 'x' })

      expect(logger.deleteLog(filePath)).toBe(false)
      expect(existsSync(filePath)).toBe(true)

      logger.stopLogging('s1')
      expect(logger.deleteLog(filePath)).toBe(true)
      expect(existsSync(filePath)).toBe(false)
    })

    it('deletes an inactive log file', () => {
      const filePath = join(logger.getLogDir(), 'done.log')
      writeFileSync(filePath, 'finished')
      expect(logger.deleteLog(filePath)).toBe(true)
      expect(existsSync(filePath)).toBe(false)
    })
  })
})
