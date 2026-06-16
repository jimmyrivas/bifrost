/**
 * Shell Integration — Detect command boundaries via OSC 133 sequences.
 *
 * iTerm2/Warp Shell Integration Protocol:
 * - OSC 133;A — Prompt start (beginning of a new command block)
 * - OSC 133;B — Command start (user pressed Enter)
 * - OSC 133;C — Command executed (output begins)
 * - OSC 133;D;exitcode — Command finished
 *
 * To enable in bash:   PS1="\[\e]133;A\a\]$PS1"
 * To enable in zsh:    precmd() { printf '\e]133;A\a' }
 *
 * This module detects these sequences in terminal output and emits events.
 */

export interface BlockBoundary {
  type: 'prompt' | 'command' | 'output' | 'finish'
  timestamp: number
  exitCode?: number
}

const OSC_133_REGEX = /\x1b\]133;([ABCD])(?:;(\d+))?\x07/g

/**
 * Scan terminal data for OSC 133 shell integration sequences.
 * Returns any block boundaries found.
 */
export function detectBlockBoundaries(data: string): BlockBoundary[] {
  const boundaries: BlockBoundary[] = []
  let match: RegExpExecArray | null
  OSC_133_REGEX.lastIndex = 0

  while ((match = OSC_133_REGEX.exec(data)) !== null) {
    const code = match[1]
    const now = Date.now()
    switch (code) {
      case 'A':
        boundaries.push({ type: 'prompt', timestamp: now })
        break
      case 'B':
        boundaries.push({ type: 'command', timestamp: now })
        break
      case 'C':
        boundaries.push({ type: 'output', timestamp: now })
        break
      case 'D':
        boundaries.push({ type: 'finish', timestamp: now, exitCode: match[2] ? parseInt(match[2]) : 0 })
        break
    }
  }

  return boundaries
}

/**
 * Shell integration setup script to inject into remote sessions.
 * Users can also add this to their .bashrc/.zshrc manually.
 */
export const BASH_INTEGRATION = `
# Bifrost Shell Integration (add to .bashrc)
if [ -n "$BIFROST_SHELL_INTEGRATION" ]; then
  PS0='\\[\\e]133;C\\a\\]'
  _bifrost_prompt() { printf '\\e]133;A\\a'; }
  _bifrost_preexec() { printf '\\e]133;B\\a'; }
  PROMPT_COMMAND="_bifrost_prompt;\${PROMPT_COMMAND}"
  trap '_bifrost_preexec' DEBUG
fi
`.trim()

export const ZSH_INTEGRATION = `
# Bifrost Shell Integration (add to .zshrc)
if [ -n "$BIFROST_SHELL_INTEGRATION" ]; then
  precmd() { printf '\\e]133;A\\a' }
  preexec() { printf '\\e]133;B\\a' }
fi
`.trim()

/**
 * One-shot command written to the remote PTY to make the shell report its
 * working directory via OSC 7 (`file://host/abs/path`) on every prompt. Lets
 * Bifrost resolve relative `.md` links without the user editing their rc files.
 *
 * Detects bash vs zsh, hooks the prompt, and emits once immediately so the cwd
 * is known right away. `\\033` (ESC) / `\\007` are kept literal so the remote
 * `printf` emits the real control bytes. Idempotent (guards against double
 * registration on bash).
 */
export const OSC7_CWD_SETUP =
  `{ if [ -n "$ZSH_VERSION" ]; then ` +
  `__bifrost_osc7(){ printf '\\033]7;file://%s%s\\007' "\${HOST:-$HOSTNAME}" "$PWD"; }; ` +
  `typeset -ga precmd_functions; ` +
  `case " \${precmd_functions[*]} " in *" __bifrost_osc7 "*) ;; *) precmd_functions+=(__bifrost_osc7);; esac; ` +
  `elif [ -n "$BASH_VERSION" ]; then ` +
  `__bifrost_osc7(){ printf '\\033]7;file://%s%s\\007' "$HOSTNAME" "$PWD"; }; ` +
  `case "$PROMPT_COMMAND" in *__bifrost_osc7*) ;; *) PROMPT_COMMAND="__bifrost_osc7;\${PROMPT_COMMAND}";; esac; ` +
  `fi; __bifrost_osc7; }`
