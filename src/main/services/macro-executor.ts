import { execFile } from 'child_process'
import { variableEngine, type VariableContext } from './variable-engine'

export interface MacroDefinition {
  id: string
  name: string
  command: string
  type: 'remote' | 'local'
  confirmBeforeExec: boolean
}

export interface ExecCommandDefinition {
  id: string
  phase: 'pre' | 'post'
  command: string
  ask: boolean
  isDefault: boolean
  sortOrder: number
}

type ConfirmCallback = (message: string) => Promise<boolean>
type RemoteSendCallback = (data: string) => void

/**
 * Parse a command string into [program, ...args].
 * Handles simple quoting (single and double quotes).
 */
function parseCommand(command: string): [string, string[]] {
  const tokens: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false

  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble
    } else if (ch === ' ' && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current)
        current = ''
      }
    } else {
      current += ch
    }
  }
  if (current.length > 0) tokens.push(current)

  if (tokens.length === 0) return ['', []]
  return [tokens[0], tokens.slice(1)]
}

export class MacroExecutor {
  private confirmCallback: ConfirmCallback | null = null
  private remoteSendCallback: RemoteSendCallback | null = null

  setConfirmCallback(fn: ConfirmCallback): void {
    this.confirmCallback = fn
  }

  setRemoteSendCallback(fn: RemoteSendCallback): void {
    this.remoteSendCallback = fn
  }

  /**
   * Execute a local command and return its output.
   * Uses execFile with parsed arguments to prevent shell injection.
   */
  async executeLocal(command: string, context: VariableContext): Promise<string> {
    const resolved = await variableEngine.resolve(command, context)
    const [program, args] = parseCommand(resolved)

    if (!program) {
      throw new Error('Empty command')
    }

    return new Promise((resolve, reject) => {
      execFile(program, args, { timeout: 30000, encoding: 'utf-8' }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`Command failed: ${stderr || error.message}`))
          return
        }
        resolve(stdout)
      })
    })
  }

  /**
   * Execute a remote macro by sending the command to the terminal.
   */
  async executeRemote(command: string, context: VariableContext): Promise<void> {
    const resolved = await variableEngine.resolve(command, context)
    if (this.remoteSendCallback) {
      this.remoteSendCallback(resolved + '\r')
    }
  }

  /**
   * Execute pre/post connection commands.
   */
  async executeExecCommands(
    commands: ExecCommandDefinition[],
    context: VariableContext
  ): Promise<void> {
    const sorted = [...commands].sort((a, b) => a.sortOrder - b.sortOrder)

    for (const cmd of sorted) {
      if (!cmd.isDefault) continue

      if (cmd.ask && this.confirmCallback) {
        const confirmed = await this.confirmCallback(
          `Execute command: ${cmd.command}?`
        )
        if (!confirmed) continue
      }

      await this.executeLocal(cmd.command, context)
    }
  }

  /**
   * Execute a macro with optional confirmation.
   */
  async executeMacro(
    macro: MacroDefinition,
    context: VariableContext
  ): Promise<string | void> {
    if (macro.confirmBeforeExec && this.confirmCallback) {
      const confirmed = await this.confirmCallback(
        `Execute macro "${macro.name}": ${macro.command}?`
      )
      if (!confirmed) return
    }

    if (macro.type === 'local') {
      return this.executeLocal(macro.command, context)
    } else {
      return this.executeRemote(macro.command, context)
    }
  }
}

export const macroExecutor = new MacroExecutor()
