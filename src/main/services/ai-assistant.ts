const OLLAMA_BASE = 'http://localhost:11434'

export interface AiSuggestionChunk {
  text: string
  done: boolean
}

export async function checkOllamaAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 3000)
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok
  } catch {
    return false
  }
}

export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`)
    if (!res.ok) return []
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    return data.models?.map((m) => m.name) ?? []
  } catch {
    return []
  }
}

function pickModel(models: string[]): string | null {
  const preferred = ['qwen2.5-coder', 'codellama', 'deepseek-coder', 'starcoder']
  for (const pref of preferred) {
    const match = models.find((m) => m.startsWith(pref))
    if (match) return match
  }
  return models[0] ?? null
}

export async function generateSuggestion(
  prompt: string,
  context?: string,
  onChunk?: (chunk: AiSuggestionChunk) => void
): Promise<string> {
  const models = await listModels()
  const model = pickModel(models)
  if (!model) throw new Error('No suitable model found in Ollama')

  const systemPrompt =
    'You are a terminal command assistant. Provide concise, accurate shell commands. ' +
    'Explain briefly what each command does. Format commands in backticks.'

  const fullPrompt = context
    ? `Context: connected to ${context}\n\nUser question: ${prompt}`
    : prompt

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt: fullPrompt, system: systemPrompt, stream: true })
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
      } catch {
        // skip malformed lines
      }
    }
  }

  return fullText
}

export async function explainCommand(command: string): Promise<string> {
  const available = await checkOllamaAvailable()
  if (!available) {
    return getFallbackExplanation(command)
  }

  const models = await listModels()
  const model = pickModel(models)
  if (!model) return getFallbackExplanation(command)

  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: `Explain this shell command concisely: ${command}`,
      system: 'Explain shell commands briefly. One line per flag or argument.',
      stream: false
    })
  })

  if (!res.ok) return getFallbackExplanation(command)
  const data = (await res.json()) as { response?: string }
  return data.response ?? getFallbackExplanation(command)
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
