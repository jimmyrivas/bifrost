import { describe, it, expect } from 'vitest'
import {
  categoryOf,
  CATEGORY_OF_EVENT,
  CATEGORY_LABELS,
  CATEGORY_COLORS
} from '../../src/renderer/src/lib/audit-categories'

// Keep in sync with AuditEventType in src/main/services/audit-log.ts —
// this list is asserted against the mapping so a new event type without a
// category fails loudly here instead of silently landing in "other".
const ALL_EVENT_TYPES = [
  'connect',
  'disconnect',
  'auth_success',
  'auth_fail',
  'command',
  'error',
  'port_forward_start',
  'port_forward_stop',
  'host_key_verified',
  'host_key_rejected',
  'host_key_changed',
  'recording_start',
  'recording_stop',
  'session_log_start',
  'session_log_stop',
  'vault_password_changed',
  'key_file_stored',
  'mfa_prompt'
] as const

describe('audit category mapping', () => {
  it('covers every audit event type', () => {
    for (const t of ALL_EVENT_TYPES) {
      expect(CATEGORY_OF_EVENT[t], `event type "${t}" has no category`).toBeDefined()
    }
    expect(Object.keys(CATEGORY_OF_EVENT).sort()).toEqual([...ALL_EVENT_TYPES].sort())
  })

  it('maps capture lifecycle events to the captures category', () => {
    expect(categoryOf('recording_start')).toBe('captures')
    expect(categoryOf('session_log_stop')).toBe('captures')
  })

  it('sends unknown event types to the implicit other bucket', () => {
    expect(categoryOf('some_future_event')).toBe('other')
  })

  it('has a label and color for every category, including other', () => {
    const cats = new Set([...Object.values(CATEGORY_OF_EVENT), 'other'])
    for (const c of cats) {
      expect(CATEGORY_LABELS[c as keyof typeof CATEGORY_LABELS]).toBeTruthy()
      expect(CATEGORY_COLORS[c as keyof typeof CATEGORY_COLORS]).toMatch(/^#/)
    }
  })
})
