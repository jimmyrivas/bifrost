import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useConnectionsStore } from '../../src/renderer/src/stores/connections.store'

// Mock window.bifrost
const mockBifrost = {
  connections: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue('conn-1'),
    update: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    reorder: vi.fn().mockResolvedValue(undefined),
    listGroups: vi.fn().mockResolvedValue([]),
    createGroup: vi.fn().mockResolvedValue('group-1'),
    updateGroup: vi.fn().mockResolvedValue(undefined),
    deleteGroup: vi.fn().mockResolvedValue(undefined)
  }
}

vi.stubGlobal('window', { bifrost: mockBifrost })

describe('Connections Store', () => {
  beforeEach(() => {
    useConnectionsStore.setState({
      connections: [],
      groups: [],
      loading: false,
      selectedConnectionId: null
    })
    vi.clearAllMocks()
  })

  it('fetches connections from IPC', async () => {
    const mockConns = [
      { id: 'c1', name: 'Server 1', method: 'ssh', host: '192.168.1.1', groupId: null, port: 22, authType: 'userpass', username: 'root', sortOrder: 0 }
    ]
    mockBifrost.connections.list.mockResolvedValueOnce(mockConns)

    await useConnectionsStore.getState().fetchConnections()

    expect(mockBifrost.connections.list).toHaveBeenCalled()
    expect(useConnectionsStore.getState().connections).toEqual(mockConns)
    expect(useConnectionsStore.getState().loading).toBe(false)
  })

  it('fetches groups from IPC', async () => {
    const mockGroups = [{ id: 'g1', name: 'Production', parentId: null, sortOrder: 0, icon: null }]
    mockBifrost.connections.listGroups.mockResolvedValueOnce(mockGroups)

    await useConnectionsStore.getState().fetchGroups()

    expect(mockBifrost.connections.listGroups).toHaveBeenCalled()
    expect(useConnectionsStore.getState().groups).toEqual(mockGroups)
  })

  it('creates a connection and refreshes list', async () => {
    const newConn = { name: 'Test', method: 'ssh' as const, host: '10.0.0.1', groupId: null, port: 22, authType: 'userpass' as const, username: 'admin' }
    mockBifrost.connections.create.mockResolvedValueOnce('new-id')
    mockBifrost.connections.list.mockResolvedValueOnce([{ id: 'new-id', ...newConn, sortOrder: 0 }])

    const id = await useConnectionsStore.getState().createConnection(newConn)

    expect(id).toBe('new-id')
    expect(mockBifrost.connections.create).toHaveBeenCalled()
    expect(useConnectionsStore.getState().connections).toHaveLength(1)
  })

  it('deletes a connection and clears selection', async () => {
    useConnectionsStore.setState({
      connections: [{ id: 'c1', name: 'Server', method: 'ssh', host: '10.0.0.1', groupId: null, port: 22, authType: null, username: null, sortOrder: 0 }],
      selectedConnectionId: 'c1'
    })
    mockBifrost.connections.list.mockResolvedValueOnce([])

    await useConnectionsStore.getState().deleteConnection('c1')

    expect(mockBifrost.connections.delete).toHaveBeenCalledWith('c1')
    expect(useConnectionsStore.getState().connections).toHaveLength(0)
    expect(useConnectionsStore.getState().selectedConnectionId).toBeNull()
  })

  it('sets selected connection', () => {
    useConnectionsStore.getState().setSelectedConnection('c1')
    expect(useConnectionsStore.getState().selectedConnectionId).toBe('c1')

    useConnectionsStore.getState().setSelectedConnection(null)
    expect(useConnectionsStore.getState().selectedConnectionId).toBeNull()
  })

  it('creates a group and refreshes list', async () => {
    mockBifrost.connections.createGroup.mockResolvedValueOnce('g1')
    mockBifrost.connections.listGroups.mockResolvedValueOnce([{ id: 'g1', name: 'Prod', parentId: null, sortOrder: 0, icon: null }])

    const id = await useConnectionsStore.getState().createGroup({ name: 'Prod', parentId: null, icon: null })

    expect(id).toBe('g1')
    expect(useConnectionsStore.getState().groups).toHaveLength(1)
  })
})
