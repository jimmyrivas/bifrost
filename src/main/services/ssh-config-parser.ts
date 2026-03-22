import { readFileSync, existsSync, globSync, readdirSync } from 'fs'
import { join, dirname, resolve } from 'path'
import { homedir } from 'os'

export interface SshConfigEntry {
  host: string
  hostName?: string
  user?: string
  port?: number
  identityFile?: string
  proxyJump?: string
  forwardAgent?: boolean
  /** Raw key-value pairs for any unrecognized directives */
  extras: Record<string, string>
}

interface ParsedBlock {
  hostPatterns: string[]
  directives: Record<string, string>
}

const DIRECTIVE_MAP: Record<string, keyof SshConfigEntry> = {
  hostname: 'hostName',
  user: 'user',
  port: 'port',
  identityfile: 'identityFile',
  proxyjump: 'proxyJump',
  forwardagent: 'forwardAgent'
}

function expandTilde(filePath: string): string {
  if (filePath.startsWith('~/') || filePath === '~') {
    return join(homedir(), filePath.slice(1))
  }
  return filePath
}

function resolveIncludes(line: string, baseDir: string): string[] {
  const pattern = expandTilde(line.trim())
  const absolutePattern = pattern.startsWith('/')
    ? pattern
    : resolve(baseDir, pattern)

  try {
    const matched = globSync(absolutePattern)
    return matched.filter((f) => existsSync(f))
  } catch {
    return []
  }
}

function parseConfigContent(content: string, baseDir: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  let currentBlock: ParsedBlock | null = null

  const lines = content.split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Skip comments and empty lines
    if (!line || line.startsWith('#')) continue

    // Handle Include directive
    const includeMatch = line.match(/^Include\s+(.+)$/i)
    if (includeMatch) {
      const includedFiles = resolveIncludes(includeMatch[1], baseDir)
      for (const filePath of includedFiles) {
        try {
          const includeContent = readFileSync(filePath, 'utf-8')
          const includeBlocks = parseConfigContent(includeContent, dirname(filePath))
          blocks.push(...includeBlocks)
        } catch {
          // Skip unreadable include files
        }
      }
      continue
    }

    // Handle Host directive
    const hostMatch = line.match(/^Host\s+(.+)$/i)
    if (hostMatch) {
      currentBlock = {
        hostPatterns: hostMatch[1].split(/\s+/),
        directives: {}
      }
      blocks.push(currentBlock)
      continue
    }

    // Handle Match directive (skip, not fully supported)
    if (line.match(/^Match\s+/i)) {
      currentBlock = null
      continue
    }

    // Key-value directive
    if (currentBlock) {
      const kvMatch = line.match(/^(\S+)\s+(.+)$/)
      if (kvMatch) {
        currentBlock.directives[kvMatch[1].toLowerCase()] = kvMatch[2]
      }
    }
  }

  return blocks
}

function isWildcardPattern(pattern: string): boolean {
  return pattern.includes('*') || pattern.includes('?') || pattern.includes('!')
}

function matchesPattern(host: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) {
      const negated = pattern.slice(1)
      if (matchGlob(host, negated)) return false
    }
  }
  for (const pattern of patterns) {
    if (!pattern.startsWith('!') && matchGlob(host, pattern)) return true
  }
  return false
}

function matchGlob(str: string, pattern: string): boolean {
  const regex = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.')
  return new RegExp(`^${regex}$`).test(str)
}

/**
 * Parse an SSH config file and return structured entries.
 * Wildcard hosts (Host *) are applied as defaults to all other entries.
 */
export function parseSshConfig(configPath?: string): SshConfigEntry[] {
  const sshConfigPath = configPath ?? join(homedir(), '.ssh', 'config')

  if (!existsSync(sshConfigPath)) {
    return []
  }

  let content: string
  try {
    content = readFileSync(sshConfigPath, 'utf-8')
  } catch {
    return []
  }

  const blocks = parseConfigContent(content, dirname(sshConfigPath))

  // Separate wildcard defaults from concrete hosts
  const wildcardDefaults: Record<string, string> = {}
  const concreteBlocks: ParsedBlock[] = []

  for (const block of blocks) {
    const allWildcard = block.hostPatterns.every((p) => p === '*')
    if (allWildcard) {
      Object.assign(wildcardDefaults, block.directives)
    } else {
      concreteBlocks.push(block)
    }
  }

  const entries: SshConfigEntry[] = []

  for (const block of concreteBlocks) {
    // Skip blocks that only have wildcard patterns (but not exactly "*")
    const concretePatterns = block.hostPatterns.filter((p) => !isWildcardPattern(p))
    if (concretePatterns.length === 0) continue

    // Merge wildcard defaults under concrete directives
    const merged = { ...wildcardDefaults, ...block.directives }

    for (const hostAlias of concretePatterns) {
      const entry: SshConfigEntry = {
        host: hostAlias,
        extras: {}
      }

      for (const [key, value] of Object.entries(merged)) {
        const mappedKey = DIRECTIVE_MAP[key]
        if (mappedKey) {
          switch (mappedKey) {
            case 'port':
              entry.port = parseInt(value, 10) || undefined
              break
            case 'forwardAgent':
              entry.forwardAgent = value.toLowerCase() === 'yes'
              break
            case 'identityFile':
              entry.identityFile = expandTilde(value)
              break
            default:
              ;(entry as Record<string, unknown>)[mappedKey] = value
          }
        } else {
          entry.extras[key] = value
        }
      }

      // If no HostName specified, the host alias is the hostname
      if (!entry.hostName) {
        entry.hostName = hostAlias
      }

      entries.push(entry)
    }
  }

  return entries
}

/**
 * Check if a given hostname matches any wildcard Host blocks
 * and return the merged directives. Used for applying defaults
 * to dynamically discovered hosts.
 */
export function getDefaultsForHost(
  host: string,
  configPath?: string
): Record<string, string> {
  const sshConfigPath = configPath ?? join(homedir(), '.ssh', 'config')
  if (!existsSync(sshConfigPath)) return {}

  let content: string
  try {
    content = readFileSync(sshConfigPath, 'utf-8')
  } catch {
    return {}
  }

  const blocks = parseConfigContent(content, dirname(sshConfigPath))
  const result: Record<string, string> = {}

  for (const block of blocks) {
    if (matchesPattern(host, block.hostPatterns)) {
      Object.assign(result, block.directives)
    }
  }

  return result
}
