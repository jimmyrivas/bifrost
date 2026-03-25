import { app } from 'electron'
import { join, resolve } from 'path'
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync
} from 'fs'
import { EventEmitter } from 'events'
import { Worker } from 'worker_threads'
import { compileFunction } from 'vm'

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

export interface ScriptOutputMessage {
  type: 'send' | 'log' | 'complete' | 'error'
  text?: string
  message?: string
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

const WINDOWS_SAMPLE_SCRIPTS: Array<{ name: string; description: string; code: string }> = [
  {
    name: 'System Health Check (Windows)',
    description: 'Check OS version, CPU, memory, and disk via PowerShell',
    code: `// Windows System Health Check
async function run(ctx) {
  const commands = [
    'Get-CimInstance Win32_OperatingSystem | Select Caption, Version, LastBootUpTime | Format-List',
    'Get-Process | Sort-Object CPU -Descending | Select -First 10 Name, CPU, WorkingSet | Format-Table',
    'Get-Volume | Where-Object DriveLetter | Format-Table DriveLetter, FileSystemLabel, SizeRemaining, Size',
    'Get-Service | Where-Object Status -eq Running | Measure-Object | Select Count'
  ];

  for (const cmd of commands) {
    ctx.send(cmd + '\\n');
    await ctx.sleep(1500);
  }

  ctx.log('Health check complete');
}
`
  },
  {
    name: 'Windows Security Audit',
    description: 'Check firewall, users, and recent security events',
    code: `// Windows Security Audit
async function run(ctx) {
  ctx.send('Get-NetFirewallRule | Where-Object Enabled -eq True | Measure-Object | Select Count\\n');
  await ctx.sleep(1500);
  ctx.send('Get-LocalUser | Select Name, Enabled, LastLogon | Format-Table\\n');
  await ctx.sleep(1500);
  ctx.send('Get-EventLog -LogName Security -Newest 20 | Format-Table TimeGenerated, EntryType, Message -Wrap\\n');
  await ctx.sleep(2000);
  ctx.log('Security audit complete');
}
`
  }
]

/**
 * Worker code executed in an isolated thread with vm sandbox.
 * No access to require, process, fs, child_process, or any Node.js globals.
 */
const WORKER_CODE = `
const { parentPort } = require('worker_threads');
const vm = require('vm');

parentPort.on('message', async (msg) => {
  if (msg.type !== 'execute') return;

  try {
    const ctx = {
      send: (text) => { parentPort.postMessage({ type: 'send', text: String(text) }); },
      sleep: (ms) => new Promise((resolve) => setTimeout(resolve, Math.min(Number(ms) || 0, 60000))),
      log: (msg) => { parentPort.postMessage({ type: 'log', text: String(msg) }); }
    };

    const sandbox = vm.createContext({
      ctx,
      setTimeout: setTimeout,
      clearTimeout: clearTimeout,
      Promise: Promise,
      console: { log: ctx.log, warn: ctx.log, error: ctx.log },
      Math: Math,
      JSON: JSON,
      Date: Date,
      Array: Array,
      Object: Object,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      Map: Map,
      Set: Set,
      Error: Error
    });

    const wrappedCode = '(async function() { const { send, sleep, log } = ctx;\\n' + msg.code + '\\n})()';
    const result = vm.runInNewContext(wrappedCode, sandbox, {
      timeout: 120000,
      filename: 'bifrost-script.js'
    });
    await result;
    parentPort.postMessage({ type: 'complete' });
  } catch (err) {
    parentPort.postMessage({ type: 'error', message: err.message || String(err) });
  }
});
`

export class ScriptEngine extends EventEmitter {
  private scriptsDir: string | null = null

  /** Validate script ID to prevent path traversal */
  private safePath(dir: string, id: string): string {
    if (!/^script-[\d]+-[a-z0-9]+$/.test(id)) throw new Error('Invalid script ID')
    const filePath = join(dir, `${id}.json`)
    const resolved = resolve(filePath)
    if (!resolved.startsWith(resolve(dir))) throw new Error('Path traversal detected')
    return resolved
  }

