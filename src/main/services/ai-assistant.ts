/**
 * AI Assistant — Multi-provider LLM integration.
 * Supports: Ollama (local), OpenRouter, OpenAI, DeepSeek.
 * Falls back to offline command library when no provider available.
 */

import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'

export type AiProvider = 'ollama' | 'openrouter' | 'openai' | 'deepseek'

export interface AiConfig {
  provider: AiProvider
  apiKey: string          // Not needed for Ollama
  model: string           // Auto-selected if empty
  ollamaUrl: string       // Default: http://localhost:11434
}

export interface AiSuggestionChunk {
  text: string
  done: boolean
}

const AI_CONFIG_KEY = 'ai_config'

const DEFAULT_CONFIG: AiConfig = {
  provider: 'ollama',
  apiKey: '',
  model: '',
  ollamaUrl: 'http://localhost:11434'
}

let config: AiConfig = { ...DEFAULT_CONFIG }

/** Load AI config from the preferences table. Call once at startup. */
export function loadAiConfig(): void {
  try {
    const db = getDatabase()
    const row = db.select().from(schema.preferences).where(eq(schema.preferences.key, AI_CONFIG_KEY)).get()
    if (row?.value) {
      const saved = JSON.parse(row.value) as Partial<AiConfig>
      config = { ...DEFAULT_CONFIG, ...saved }
    }
  } catch {
    // DB not ready or malformed — keep defaults
  }
}

export function setAiConfig(cfg: Partial<AiConfig>): void {
  config = { ...config, ...cfg }
  // Persist to DB
  try {
    const db = getDatabase()
    const json = JSON.stringify(config)
    db.insert(schema.preferences)
      .values({ key: AI_CONFIG_KEY, value: json })
      .onConflictDoUpdate({ target: schema.preferences.key, set: { value: json } })
      .run()
  } catch {
    // Non-fatal — config still in memory for this session
  }
}

export function getAiConfig(): AiConfig {
  return { ...config }
}

// ═══════════════════════════════════════════
// Provider URLs and default models
// ═══════════════════════════════════════════

const PROVIDER_URLS: Record<AiProvider, string> = {
  ollama: '', // Uses ollamaUrl from config
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions'
}

const DEFAULT_MODELS: Record<AiProvider, string> = {
  ollama: 'qwen2.5-coder',
  openrouter: 'anthropic/claude-3.5-haiku',
  openai: 'gpt-4o-mini',
  deepseek: 'deepseek-chat'
}

// ═══════════════════════════════════════════
// Ollama-specific functions
// ═══════════════════════════════════════════

export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${config.ollamaUrl}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

export async function listModels(): Promise<string[]> {
  if (config.provider !== 'ollama') {
    return [config.model || DEFAULT_MODELS[config.provider]]
  }
  try {
    const res = await fetch(`${config.ollamaUrl}/api/tags`)
    if (!res.ok) return []
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    return data.models?.map((m) => m.name) ?? []
  } catch {
    return []
  }
}

// ═══════════════════════════════════════════
// Check if any AI provider is available
// ═══════════════════════════════════════════

export async function checkAvailable(): Promise<boolean> {
  if (config.provider === 'ollama') {
    return checkOllamaAvailable()
  }
  // For API providers, just check that we have a key
  return !!config.apiKey
}

// ═══════════════════════════════════════════
// Unified generation — routes to correct provider
// ═══════════════════════════════════════════

export async function generateSuggestion(
  prompt: string,
  context?: string,
  onChunk?: (chunk: AiSuggestionChunk) => void
): Promise<string> {
  const systemPrompt =
    'You are a terminal command assistant embedded in Bifrost, a connection manager for sysadmins and DevOps engineers. ' +
    'Provide concise, accurate shell commands for the user\'s current environment. ' +
    'Format commands in backticks for inline or fenced code blocks for multi-line. ' +
    'Explain briefly what each command does. Use markdown formatting (headers, lists, bold). ' +
    'Be direct, practical, and context-aware. If terminal output is provided, use it to give relevant suggestions.'

  // Sanitize inputs to mitigate prompt injection
  const safeContext = context ? context.replace(/[\x00-\x1f]/g, '').slice(0, 1500) : ''
  const safePrompt = prompt.replace(/[\x00-\x1f]/g, '').slice(0, 2000)

  const fullPrompt = safeContext
    ? `${safeContext}\n\nUser question: ${safePrompt}`
    : safePrompt

  if (config.provider === 'ollama') {
    return generateOllama(fullPrompt, systemPrompt, onChunk)
  }
  return generateOpenAICompatible(fullPrompt, systemPrompt, onChunk)
}

// ═══════════════════════════════════════════
// Ollama provider
// ═══════════════════════════════════════════

