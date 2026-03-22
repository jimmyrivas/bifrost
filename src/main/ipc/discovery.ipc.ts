import { ipcMain } from 'electron'
import {
  discoverAWS,
  discoverGCP,
  discoverDocker,
  discoverKubernetes,
  checkAvailableClis,
  type DiscoveredHost
} from '../services/cloud-discovery'

export function registerDiscoveryIpc(): void {
  ipcMain.handle('discovery:aws', async (): Promise<DiscoveredHost[]> => {
    try {
      return await discoverAWS()
    } catch (err) {
      throw new Error(
        `AWS discovery failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  ipcMain.handle('discovery:gcp', async (): Promise<DiscoveredHost[]> => {
    try {
      return await discoverGCP()
    } catch (err) {
      throw new Error(
        `GCP discovery failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  ipcMain.handle('discovery:docker', async (): Promise<DiscoveredHost[]> => {
    try {
      return await discoverDocker()
    } catch (err) {
      throw new Error(
        `Docker discovery failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  ipcMain.handle('discovery:kubernetes', async (): Promise<DiscoveredHost[]> => {
    try {
      return await discoverKubernetes()
    } catch (err) {
      throw new Error(
        `Kubernetes discovery failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
  })

  ipcMain.handle(
    'discovery:available',
    async (): Promise<Record<string, boolean>> => {
      try {
        return await checkAvailableClis()
      } catch (err) {
        console.error('CLI availability check failed:', err)
        return { aws: false, gcloud: false, docker: false, kubectl: false }
      }
    }
  )
}
