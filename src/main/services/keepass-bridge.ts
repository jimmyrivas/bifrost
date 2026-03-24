import { execFileSync } from 'child_process'

export interface KeePassConfig {
  databasePath: string
  keyFilePath?: string
}

/**
 * Bridge to KeePassXC via keepassxc-cli.
 * Resolves <field|path> variables by querying the KeePass database.
 */
export class KeePassBridge {
  private config: KeePassConfig | null = null

  configure(config: KeePassConfig): void {
    this.config = config
  }

  isConfigured(): boolean {
    return this.config !== null
  }

  /**
   * Check if keepassxc-cli is available on the system.
   */
  isAvailable(): boolean {
    try {
      execFileSync('which', ['keepassxc-cli'], { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  }

  /**
   * Resolve a KeePass variable: <field|path>
   * e.g., <password|/servers/production/webserver>
   */
  resolve(field: string, entryPath: string): string {
    if (!this.config) {
      throw new Error('KeePass not configured')
    }

    try {
      const args = ['show', '-s', '-a', field]
      if (this.config.keyFilePath) {
        args.push('-k', this.config.keyFilePath)
      }
      args.push(this.config.databasePath, entryPath)

      const result = execFileSync('keepassxc-cli', args, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      return result.trim()
    } catch {
      return ''
    }
  }

  /**
   * List entries under a path.
   */
  listEntries(path: string): string[] {
    if (!this.config) return []

    try {
      const args = ['ls']
      if (this.config.keyFilePath) {
        args.push('-k', this.config.keyFilePath)
      }
      args.push(this.config.databasePath, path)

      const result = execFileSync('keepassxc-cli', args, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      return result.trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
}

export const keepassBridge = new KeePassBridge()