async function generateOllama(
  prompt: string,
  systemPrompt: string,
  onChunk?: (chunk: AiSuggestionChunk) => void
): Promise<string> {
  const models = await listModels()
  const preferred = ['qwen2.5-coder', 'codellama', 'deepseek-coder', 'starcoder']
  let model = config.model
  if (!model) {
    for (const pref of preferred) {
      const match = models.find((m) => m.startsWith(pref))
      if (match) { model = match; break }
    }
    if (!model) model = models[0]
  }
  if (!model) throw new Error('No suitable model found in Ollama')

  const res = await fetch(`${config.ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, system: systemPrompt, stream: true })
  })

  if (!res.ok) throw new Error(`Ollama returned ${res.status}`)
  if (!res.body) throw new Error('No response body')

  let fullText = ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    for (const line of text.split('\n').filter(Boolean)) {
      try {
        const parsed = JSON.parse(line) as { response?: string; done?: boolean }
        if (parsed.response) {
          fullText += parsed.response
          onChunk?.({ text: parsed.response, done: parsed.done ?? false })
        }
      } catch { /* skip */ }
    }
  }

  return fullText
}

// ═══════════════════════════════════════════
// OpenAI-compatible provider (OpenAI, OpenRouter, DeepSeek)
// ═══════════════════════════════════════════

async function generateOpenAICompatible(
  prompt: string,
  systemPrompt: string,
  onChunk?: (chunk: AiSuggestionChunk) => void
): Promise<string> {
  if (!config.apiKey) throw new Error(`API key required for ${config.provider}`)

  const url = PROVIDER_URLS[config.provider]
  const model = config.model || DEFAULT_MODELS[config.provider]

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.apiKey}`
  }

  // OpenRouter requires extra headers
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://bifrost-app.dev'
    headers['X-Title'] = 'Bifrost Connection Manager'
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ],
    stream: true,
    max_tokens: 1024
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`${config.provider} API error ${res.status}: ${errText.slice(0, 200)}`)
  }
  if (!res.body) throw new Error('No response body')

  let fullText = ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    for (const line of text.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed === 'data: [DONE]') continue
      if (trimmed.startsWith('data: ')) {
        try {
          const parsed = JSON.parse(trimmed.slice(6)) as {
            choices?: Array<{ delta?: { content?: string }; finish_reason?: string }>
          }
          const content = parsed.choices?.[0]?.delta?.content
          if (content) {
            fullText += content
            onChunk?.({ text: content, done: false })
          }
          if (parsed.choices?.[0]?.finish_reason === 'stop') {
            onChunk?.({ text: '', done: true })
          }
        } catch { /* skip */ }
      }
    }
  }

  return fullText
}

// ═══════════════════════════════════════════
// Command explanation (uses same provider)
// ═══════════════════════════════════════════

export async function explainCommand(command: string): Promise<string> {
  const available = await checkAvailable()
  if (!available) return getFallbackExplanation(command)

  try {
    return await generateSuggestion(
      `Explain this shell command concisely: ${command}`,
      undefined,
      undefined
    )
  } catch {
    return getFallbackExplanation(command)
  }
}

function getFallbackExplanation(command: string): string {
  const cmd = command.trim().split(/\s+/)[0]
  const explanations: Record<string, string> = {
    ls: 'List directory contents',
    cd: 'Change directory',
    pwd: 'Print working directory',
    cat: 'Concatenate and display file contents',
    grep: 'Search text using patterns',
    find: 'Search for files in directory hierarchy',
    chmod: 'Change file permissions',
    chown: 'Change file owner and group',
    cp: 'Copy files and directories',
    mv: 'Move or rename files',
    rm: 'Remove files or directories',
    mkdir: 'Create directories',
    ssh: 'Secure shell remote login',
    scp: 'Secure copy over SSH',
    rsync: 'Remote file synchronization',
    tar: 'Archive files',
    curl: 'Transfer data from or to a server',
    wget: 'Download files from the web',
    ps: 'Report process status',
    kill: 'Send signal to a process',
    top: 'Display system processes',
    htop: 'Interactive process viewer',
    df: 'Report filesystem disk space usage',
    du: 'Estimate file space usage',
    tail: 'Output the last part of files',
    head: 'Output the first part of files',
    sed: 'Stream editor for text transformation',
    awk: 'Pattern scanning and processing',
    systemctl: 'Control the systemd system and service manager',
    journalctl: 'Query the systemd journal',
    docker: 'Container management platform',
    kubectl: 'Kubernetes command-line tool',
    git: 'Distributed version control system',
    tmux: 'Terminal multiplexer',
    screen: 'Terminal multiplexer',
    nano: 'Simple text editor',
    vim: 'Programmable text editor',
    ping: 'Send ICMP echo requests',
    traceroute: 'Print the route packets trace to a host',
    netstat: 'Network statistics',
    ss: 'Socket statistics',
    ip: 'Show/manipulate routing, devices, tunnels',
    iptables: 'Administration tool for IPv4 packet filtering'
  }
  return explanations[cmd ?? ''] ?? `Runs the '${cmd}' command`
}
