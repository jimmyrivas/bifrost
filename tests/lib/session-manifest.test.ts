import { describe, it, expect } from 'vitest'
import {
  isRestorable,
  toManifestTab,
  deriveManifest
} from '../../src/renderer/src/lib/session-manifest'
import type { Tab } from '../../src/renderer/src/stores/sessions.store'

function makeTab(over: Partial<Tab>): Tab {
  return {
    id: 'tab-x',
    title: 'T',
    rootPane: { id: 'pane-x', terminalId: 'term-x' } as Tab['rootPane'],
    isActive: false,
    connectionId: null,
    lockTitle: false,
    ...over
  }
}

describe('isRestorable', () => {
  it('connection tabs are always restorable', () => {
    expect(isRestorable({ connectionId: 'c1' }, false)).toBe(true)
    expect(isRestorable({ connectionId: 'c1' }, true)).toBe(true)
  })

  it('local tabs are restorable only when the local multiplexer is enabled', () => {
    expect(isRestorable({ connectionId: null }, true)).toBe(true)
    expect(isRestorable({ connectionId: null }, false)).toBe(false)
  })
})

describe('toManifestTab', () => {
  it('keeps only restorable, non-ephemeral fields', () => {
    const tab = makeTab({
      id: 'tab-9',
      connectionId: 'c1',
      title: 'web-01',
      lockTitle: true,
      terminalStyle: { fontSize: 16 },
      shell: '/bin/zsh',
      shellArgs: ['-l'],
      aiDetected: 'claude',
      aiCwd: 'bifrost'
    })
    const m = toManifestTab(tab)
    expect(m).toEqual({
      connectionId: 'c1',
      title: 'web-01',
      lockTitle: true,
      terminalStyle: { fontSize: 16 },
      shell: '/bin/zsh',
      shellArgs: ['-l']
    })
    // ephemeral fields are not carried over
    expect('id' in m).toBe(false)
    expect('rootPane' in m).toBe(false)
    expect('isActive' in m).toBe(false)
    expect('aiDetected' in m).toBe(false)
  })
})

describe('deriveManifest', () => {
  const conn = makeTab({ id: 't1', connectionId: 'c1', title: 'ssh-1' })
  const localPlain = makeTab({ id: 't2', connectionId: null, title: 'local-1' })
  const conn2 = makeTab({ id: 't3', connectionId: 'c2', title: 'ssh-2' })

  it('drops non-multiplexed local tabs when local mux is off', () => {
    const m = deriveManifest([conn, localPlain, conn2], 't3', false)
    expect(m.tabs.map((t) => t.title)).toEqual(['ssh-1', 'ssh-2'])
  })

  it('keeps local tabs when local mux is on', () => {
    const m = deriveManifest([conn, localPlain], 't1', true)
    expect(m.tabs.map((t) => t.title)).toEqual(['ssh-1', 'local-1'])
  })

  it('computes activeIndex against the filtered list', () => {
    // active is t3 (conn2); with localPlain filtered out, conn2 is index 1
    const m = deriveManifest([conn, localPlain, conn2], 't3', false)
    expect(m.activeIndex).toBe(1)
  })

  it('falls back to index 0 when the active tab is not restorable', () => {
    const m = deriveManifest([conn, localPlain], 't2', false)
    expect(m.activeIndex).toBe(0)
  })

  it('produces an empty manifest when nothing is restorable', () => {
    const m = deriveManifest([localPlain], 't2', false)
    expect(m.tabs).toEqual([])
  })
})
