import { readFileSync, existsSync } from 'fs'

export interface AnsibleHost {
  name: string
  host: string
  user?: string
  port?: number
  privateKeyFile?: string
  group: string
  variables: Record<string, string>
}

/**
 * Parse an Ansible inventory file (INI or YAML format).
 * Auto-detects format based on content inspection.
 */
export function parseAnsibleInventory(filePath: string): AnsibleHost[] {
  if (!existsSync(filePath)) {
    throw new Error(`Inventory file not found: ${filePath}`)
  }

  const content = readFileSync(filePath, 'utf-8')

  // Detect YAML format by checking for common YAML indicators
  const trimmed = content.trimStart()
  if (
    trimmed.startsWith('---') ||
    trimmed.startsWith('all:') ||
    trimmed.match(/^\w+:\s*$/m)?.index === 0
  ) {
    return parseYamlInventory(content)
  }

  return parseIniInventory(content)
}

// --- INI Format Parser ---

function parseIniInventory(content: string): AnsibleHost[] {
  const hosts: AnsibleHost[] = []
  const groupVars: Record<string, Record<string, string>> = {}

  let currentSection = 'ungrouped'
  let currentSectionType: 'hosts' | 'vars' = 'hosts'

  const lines = content.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Skip comments and empty lines
    if (!line || line.startsWith('#') || line.startsWith(';')) continue

    // Section header
    const sectionMatch = line.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      const section = sectionMatch[1]
      const varsMatch = section.match(/^(.+):vars$/)
      const childrenMatch = section.match(/^(.+):children$/)

      if (varsMatch) {
        currentSection = varsMatch[1]
        currentSectionType = 'vars'
        if (!groupVars[currentSection]) {
          groupVars[currentSection] = {}
        }
      } else if (childrenMatch) {
        // :children sections list group names, not hosts. Skip for host parsing.
        currentSection = childrenMatch[1]
        currentSectionType = 'hosts' // will parse child group names, but they won't match host format
      } else {
        currentSection = section
        currentSectionType = 'hosts'
      }
      continue
    }

    if (currentSectionType === 'vars') {
      // Parse variable assignment
      const varMatch = line.match(/^(\S+)\s*=\s*(.+)$/)
      if (varMatch) {
        if (!groupVars[currentSection]) {
          groupVars[currentSection] = {}
        }
        groupVars[currentSection][varMatch[1]] = varMatch[2].trim()
      }
      continue
    }

    // Parse host line: hostname [key=value ...]
    const parts = line.split(/\s+/)
    const hostEntry = parts[0]

    // Skip if it looks like a group name reference (in :children section)
    if (!hostEntry || hostEntry.startsWith('[')) continue

    const variables: Record<string, string> = {}
    for (let i = 1; i < parts.length; i++) {
      const kvMatch = parts[i].match(/^(\S+?)=(.+)$/)
      if (kvMatch) {
        variables[kvMatch[1]] = kvMatch[2]
      }
    }

    // Handle range notation: web[01:05]
    const rangeMatch = hostEntry.match(/^(.+)\[(\d+):(\d+)\](.*)$/)
    if (rangeMatch) {
      const prefix = rangeMatch[1]
      const start = parseInt(rangeMatch[2], 10)
      const end = parseInt(rangeMatch[3], 10)
      const suffix = rangeMatch[4]
      const padLen = rangeMatch[2].length

      for (let i = start; i <= end; i++) {
        const num = String(i).padStart(padLen, '0')
        const expandedName = `${prefix}${num}${suffix}`
        hosts.push(
          buildHostFromIni(expandedName, variables, currentSection)
        )
      }
    } else {
      hosts.push(buildHostFromIni(hostEntry, variables, currentSection))
    }
  }

  // Apply group variables to hosts
  for (const host of hosts) {
    const gVars = groupVars[host.group]
    if (gVars) {
      // Group vars are lower priority than host-specific vars
      for (const [k, v] of Object.entries(gVars)) {
        if (!(k in host.variables)) {
          host.variables[k] = v
          applyAnsibleVariable(host, k, v)
        }
      }
    }
  }

  return hosts
}

