import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join, basename } from 'path'
import { rmSync, mkdirSync } from 'fs'

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
})
