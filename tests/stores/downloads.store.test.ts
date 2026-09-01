import { describe, it, expect, beforeEach } from 'vitest'
import { useDownloadsStore } from '../../src/renderer/src/stores/downloads.store'

const rec = (name: string) => ({ name, remotePath: `/r/${name}`, localPath: `/l/${name}`, size: 10, host: 'h' })

describe('downloads.store', () => {
  beforeEach(() => {
    localStorage.clear()
    useDownloadsStore.setState({ downloads: [] })
  })

  it('adds downloads most-recent-first', () => {
    useDownloadsStore.getState().addDownloads([rec('a'), rec('b')])
    const d = useDownloadsStore.getState().downloads
    expect(d.map((x) => x.name)).toEqual(['a', 'b'])
    useDownloadsStore.getState().addDownloads([rec('c')])
    expect(useDownloadsStore.getState().downloads[0].name).toBe('c')
  })

  it('stamps id + timestamp and persists to localStorage', () => {
    useDownloadsStore.getState().addDownloads([rec('a')])
    const d = useDownloadsStore.getState().downloads[0]
    expect(d.id).toMatch(/^dl-/)
    expect(typeof d.timestamp).toBe('number')
    expect(JSON.parse(localStorage.getItem('bifrost:downloads') || '[]')).toHaveLength(1)
  })

  it('caps history at 200 entries', () => {
    useDownloadsStore.getState().addDownloads(Array.from({ length: 250 }, (_, i) => rec(`f${i}`)))
    expect(useDownloadsStore.getState().downloads).toHaveLength(200)
  })

  it('remove and clear work', () => {
    useDownloadsStore.getState().addDownloads([rec('a'), rec('b')])
    const id = useDownloadsStore.getState().downloads[0].id
    useDownloadsStore.getState().remove(id)
    expect(useDownloadsStore.getState().downloads).toHaveLength(1)
    useDownloadsStore.getState().clear()
    expect(useDownloadsStore.getState().downloads).toHaveLength(0)
  })

  it('ignores an empty add', () => {
    useDownloadsStore.getState().addDownloads([])
    expect(useDownloadsStore.getState().downloads).toHaveLength(0)
  })
})
