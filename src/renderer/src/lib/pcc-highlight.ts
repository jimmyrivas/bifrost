/**
 * #71: PCC syntax highlighting utilities.
 *
 * Tokenizes PCC input lines to highlight shell commands, comments, and variables.
 */

/** Common shell commands for syntax highlighting */
const SHELL_COMMANDS = new Set([
  'ls', 'cd', 'grep', 'find', 'cat', 'echo', 'mkdir', 'rm', 'cp', 'mv',
  'chmod', 'chown', 'ssh', 'scp', 'rsync', 'curl', 'wget', 'tar', 'gzip',
  'apt', 'yum', 'dnf', 'pacman', 'brew', 'pip', 'npm', 'git', 'docker',
  'kubectl', 'systemctl', 'journalctl', 'ps', 'kill', 'top', 'htop',
  'awk', 'sed', 'sort', 'uniq', 'wc', 'head', 'tail', 'less', 'more',
  'df', 'du', 'mount', 'umount', 'ifconfig', 'ip', 'ping', 'traceroute',
  'netstat', 'ss', 'iptables', 'sudo', 'su', 'whoami', 'hostname', 'uname'
])

type TokenType = 'command' | 'comment' | 'variable' | 'plain'

interface Token {
  text: string
  type: TokenType
}

/** Tokenize a single line for syntax highlighting */
function tokenizeLine(line: string): Token[] {
  const trimmed = line.trimStart()

  if (trimmed.startsWith('#')) {
    return [{ text: line, type: 'comment' }]
  }

  const tokens: Token[] = []
  const varRe = /\$\{?\w+\}?/g
  let lastIdx = 0

  const firstWord = trimmed.split(/\s/)[0]
  const leadingSpaces = line.length - trimmed.length

  if (SHELL_COMMANDS.has(firstWord)) {
    if (leadingSpaces > 0) {
      tokens.push({ text: line.slice(0, leadingSpaces), type: 'plain' })
    }
    tokens.push({ text: firstWord, type: 'command' })
    lastIdx = leadingSpaces + firstWord.length
  }

  varRe.lastIndex = lastIdx
  let match: RegExpExecArray | null
  while ((match = varRe.exec(line)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ text: line.slice(lastIdx, match.index), type: 'plain' })
    }
    tokens.push({ text: match[0], type: 'variable' })
    lastIdx = match.index + match[0].length
  }

  if (lastIdx < line.length) {
    tokens.push({ text: line.slice(lastIdx), type: 'plain' })
  }

  return tokens.length > 0 ? tokens : [{ text: line, type: 'plain' }]
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const COLOR_MAP: Record<TokenType, string | null> = {
  command: '#6bd5ff',
  comment: '#6b6b6b',
  variable: '#ffd56b',
  plain: null
}

/** Generate HTML for syntax-highlighted PCC input */
export function highlightPccInput(text: string): string {
  return text.split('\n').map((line) => {
    return tokenizeLine(line)
      .map((tok) => {
        const escaped = escapeHtml(tok.text)
        const color = COLOR_MAP[tok.type]
        if (!color) return escaped
        const style = tok.type === 'comment' ? `color:${color};font-style:italic` : `color:${color}`
        return `<span style="${style}">${escaped}</span>`
      })
      .join('')
  }).join('\n')
}
