export interface ScriptContext {
  /** Write text to the terminal (as if typed) */
  send: (text: string) => void
  /** Wait for a given number of milliseconds */
  sleep: (ms: number) => Promise<void>
  /** Write a colored log message to the terminal */
  log: (msg: string) => void
}

/**
 * Execute a Bifrost script in a sandboxed context.
 * The script code has access to `send`, `sleep`, and `log` from the context.
 */
export async function executeScript(code: string, ctx: ScriptContext): Promise<void> {
  const fn = new Function(
    'ctx',
    `
    return (async function() {
      const { send, sleep, log } = ctx;
      ${code}
    })()
  `
  )
  await fn(ctx)
}
