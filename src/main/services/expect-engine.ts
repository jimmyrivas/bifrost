import { EventEmitter } from 'events'

export interface ExpectRule {
  id: string
  pattern: RegExp
  sendText: string
  sendReturn: boolean
  hideFromLog: boolean
  timeout: number
  onMatch: string | null // rule id to jump to
  onFail: string | null  // rule id to jump to on timeout
  enabled: boolean
}

export type ExpectEvent =
  | { type: 'match'; ruleId: string; matched: string }
  | { type: 'send'; ruleId: string; text: string; hidden: boolean }
  | { type: 'timeout'; ruleId: string }
  | { type: 'complete' }
  | { type: 'error'; message: string }

export class ExpectEngine extends EventEmitter {
  private rules: ExpectRule[] = []
  private currentRuleIndex = 0
  private buffer = ''
  private timer: ReturnType<typeof setTimeout> | null = null
  private running = false
  private debug = false
  private writeFn: ((data: string) => void) | null = null

  constructor() {
    super()
  }

  setRules(rules: ExpectRule[]): void {
    // Filter out disabled rules
    this.rules = rules.filter((r) => r.enabled !== false)
    this.currentRuleIndex = 0
    this.buffer = ''
  }

  setWriteFunction(fn: (data: string) => void): void {
    this.writeFn = fn
  }

  setDebug(enabled: boolean): void {
    this.debug = enabled
  }

  start(): void {
    if (this.rules.length === 0) {
      this.emit('expect-event', { type: 'complete' } as ExpectEvent)
      return
    }
    this.running = true
    this.currentRuleIndex = 0
    this.buffer = ''
    this.startTimeout()
  }

  stop(): void {
    this.running = false
    this.clearTimeout()
    this.buffer = ''
  }

  /**
   * Feed terminal output data into the expect engine.
   * Called whenever data arrives from the SSH/PTY stream.
   */
  feed(data: string): void {
    if (!this.running || this.rules.length === 0) return

    this.buffer += data

    // Emit buffer update for debug panel
    this.emit('buffer-update', this.buffer.slice(-500))

    if (this.debug) {
      this.emit('expect-event', {
        type: 'match',
        ruleId: 'debug',
        matched: `[DEBUG] Buffer: ${JSON.stringify(this.buffer.slice(-200))}`
      } as ExpectEvent)
    }

    this.tryMatch()
  }

  private tryMatch(): void {
    if (this.currentRuleIndex >= this.rules.length) {
      this.complete()
      return
    }

    const rule = this.rules[this.currentRuleIndex]
    const match = rule.pattern.exec(this.buffer)

    if (match) {
      this.clearTimeout()

      this.emit('expect-event', {
        type: 'match',
        ruleId: rule.id,
        matched: match[0]
      } as ExpectEvent)

      // Send response
      const textToSend = rule.sendReturn ? rule.sendText + '\r' : rule.sendText

      this.emit('expect-event', {
        type: 'send',
        ruleId: rule.id,
        text: rule.hideFromLog ? '***' : rule.sendText,
        hidden: rule.hideFromLog
      } as ExpectEvent)

      if (this.writeFn) {
        this.writeFn(textToSend)
      }

      // Clear buffer after match
      this.buffer = ''

      // Navigate to next rule
      if (rule.onMatch) {
        const nextIdx = this.rules.findIndex((r) => r.id === rule.onMatch)
        if (nextIdx !== -1) {
          this.currentRuleIndex = nextIdx
        } else {
          this.currentRuleIndex++
        }
      } else {
        this.currentRuleIndex++
      }

      // Check if we're done
      if (this.currentRuleIndex >= this.rules.length) {
        this.complete()
      } else {
        this.startTimeout()
      }
    }
  }

  private startTimeout(): void {
    this.clearTimeout()
    if (this.currentRuleIndex >= this.rules.length) return

    const rule = this.rules[this.currentRuleIndex]
    this.timer = setTimeout(() => {
      this.emit('expect-event', {
        type: 'timeout',
        ruleId: rule.id
      } as ExpectEvent)

      if (rule.onFail) {
        const failIdx = this.rules.findIndex((r) => r.id === rule.onFail)
        if (failIdx !== -1) {
          this.currentRuleIndex = failIdx
          this.buffer = ''
          this.startTimeout()
          return
        }
      }

      // No onFail handler — stop
      this.running = false
      this.emit('expect-event', {
        type: 'error',
        message: `Timeout waiting for pattern: ${rule.pattern.source}`
      } as ExpectEvent)
    }, rule.timeout)
  }

  private clearTimeout(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  private complete(): void {
    this.running = false
    this.clearTimeout()
    this.buffer = ''
    this.emit('expect-event', { type: 'complete' } as ExpectEvent)
  }

  isRunning(): boolean {
    return this.running
  }

  getCurrentRule(): ExpectRule | null {
    if (this.currentRuleIndex < this.rules.length) {
      return this.rules[this.currentRuleIndex]
    }
    return null
  }
}
