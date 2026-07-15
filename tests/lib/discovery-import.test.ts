import { describe, it, expect } from 'vitest'
import {
  discoveredHostToConnection,
  terraformHostToConnection,
  connectionsToTrayEntries
} from '../../src/renderer/src/lib/discovery-import'

describe('discoveredHostToConnection', () => {
  it('maps a discovered host to an SSH connection', () => {
    expect(
      discoveredHostToConnection({ name: 'web-1', host: '10.0.0.5', port: 22, user: 'ec2-user', type: 'aws' })
    ).toEqual({ name: 'web-1', method: 'ssh', host: '10.0.0.5', port: 22, username: 'ec2-user', authType: 'manual' })
  })

  it('falls back to host for a nameless entry and to port 22 / no user', () => {
    expect(
      discoveredHostToConnection({ name: '', host: '1.2.3.4', port: 0, user: '', type: 'docker' })
    ).toEqual({ name: '1.2.3.4', method: 'ssh', host: '1.2.3.4', port: 22, username: undefined, authType: 'manual' })
  })
})

describe('terraformHostToConnection', () => {
  it('prefers the public IP', () => {
    expect(
      terraformHostToConnection({ name: 'db', publicIp: '54.0.0.1', privateIp: '10.0.0.1' })
    ).toEqual({ name: 'db', method: 'ssh', host: '54.0.0.1', port: 22, authType: 'manual' })
  })

  it('falls back to the private IP when there is no public IP', () => {
    expect(terraformHostToConnection({ name: 'db', publicIp: '', privateIp: '10.0.0.1' })?.host).toBe('10.0.0.1')
  })

  it('returns null when the resource has no address', () => {
    expect(terraformHostToConnection({ name: 'db', publicIp: '', privateIp: '' })).toBeNull()
  })
})

describe('connectionsToTrayEntries', () => {
  const connections = [
    { id: 'a', name: 'Alpha', method: 'ssh', host: 'a.example' },
    { id: 'b', name: 'Beta', method: 'rdp', host: null }
  ]

  it('maps connections and flags favorites + last-used', () => {
    const entries = connectionsToTrayEntries(connections, ['a'], [{ id: 'b', timestamp: 999 }])
    expect(entries).toEqual([
      { id: 'a', name: 'Alpha', protocol: 'ssh', host: 'a.example', isFavorite: true, lastUsed: undefined },
      { id: 'b', name: 'Beta', protocol: 'rdp', host: '', isFavorite: false, lastUsed: 999 }
    ])
  })

  it('handles empty favorites and recents', () => {
    const entries = connectionsToTrayEntries(connections, [], [])
    expect(entries.every((e) => e.isFavorite === false && e.lastUsed === undefined)).toBe(true)
  })
})
