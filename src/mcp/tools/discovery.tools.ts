/**
 * MCP Tools: Infrastructure discovery (AWS, GCP, Azure, Docker, K8s, Terraform)
 * Security Level: 1 (execute — runs CLI commands)
 *
 * Reimplements cloud-discovery.ts logic without Electron dependencies.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { execFile, execFileSync } from 'child_process'
import { promisify } from 'util'
import { readFileSync, existsSync } from 'fs'

const execFileAsync = promisify(execFile)

function commandExists(cmd: string): boolean {
  try {
    const checker = process.platform === 'win32' ? 'where' : 'which'
    execFileSync(checker, [cmd], { encoding: 'utf-8', timeout: 3000, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

async function runJsonCommand(command: string, args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024
  })
  return JSON.parse(stdout)
}

interface DiscoveredHost {
  name: string
  host: string
  port: number
  user: string
  type: string
  metadata: Record<string, string>
}

export function registerDiscoveryTools(server: McpServer): void {
  server.tool(
    'discover_available',
    'Check which cloud/container CLI tools are available on this system.',
    {},
    async () => {
      const clis: Record<string, boolean> = {
        aws: commandExists('aws'),
        gcloud: commandExists('gcloud'),
        az: commandExists('az'),
        docker: commandExists('docker'),
        podman: commandExists('podman'),
        kubectl: commandExists('kubectl'),
        terraform: commandExists('terraform')
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(clis, null, 2) }]
      }
    }
  )

  server.tool(
    'discover_aws',
    'Discover running EC2 instances via AWS CLI. Requires configured AWS credentials.',
    {},
    async () => {
      if (!commandExists('aws')) {
        return { content: [{ type: 'text' as const, text: 'AWS CLI (aws) not found on PATH' }], isError: true }
      }
      try {
        const result = (await runJsonCommand('aws', [
          'ec2', 'describe-instances', '--output', 'json',
          '--query', 'Reservations[].Instances[]'
        ])) as Array<Record<string, unknown>>

        const hosts: DiscoveredHost[] = []
        for (const instance of result) {
          const state = instance['State'] as Record<string, string> | undefined
          if (state?.Name !== 'running') continue
          const instanceId = (instance['InstanceId'] as string) ?? 'unknown'
          const publicIp = instance['PublicIpAddress'] as string | undefined
          const privateIp = instance['PrivateIpAddress'] as string | undefined
          const host = publicIp ?? privateIp
          if (!host) continue
          const tags = (instance['Tags'] as Array<{ Key: string; Value: string }>) ?? []
          const nameTag = tags.find((t) => t.Key === 'Name')
          hosts.push({
            name: nameTag?.Value ?? instanceId,
            host, port: 22, user: 'ec2-user', type: 'aws',
            metadata: {
              instanceId,
              instanceType: (instance['InstanceType'] as string) ?? '',
              az: (instance['Placement'] as Record<string, string>)?.AvailabilityZone ?? '',
              publicIp: publicIp ?? '', privateIp: privateIp ?? ''
            }
          })
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(hosts, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `AWS discovery failed: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    'discover_gcp',
    'Discover running GCP Compute Engine instances via gcloud CLI.',
    {},
    async () => {
      if (!commandExists('gcloud')) {
        return { content: [{ type: 'text' as const, text: 'gcloud CLI not found on PATH' }], isError: true }
      }
      try {
        const result = (await runJsonCommand('gcloud', [
          'compute', 'instances', 'list', '--format=json'
        ])) as Array<Record<string, unknown>>

        const hosts: DiscoveredHost[] = []
        for (const instance of result) {
          if ((instance['status'] as string) !== 'RUNNING') continue
          const name = (instance['name'] as string) ?? 'unknown'
          const netIfaces = (instance['networkInterfaces'] as Array<Record<string, unknown>>) ?? []
          let externalIp = '', internalIp = ''
          if (netIfaces.length > 0) {
            internalIp = (netIfaces[0]['networkIP'] as string) ?? ''
            const ac = (netIfaces[0]['accessConfigs'] as Array<Record<string, string>>) ?? []
            if (ac.length > 0) externalIp = ac[0]['natIP'] ?? ''
          }
          const host = externalIp || internalIp
          if (!host) continue
          hosts.push({
            name, host, port: 22, user: '', type: 'gcp',
            metadata: {
              zone: ((instance['zone'] as string) ?? '').split('/').pop() ?? '',
              machineType: ((instance['machineType'] as string) ?? '').split('/').pop() ?? '',
              externalIp, internalIp
            }
          })
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(hosts, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `GCP discovery failed: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    'discover_azure',
    'Discover running Azure VMs via az CLI.',
    {},
    async () => {
      if (!commandExists('az')) {
        return { content: [{ type: 'text' as const, text: 'Azure CLI (az) not found on PATH' }], isError: true }
      }
      try {
        const result = (await runJsonCommand('az', ['vm', 'list', '-d', '--output', 'json'])) as Array<Record<string, unknown>>
        const hosts: DiscoveredHost[] = []
        for (const vm of result) {
          const powerState = (vm['powerState'] as string) ?? ''
          if (!powerState.toLowerCase().includes('running')) continue
          const name = (vm['name'] as string) ?? 'unknown'
          const publicIps = (vm['publicIps'] as string) ?? ''
          const privateIps = (vm['privateIps'] as string) ?? ''
          const host = publicIps.split(',')[0]?.trim() || privateIps.split(',')[0]?.trim()
          if (!host) continue
          const osType = (vm['osType'] as string) ?? ''
          hosts.push({
            name, host, port: 22,
            user: osType.toLowerCase() === 'windows' ? '' : 'azureuser',
            type: 'azure',
            metadata: {
              publicIps, privateIps, osType,
              location: (vm['location'] as string) ?? '',
              resourceGroup: (vm['resourceGroup'] as string) ?? '',
              vmSize: (vm['hardwareProfile'] as Record<string, string>)?.['vmSize'] ?? ''
            }
          })
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(hosts, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Azure discovery failed: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    'discover_docker',
    'Discover running Docker containers.',
    {},
    async () => {
      if (!commandExists('docker')) {
        return { content: [{ type: 'text' as const, text: 'Docker CLI not found on PATH' }], isError: true }
      }
      try {
        const { stdout } = await execFileAsync('docker', ['ps', '--format', '{{json .}}'], {
          timeout: 15000, maxBuffer: 5 * 1024 * 1024
        })
        const hosts: DiscoveredHost[] = []
        for (const line of stdout.trim().split('\n').filter(Boolean)) {
          try {
            const c = JSON.parse(line) as Record<string, string>
            const id = c['ID'] ?? ''
            const name = (c['Names'] ?? c['Name'] ?? id).replace(/^\//, '')
            const ports = c['Ports'] ?? ''
            const sshMatch = ports.match(/0\.0\.0\.0:(\d+)->22\/tcp/)
            hosts.push({
              name, host: '127.0.0.1', port: sshMatch ? parseInt(sshMatch[1], 10) : 22,
              user: 'root', type: 'docker',
              metadata: { containerId: id, image: c['Image'] ?? '', ports, status: c['Status'] ?? '' }
            })
          } catch { /* skip */ }
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(hosts, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Docker discovery failed: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    'discover_kubernetes',
    'Discover running Kubernetes pods via kubectl.',
    {},
    async () => {
      if (!commandExists('kubectl')) {
        return { content: [{ type: 'text' as const, text: 'kubectl not found on PATH' }], isError: true }
      }
      try {
        const result = (await runJsonCommand('kubectl', [
          'get', 'pods', '--all-namespaces', '-o', 'json'
        ])) as { items: Array<Record<string, unknown>> }
        const hosts: DiscoveredHost[] = []
        for (const pod of result.items ?? []) {
          const meta = pod['metadata'] as Record<string, string> | undefined
          const status = pod['status'] as Record<string, unknown> | undefined
          const phase = (status?.phase as string) ?? ''
          const podIP = (status?.podIP as string) ?? ''
          if (phase !== 'Running' || !podIP) continue
          const name = meta?.name ?? 'unknown'
          const namespace = meta?.namespace ?? 'default'
          hosts.push({
            name: `${namespace}/${name}`, host: podIP, port: 22, user: '', type: 'kubernetes',
            metadata: { namespace, podName: name, podIP, nodeName: (pod['spec'] as Record<string, string>)?.nodeName ?? '' }
          })
        }
        return { content: [{ type: 'text' as const, text: JSON.stringify(hosts, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `K8s discovery failed: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    'discover_terraform',
    'Parse a Terraform state file (.tfstate) and extract compute instances with IPs.',
    {
      filePath: z.string().describe('Path to .tfstate file')
    },
    async ({ filePath }) => {
      if (!existsSync(filePath)) {
        return { content: [{ type: 'text' as const, text: `File not found: ${filePath}` }], isError: true }
      }
      try {
        const content = readFileSync(filePath, 'utf-8')
        const state = JSON.parse(content) as {
          version: number
          resources?: Array<{ type: string; name: string; instances?: Array<{ attributes?: Record<string, unknown> }> }>
        }

        const COMPUTE_TYPES = new Set([
          'aws_instance', 'google_compute_instance',
          'azurerm_virtual_machine', 'azurerm_linux_virtual_machine', 'azurerm_windows_virtual_machine'
        ])

        const hosts: Array<{ name: string; type: string; publicIp: string; privateIp: string; metadata: Record<string, string> }> = []

        if (state.version === 4 && state.resources) {
          for (const resource of state.resources) {
            if (!COMPUTE_TYPES.has(resource.type)) continue
            for (const inst of resource.instances ?? []) {
              const attrs = inst.attributes ?? {}
              let publicIp = '', privateIp = ''
              if (resource.type === 'aws_instance') {
                publicIp = (attrs['public_ip'] as string) ?? ''
                privateIp = (attrs['private_ip'] as string) ?? ''
              } else if (resource.type === 'google_compute_instance') {
                const ni = (attrs['network_interface'] as Array<Record<string, unknown>>) ?? []
                if (ni.length > 0) {
                  privateIp = (ni[0]['network_ip'] as string) ?? ''
                  const ac = (ni[0]['access_config'] as Array<Record<string, string>>) ?? []
                  if (ac.length > 0) publicIp = ac[0]['nat_ip'] ?? ''
                }
              } else {
                publicIp = (attrs['public_ip_address'] as string) ?? ''
                privateIp = (attrs['private_ip_address'] as string) ?? ''
              }
              if (publicIp || privateIp) {
                hosts.push({
                  name: resource.name, type: resource.type,
                  publicIp, privateIp,
                  metadata: { id: (attrs['id'] as string) ?? '' }
                })
              }
            }
          }
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify(hosts, null, 2) }] }
      } catch (err) {
        return { content: [{ type: 'text' as const, text: `Terraform parse failed: ${(err as Error).message}` }], isError: true }
      }
    }
  )

  server.tool(
    'discover_all',
    'Run discovery across all available cloud providers and container runtimes. Returns a unified inventory.',
    {},
    async () => {
      const available: Record<string, boolean> = {
        aws: commandExists('aws'),
        gcloud: commandExists('gcloud'),
        az: commandExists('az'),
        docker: commandExists('docker'),
        podman: commandExists('podman'),
        kubectl: commandExists('kubectl')
      }

      const inventory: Record<string, unknown[]> = {}
      const errors: string[] = []

      // Run available discoveries in parallel
      const discoveries: Array<{ name: string; fn: () => Promise<unknown[]> }> = []

      if (available.docker) {
        discoveries.push({
          name: 'docker',
          fn: async () => {
            const { stdout } = await execFileAsync('docker', ['ps', '--format', '{{json .}}'], { timeout: 15000 })
            return stdout.trim().split('\n').filter(Boolean).map((l) => {
              try { return JSON.parse(l) } catch { return null }
            }).filter(Boolean)
          }
        })
      }

      // Simple implementations for quick scan
      const results = await Promise.allSettled(
        discoveries.map(async (d) => {
          try {
            inventory[d.name] = await d.fn()
          } catch (err) {
            errors.push(`${d.name}: ${(err as Error).message}`)
          }
        })
      )

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              availableClis: available,
              discovered: inventory,
              errors: errors.length > 0 ? errors : undefined
            }, null, 2)
          }
        ]
      }
    }
  )
}
