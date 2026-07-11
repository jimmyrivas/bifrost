import { describe, it, expect, vi } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/bifrost-test-audit') }
}))

import { auditEventsToCsv, type AuditEvent } from '../../src/main/services/audit-log'

function event(overrides: Partial<AuditEvent>): AuditEvent {
  return {
    timestamp: '2026-07-11T05:00:00.000Z',
    connectionId: 'c1',
    connectionName: 'prod-web',
    host: '10.0.0.5',
    event: 'connect',
    details: {},
    ...overrides
  }
}

describe('auditEventsToCsv', () => {
  it('emits a header and one row per event', () => {
    const csv = auditEventsToCsv([event({}), event({ event: 'disconnect' })])
    const lines = csv.trim().split('\r\n')
    expect(lines[0]).toBe('timestamp,event,connectionId,connectionName,host,details')
    expect(lines).toHaveLength(3)
    expect(lines[1]).toContain('connect')
    expect(lines[2]).toContain('disconnect')
  })

  it('quotes fields containing commas and doubles embedded quotes (RFC 4180)', () => {
    const csv = auditEventsToCsv([
      event({ connectionName: 'web, primary', host: 'say "hi"' })
    ])
    const row = csv.trim().split('\r\n')[1]
    expect(row).toContain('"web, primary"')
    expect(row).toContain('"say ""hi"""')
  })

  it('serializes the details payload as one JSON column', () => {
    const csv = auditEventsToCsv([
      event({ details: { filePath: '/x/y.log', reason: 'session_closed' } })
    ])
    const row = csv.trim().split('\r\n')[1]
    // The JSON contains commas and quotes, so the column must be quoted.
    expect(row).toContain('""filePath"":""/x/y.log""')
  })

  it('handles an empty event list', () => {
    const csv = auditEventsToCsv([])
    expect(csv.trim()).toBe('timestamp,event,connectionId,connectionName,host,details')
  })
})