function buildHostFromIni(
  hostEntry: string,
  variables: Record<string, string>,
  group: string
): AnsibleHost {
  const host: AnsibleHost = {
    name: hostEntry,
    host: variables['ansible_host'] ?? hostEntry,
    group,
    variables: { ...variables }
  }

  for (const [k, v] of Object.entries(variables)) {
    applyAnsibleVariable(host, k, v)
  }

  return host
}

function applyAnsibleVariable(host: AnsibleHost, key: string, value: string): void {
  switch (key) {
    case 'ansible_host':
      host.host = value
      break
    case 'ansible_user':
      host.user = value
      break
    case 'ansible_port':
      host.port = parseInt(value, 10) || undefined
      break
    case 'ansible_ssh_private_key_file':
      host.privateKeyFile = value
      break
  }
}

// --- YAML Format Parser (simple recursive descent, no external YAML library) ---

interface YamlNode {
  [key: string]: string | YamlNode | null
}

function parseYamlInventory(content: string): AnsibleHost[] {
  const hosts: AnsibleHost[] = []

  // Simple YAML parser for Ansible inventory structure
  // Supports: all.children.groupname.hosts.hostname.vars
  const root = simpleYamlParse(content)
  if (!root || typeof root !== 'object') return hosts

  extractHosts(root, 'all', hosts)
  return hosts
}

function extractHosts(
  node: YamlNode,
  groupName: string,
  result: AnsibleHost[]
): void {
  if (!node || typeof node !== 'object') return

  // Check for 'hosts' key
  const hostsNode = node['hosts']
  if (hostsNode && typeof hostsNode === 'object') {
    for (const [hostName, hostVars] of Object.entries(hostsNode as YamlNode)) {
      const variables: Record<string, string> = {}
      if (hostVars && typeof hostVars === 'object') {
        for (const [k, v] of Object.entries(hostVars as YamlNode)) {
          if (typeof v === 'string') {
            variables[k] = v
          }
        }
      }

      const host: AnsibleHost = {
        name: hostName,
        host: variables['ansible_host'] ?? hostName,
        group: groupName,
        variables
      }

      for (const [k, v] of Object.entries(variables)) {
        applyAnsibleVariable(host, k, v)
      }

      result.push(host)
    }
  }

  // Check for 'children' key
  const childrenNode = node['children']
  if (childrenNode && typeof childrenNode === 'object') {
    for (const [childGroup, childNode] of Object.entries(childrenNode as YamlNode)) {
      if (childNode && typeof childNode === 'object') {
        extractHosts(childNode as YamlNode, childGroup, result)
      }
    }
  }
}

/**
 * Minimal YAML parser sufficient for Ansible inventory files.
 * Handles indentation-based nesting and key: value pairs.
 * Does NOT handle full YAML spec (anchors, flow collections, etc).
 */
function simpleYamlParse(content: string): YamlNode {
  const lines = content.split('\n')
  const root: YamlNode = {}
  const stack: Array<{ indent: number; node: YamlNode }> = [{ indent: -1, node: root }]

  for (const rawLine of lines) {
    // Skip comments and empty lines
    const commentStripped = rawLine.replace(/#.*$/, '')
    if (!commentStripped.trim()) continue
    if (rawLine.trim() === '---') continue

    const indent = rawLine.search(/\S/)
    if (indent === -1) continue

    const line = commentStripped.trim()

    // Key: value pair
    const kvMatch = line.match(/^(\S+):\s+(.+)$/)
    if (kvMatch) {
      // Pop stack to correct parent
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop()
      }
      const parent = stack[stack.length - 1].node
      parent[kvMatch[1]] = kvMatch[2].replace(/^["']|["']$/g, '')
      continue
    }

    // Key: (no value, starts a new block)
    const blockMatch = line.match(/^(\S+):\s*$/)
    if (blockMatch) {
      while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
        stack.pop()
      }
      const parent = stack[stack.length - 1].node
      const newNode: YamlNode = {}
      parent[blockMatch[1]] = newNode
      stack.push({ indent, node: newNode })
      continue
    }
  }

  return root
}
