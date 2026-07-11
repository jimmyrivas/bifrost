import type { AuditEventType } from '../../../main/services/audit-log'

/**
 * Category chips used by the Activity view's timeline filter. Every audit
 * event type maps to exactly one category; types this map doesn't know about
 * (future additions) fall into the implicit `other` bucket so new events
 * never silently disappear from the timeline.
 */
export type AuditCategory =
  | 'sessions'
  | 'auth'
  | 'security'
  | 'tunnels'
  | 'captures'
  | 'automation'
  | 'errors'
  | 'other'

export const CATEGORY_OF_EVENT: Record<AuditEventType, Exclude<AuditCategory, 'other'>> = {
  connect: 'sessions',
  disconnect: 'sessions',
  auth_success: 'auth',
  auth_fail: 'auth',
  mfa_prompt: 'auth',
  host_key_verified: 'security',
  host_key_rejected: 'security',
  host_key_changed: 'security',
  vault_password_changed: 'security',
  key_file_stored: 'security',
  port_forward_start: 'tunnels',
  port_forward_stop: 'tunnels',
  recording_start: 'captures',
  recording_stop: 'captures',
  session_log_start: 'captures',
  session_log_stop: 'captures',
  command: 'automation',
  error: 'errors'
}

export function categoryOf(event: string): AuditCategory {
  return CATEGORY_OF_EVENT[event as AuditEventType] ?? 'other'
}

export const CATEGORY_LABELS: Record<AuditCategory, string> = {
  sessions: 'Sessions',
  auth: 'Auth',
  security: 'Security',
  tunnels: 'Tunnels',
  captures: 'Captures',
  automation: 'Automation',
  errors: 'Errors',
  other: 'Other'
}

/** Spectral-palette accent per category (chip + timeline dot). */
export const CATEGORY_COLORS: Record<AuditCategory, string> = {
  sessions: '#6bff6b',
  auth: '#ffd56b',
  security: '#d56bff',
  tunnels: '#6bd5ff',
  captures: '#ff6b6b',
  automation: '#ffa36b',
  errors: '#ef4444',
  other: '#c7c4d7'
}
