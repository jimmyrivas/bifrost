import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export interface DiscoveredHost {
  name: string
  host: string
  port: number
  user: string
  type: 'aws' | 'gcp' | 'docker' | 'kubernetes'
  metadata: Record<string, string>
}

/**
 * Check whether a CLI binary exists on the system PATH.
 */
async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync('which', [command])
    return true
  } catch {
    return false
  }
}

/**
 * Run a shell command and return stdout parsed as JSON.
 */
async function runJsonCommand(command: string, args: string[]): Promise<unknown> {
  const { stdout } = await execFileAsync(command, args, {
    timeout: 30000,
    maxBuffer: 10 * 1024 * 1024
  })
  return JSON.parse(stdout)
}

/**
 * Discover EC2 instances via AWS CLI.
 * Requires `aws` CLI configured with valid credentials.
 */
export async function discoverAWS(): Promise<DiscoveredHost[]> {
  if (!(await commandExists('aws'))) {
    throw new Error('AWS CLI (aws) not found on PATH')
  }

  const result = (await runJsonCommand('aws', [
    'ec2',
    'describe-instances',
    '--output',
    'json',
    '--query',
    'Reservations[].Instances[]'
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

    // Extract Name tag
    const tags = (instance['Tags'] as Array<{ Key: string; Value: string }>) ?? []
    const nameTag = tags.find((t) => t.Key === 'Name')
    const name = nameTag?.Value ?? instanceId

    const keyName = (instance['KeyName'] as string) ?? ''
    const instanceType = (instance['InstanceType'] as string) ?? ''
    const az = (instance['Placement'] as Record<string, string>)?.AvailabilityZone ?? ''

    hosts.push({
      name,
      host,
      port: 22,
      user: 'ec2-user',
      type: 'aws',
      metadata: {
        instanceId,
        instanceType,
        availabilityZone: az,
        publicIp: publicIp ?? '',
        privateIp: privateIp ?? '',
        keyName
      }
    })
  }

  return hosts
}

/**
 * Discover GCP Compute Engine instances via gcloud CLI.
 */
export async function discoverGCP(): Promise<DiscoveredHost[]> {
  if (!(await commandExists('gcloud'))) {
    throw new Error('Google Cloud CLI (gcloud) not found on PATH')
  }

  const result = (await runJsonCommand('gcloud', [
    'compute',
    'instances',
    'list',
    '--format=json'
  ])) as Array<Record<string, unknown>>

  const hosts: DiscoveredHost[] = []

  for (const instance of result) {
    const status = instance['status'] as string
    if (status !== 'RUNNING') continue

    const name = (instance['name'] as string) ?? 'unknown'
    const zone = (instance['zone'] as string) ?? ''
    const zoneName = zone.split('/').pop() ?? zone
    const machineType = ((instance['machineType'] as string) ?? '').split('/').pop() ?? ''

    // Get network interfaces
    const networkInterfaces =
      (instance['networkInterfaces'] as Array<Record<string, unknown>>) ?? []
    let externalIp = ''
    let internalIp = ''

    if (networkInterfaces.length > 0) {
      internalIp = (networkInterfaces[0]['networkIP'] as string) ?? ''
      const accessConfigs =
        (networkInterfaces[0]['accessConfigs'] as Array<Record<string, string>>) ?? []
      if (accessConfigs.length > 0) {
        externalIp = accessConfigs[0]['natIP'] ?? ''
      }
    }

    const host = externalIp || internalIp
    if (!host) continue

    hosts.push({
      name,
      host,
      port: 22,
      user: '',
      type: 'gcp',
      metadata: {
        zone: zoneName,
        machineType,
        externalIp,
        internalIp,
        status
      }
    })
  }

  return hosts
}

/**
 * Discover running Docker containers via docker CLI.
 */
export async function discoverDocker(): Promise<DiscoveredHost[]> {
  if (!(await commandExists('docker'))) {
    throw new Error('Docker CLI (docker) not found on PATH')
  }

  // Use --format with Go template for JSON array
  const { stdout } = await execFileAsync(
    'docker',
    ['ps', '--format', '{{json .}}'],
    { timeout: 15000, maxBuffer: 5 * 1024 * 1024 }
  )

  const hosts: DiscoveredHost[] = []
  const lines = stdout.trim().split('\n').filter(Boolean)

  for (const line of lines) {
    try {
      const container = JSON.parse(line) as Record<string, string>
      const id = container['ID'] ?? ''
      const name = (container['Names'] ?? container['Name'] ?? id).replace(/^\//, '')
      const image = container['Image'] ?? ''
      const ports = container['Ports'] ?? ''
      const status = container['Status'] ?? ''

      // For Docker containers, the host is typically localhost
      // and the port is mapped from the container
      const sshPortMatch = ports.match(/0\.0\.0\.0:(\d+)->22\/tcp/)
      const port = sshPortMatch ? parseInt(sshPortMatch[1], 10) : 0

      hosts.push({
        name,
        host: '127.0.0.1',
        port: port || 22,
        user: 'root',
        type: 'docker',
        metadata: {
          containerId: id,
          image,
          ports,
          status
        }
      })
    } catch {
      // Skip malformed lines
    }
  }

  return hosts
}

/**
 * Discover Kubernetes pods via kubectl CLI.
 */
export async function discoverKubernetes(): Promise<DiscoveredHost[]> {
  if (!(await commandExists('kubectl'))) {
    throw new Error('kubectl not found on PATH')
  }

  const result = (await runJsonCommand('kubectl', [
    'get',
    'pods',
    '--all-namespaces',
    '-o',
    'json'
  ])) as { items: Array<Record<string, unknown>> }

  const hosts: DiscoveredHost[] = []

  for (const pod of result.items ?? []) {
    const metadata = pod['metadata'] as Record<string, string> | undefined
    const status = pod['status'] as Record<string, unknown> | undefined

    const name = metadata?.name ?? 'unknown'
    const namespace = metadata?.namespace ?? 'default'
    const phase = (status?.phase as string) ?? ''
    const podIP = (status?.podIP as string) ?? ''

    if (phase !== 'Running' || !podIP) continue

    const nodeName = (pod['spec'] as Record<string, string>)?.nodeName ?? ''

    hosts.push({
      name: `${namespace}/${name}`,
      host: podIP,
      port: 22,
      user: '',
      type: 'kubernetes',
      metadata: {
        namespace,
        podName: name,
        podIP,
        nodeName,
        phase
      }
    })
  }

  return hosts
}

/**
 * Check which cloud/container CLI tools are available.
 */
export async function checkAvailableClis(): Promise<Record<string, boolean>> {
  const [aws, gcloud, docker, kubectl] = await Promise.all([
    commandExists('aws'),
    commandExists('gcloud'),
    commandExists('docker'),
    commandExists('kubectl')
  ])

  return { aws, gcloud, docker, kubectl }
}
