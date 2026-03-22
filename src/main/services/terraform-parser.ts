import { readFileSync, existsSync } from 'fs'

export interface TerraformHost {
  name: string
  resourceType: string
  publicIp: string
  privateIp: string
  provider: 'aws' | 'gcp' | 'azure' | 'unknown'
  metadata: Record<string, string>
}

/**
 * Parse a Terraform state file (.tfstate JSON) and extract compute instances with IPs.
 * Supports: aws_instance, google_compute_instance, azurerm_virtual_machine,
 * azurerm_linux_virtual_machine, azurerm_windows_virtual_machine.
 */
export function parseTerraformState(filePath: string): TerraformHost[] {
  if (!existsSync(filePath)) {
    throw new Error(`Terraform state file not found: ${filePath}`)
  }

  let stateData: TerraformStateFile

  try {
    const content = readFileSync(filePath, 'utf-8')
    stateData = JSON.parse(content) as TerraformStateFile
  } catch (err) {
    throw new Error(
      `Failed to parse Terraform state: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  const hosts: TerraformHost[] = []

  // Support both v3 and v4 state formats
  if (stateData.version === 4 && stateData.resources) {
    for (const resource of stateData.resources) {
      const parsed = parseResource(resource.type, resource.name, resource.instances ?? [])
      hosts.push(...parsed)
    }
  } else if (stateData.version === 3 && stateData.modules) {
    for (const mod of stateData.modules) {
      if (!mod.resources) continue
      for (const [key, res] of Object.entries(mod.resources)) {
        const [resourceType] = key.split('.')
        const parsed = parseV3Resource(resourceType, res)
        if (parsed) hosts.push(parsed)
      }
    }
  }

  return hosts
}

interface TerraformStateFile {
  version: number
  resources?: TerraformResourceBlock[]
  modules?: TerraformV3Module[]
}

interface TerraformResourceBlock {
  type: string
  name: string
  provider?: string
  instances?: TerraformResourceInstance[]
}

interface TerraformResourceInstance {
  attributes?: Record<string, unknown>
  index_key?: string | number
}

interface TerraformV3Module {
  resources?: Record<string, TerraformV3Resource>
}

interface TerraformV3Resource {
  type: string
  primary?: {
    id?: string
    attributes?: Record<string, string>
  }
}

const COMPUTE_TYPES = new Set([
  'aws_instance',
  'google_compute_instance',
  'azurerm_virtual_machine',
  'azurerm_linux_virtual_machine',
  'azurerm_windows_virtual_machine'
])

function parseResource(
  resourceType: string,
  resourceName: string,
  instances: TerraformResourceInstance[]
): TerraformHost[] {
  if (!COMPUTE_TYPES.has(resourceType)) return []

  const hosts: TerraformHost[] = []

  for (const instance of instances) {
    const attrs = instance.attributes ?? {}
    const host = extractHostFromAttributes(resourceType, resourceName, attrs, instance.index_key)
    if (host) hosts.push(host)
  }

  return hosts
}

function extractHostFromAttributes(
  resourceType: string,
  resourceName: string,
  attrs: Record<string, unknown>,
  indexKey?: string | number
): TerraformHost | null {
  const suffix = indexKey !== undefined ? `[${indexKey}]` : ''
  const name = `${resourceName}${suffix}`

  switch (resourceType) {
    case 'aws_instance': {
      const publicIp = (attrs['public_ip'] as string) ?? ''
      const privateIp = (attrs['private_ip'] as string) ?? ''
      if (!publicIp && !privateIp) return null

      return {
        name,
        resourceType,
        publicIp,
        privateIp,
        provider: 'aws',
        metadata: {
          instanceId: (attrs['id'] as string) ?? '',
          instanceType: (attrs['instance_type'] as string) ?? '',
          ami: (attrs['ami'] as string) ?? '',
          availabilityZone: (attrs['availability_zone'] as string) ?? '',
          keyName: (attrs['key_name'] as string) ?? ''
        }
      }
    }
    case 'google_compute_instance': {
      let publicIp = ''
      let privateIp = ''

      const networkInterfaces = attrs['network_interface'] as Array<Record<string, unknown>> | undefined
      if (networkInterfaces && networkInterfaces.length > 0) {
        privateIp = (networkInterfaces[0]['network_ip'] as string) ?? ''
        const accessConfigs = networkInterfaces[0]['access_config'] as Array<Record<string, string>> | undefined
        if (accessConfigs && accessConfigs.length > 0) {
          publicIp = accessConfigs[0]['nat_ip'] ?? ''
        }
      }

      if (!publicIp && !privateIp) return null

      return {
        name,
        resourceType,
        publicIp,
        privateIp,
        provider: 'gcp',
        metadata: {
          instanceId: (attrs['id'] as string) ?? '',
          machineType: (attrs['machine_type'] as string) ?? '',
          zone: (attrs['zone'] as string) ?? ''
        }
      }
    }
    case 'azurerm_virtual_machine':
    case 'azurerm_linux_virtual_machine':
    case 'azurerm_windows_virtual_machine': {
      const publicIp = (attrs['public_ip_address'] as string) ?? ''
      const privateIp = (attrs['private_ip_address'] as string) ?? ''
      if (!publicIp && !privateIp) return null

      return {
        name,
        resourceType,
        publicIp,
        privateIp,
        provider: 'azure',
        metadata: {
          instanceId: (attrs['id'] as string) ?? '',
          vmSize: (attrs['size'] as string) ?? (attrs['vm_size'] as string) ?? '',
          location: (attrs['location'] as string) ?? '',
          resourceGroup: (attrs['resource_group_name'] as string) ?? ''
        }
      }
    }
    default:
      return null
  }
}

function parseV3Resource(
  resourceType: string,
  resource: TerraformV3Resource
): TerraformHost | null {
  if (!COMPUTE_TYPES.has(resourceType)) return null
  if (!resource.primary?.attributes) return null

  const attrs: Record<string, unknown> = resource.primary.attributes
  return extractHostFromAttributes(resourceType, resource.primary.id ?? 'unknown', attrs)
}
