import { ipcMain } from 'electron'
import {
  discoverAWS,
  discoverGCP,
  discoverAzure,
  discoverDocker,
  discoverPodman,
  discoverKubernetes,
  checkAvailableClis,
  type DiscoveredHost
} from '../services/cloud-discovery'
import { parseTerraformState, type TerraformHost } from '../services/terraform-parser'

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

  ipcMain.handle('discovery:azure', async (): Promise<DiscoveredHost[]> => {
    try {
      return await discoverAzure()
    } catch (err) {
      throw new Error(
        `Azure discovery failed: ${err instanceof Error ? err.message : String(err)}`
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

  ipcMain.handle('discovery:podman', async (): Promise<DiscoveredHost[]> => {
    try {
      return await discoverPodman()
    } catch (err) {
      throw new Error(
        `Podman discovery failed: ${err instanceof Error ? err.message : String(err)}`
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
    'discovery:terraform',
    async (_event, filePath: string): Promise<TerraformHost[]> => {
      try {
        return parseTerraformState(filePath)
      } catch (err) {
        throw new Error(
          `Terraform state parsing failed: ${err instanceof Error ? err.message : String(err)}`
        )
      }
    }
  )

  ipcMain.handle(
    'discovery:available',
    async (): Promise<Record<string, boolean>> => {
      try {
        return await checkAvailableClis()
      } catch (err) {
        console.error('CLI availability check failed:', err)
        return { aws: false, gcloud: false, az: false, docker: false, podman: false, kubectl: false }
      }
    }
  )
}
