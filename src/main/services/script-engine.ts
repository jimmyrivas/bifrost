import { app } from 'electron'
import { join } from 'path'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync
} from 'fs'
import { EventEmitter } from 'events'

export interface BifrostScript {
  id: string
  name: string
  description: string
  code: string
  createdAt: string
  updatedAt: string
}

export interface ScriptContext {
  connectionId?: string
  connectionName?: string
  host?: string
  user?: string
  terminalWrite?: (data: string) => void
  terminalRead?: () => Promise<string>
}

const SAMPLE_SCRIPTS: Array<{ name: string; description: string; code: string }> = [
  {
    name: 'System Health Check',
    description: 'Check uptime, disk, memory, and load average',
    code: `// System Health Check
// Sends commands to the active terminal and logs output

async function run(ctx) {
  const commands = [
    'echo "=== UPTIME ===" && uptime',
    'echo "=== MEMORY ===" && free -h',
    'echo "=== DISK ===" && df -h /',
    'echo "=== LOAD ===" && cat /proc/loadavg'
  ];

  for (const cmd of commands) {
    ctx.send(cmd + '\\n');
    await ctx.sleep(1000);
  }

  ctx.log('Health check complete');
}
`
  },
  {
    name: 'Deploy Check',
    description: 'Verify application deployment status',
    code: `// Deployment Verification Script
async function run(ctx) {
  ctx.send('systemctl status {{service}}\\n');
  await ctx.sleep(2000);
  ctx.send('curl -s http://localhost:{{port}}/health\\n');
  await ctx.sleep(1000);
  ctx.log('Deploy check complete');
}
`
  },
  {
    name: 'Log Collector',
    description: 'Collect recent logs from multiple services',
    code: `// Log Collector
async function run(ctx) {
  const services = ['nginx', 'app', 'database'];

  for (const svc of services) {
    ctx.send(\`echo "=== \${svc} ===" && journalctl -u \${svc} --since "1 hour ago" --no-pager | tail -20\\n\`);
    await ctx.sleep(2000);
  }

  ctx.log('Log collection complete');
}
`
  }
]

export class ScriptEngine extends EventEmitter {
  private scriptsDir: string | null = null

  private ensureDir(): string {
    if (!this.scriptsDir) {
      this.scriptsDir = join(app.getPath('userData'), 'scripts')
      mkdirSync(this.scriptsDir, { recursive: true })

      // Create sample scripts if directory is empty
      const files = readdirSync(this.scriptsDir).filter((f) => f.endsWith('.js'))
      if (files.length === 0) {
        const now = new Date().toISOString()
        for (const sample of SAMPLE_SCRIPTS) {
          const id = `script-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          const script: BifrostScript = {
            id,
            name: sample.name,
            description: sample.description,
            code: sample.code,
            createdAt: now,
            updatedAt: now
          }
          writeFileSync(
            join(this.scriptsDir, `${id}.json`),
            JSON.stringify(script, null, 2),
            'utf-8'
          )
        }
      }
    }
    return this.scriptsDir
  }

  listScripts(): BifrostScript[] {
    const dir = this.ensureDir()
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'))
    return files.map((f) => {
      const content = readFileSync(join(dir, f), 'utf-8')
      return JSON.parse(content) as BifrostScript
    })
  }

  getScript(id: string): BifrostScript | null {
    const dir = this.ensureDir()
    const filePath = join(dir, `${id}.json`)
    if (!existsSync(filePath)) return null
    return JSON.parse(readFileSync(filePath, 'utf-8')) as BifrostScript
  }

  saveScript(script: Omit<BifrostScript, 'id' | 'createdAt' | 'updatedAt'>): BifrostScript {
    const dir = this.ensureDir()
    const now = new Date().toISOString()
    const id = `script-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const newScript: BifrostScript = {
      ...script,
      id,
      createdAt: now,
      updatedAt: now
    }
    writeFileSync(join(dir, `${id}.json`), JSON.stringify(newScript, null, 2), 'utf-8')
    return newScript
  }

  updateScript(id: string, updates: Partial<BifrostScript>): void {
    const dir = this.ensureDir()
    const filePath = join(dir, `${id}.json`)
    if (!existsSync(filePath)) return
    const script = JSON.parse(readFileSync(filePath, 'utf-8')) as BifrostScript
    const updated = { ...script, ...updates, updatedAt: new Date().toISOString() }
    writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8')
  }

  deleteScript(id: string): void {
    const dir = this.ensureDir()
    const filePath = join(dir, `${id}.json`)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }

  /**
   * Validate script syntax without executing.
   * Returns null if valid, error message if invalid.
   */
  validateScript(code: string): string | null {
    try {
      // Try to parse as JavaScript
      new Function('ctx', code)
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }
}

export const scriptEngine = new ScriptEngine()