  private ensureDir(): string {
    if (!this.scriptsDir) {
      this.scriptsDir = join(app.getPath('userData'), 'scripts')
      mkdirSync(this.scriptsDir, { recursive: true })

      const files = readdirSync(this.scriptsDir).filter((f) => f.endsWith('.json'))

      // Deduplicate: if multiple scripts share the same name, keep the oldest
      if (files.length > 0) {
        const byName = new Map<string, Array<{ file: string; script: BifrostScript }>>()
        for (const f of files) {
          try {
            const script = JSON.parse(readFileSync(join(this.scriptsDir, f), 'utf-8')) as BifrostScript
            const entries = byName.get(script.name) ?? []
            entries.push({ file: f, script })
            byName.set(script.name, entries)
          } catch { /* skip malformed */ }
        }
        for (const [, entries] of byName) {
          if (entries.length > 1) {
            // Sort by createdAt ascending, keep the first (oldest)
            entries.sort((a, b) => a.script.createdAt.localeCompare(b.script.createdAt))
            for (let i = 1; i < entries.length; i++) {
              unlinkSync(join(this.scriptsDir, entries[i].file))
            }
          }
        }
      }

      // Create sample scripts only if directory has no .json files
      if (files.length === 0) {
        const now = new Date().toISOString()
        const samples = process.platform === 'win32'
          ? [...WINDOWS_SAMPLE_SCRIPTS, ...SAMPLE_SCRIPTS]
          : SAMPLE_SCRIPTS
        for (const sample of samples) {
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
    const filePath = this.safePath(dir, id)
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
    const filePath = this.safePath(dir, id)
    if (!existsSync(filePath)) return
    const script = JSON.parse(readFileSync(filePath, 'utf-8')) as BifrostScript
    const updated = { ...script, ...updates, updatedAt: new Date().toISOString() }
    writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8')
  }

  deleteScript(id: string): void {
    const dir = this.ensureDir()
    const filePath = this.safePath(dir, id)
    if (existsSync(filePath)) {
      unlinkSync(filePath)
    }
  }

  /**
   * Validate script syntax without executing.
   * Uses vm.compileFunction for safe parsing — never executes the code.
   */
  validateScript(code: string): string | null {
    try {
      const wrappedCode = '(async function() { const { send, sleep, log } = ctx;\n' + code + '\n})()'
      compileFunction(wrappedCode, ['ctx'])
      return null
    } catch (err) {
      return err instanceof Error ? err.message : String(err)
    }
  }

  /**
   * Execute a script in an isolated Worker thread with a vm sandbox.
   * The worker has no access to require, process, fs, child_process, etc.
   * Returns a controller with a message callback and a completion promise.
   */
  executeScript(
    code: string,
    onOutput: (msg: ScriptOutputMessage) => void
  ): { promise: Promise<void>; cancel: () => void } {
    const worker = new Worker(WORKER_CODE, { eval: true })
    let settled = false

    const promise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true
          worker.terminate()
          reject(new Error('Script execution timed out (120s)'))
        }
      }, 125000)

      worker.on('message', (msg: ScriptOutputMessage) => {
        if (msg.type === 'complete') {
          settled = true
          clearTimeout(timeout)
          worker.terminate()
          resolve()
        } else if (msg.type === 'error') {
          settled = true
          clearTimeout(timeout)
          worker.terminate()
          reject(new Error(msg.message ?? 'Script execution failed'))
        } else {
          onOutput(msg)
        }
      })

      worker.on('error', (err) => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          reject(err)
        }
      })

      worker.on('exit', (exitCode) => {
        if (!settled) {
          settled = true
          clearTimeout(timeout)
          if (exitCode !== 0) {
            reject(new Error(`Worker exited with code ${exitCode}`))
          } else {
            resolve()
          }
        }
      })

      worker.postMessage({ type: 'execute', code })
    })

    const cancel = (): void => {
      if (!settled) {
        settled = true
        worker.terminate()
      }
    }

    return { promise, cancel }
  }
}

export const scriptEngine = new ScriptEngine()
