import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'

export interface Snippet {
  id: string
  name: string
  command: string
  description?: string
  category: string
  tags: string[]
  variables: string[] // extracted {{var}} patterns
  createdAt: string
  updatedAt: string
}

const DEFAULT_SNIPPETS: Snippet[] = [
  // Kubernetes
  { id: 'k8s-pods', name: 'List Pods', command: 'kubectl get pods -n {{namespace}}', description: 'List all pods in a namespace', category: 'Kubernetes', tags: ['k8s', 'pods'], variables: ['namespace'], createdAt: '', updatedAt: '' },
  { id: 'k8s-logs', name: 'Pod Logs', command: 'kubectl logs -f {{pod}} -n {{namespace}} --tail={{lines}}', description: 'Stream logs from a pod', category: 'Kubernetes', tags: ['k8s', 'logs'], variables: ['pod', 'namespace', 'lines'], createdAt: '', updatedAt: '' },
  { id: 'k8s-exec', name: 'Exec into Pod', command: 'kubectl exec -it {{pod}} -n {{namespace}} -- /bin/sh', description: 'Interactive shell in pod', category: 'Kubernetes', tags: ['k8s', 'exec'], variables: ['pod', 'namespace'], createdAt: '', updatedAt: '' },
  { id: 'k8s-describe', name: 'Describe Pod', command: 'kubectl describe pod {{pod}} -n {{namespace}}', description: 'Detailed pod info', category: 'Kubernetes', tags: ['k8s'], variables: ['pod', 'namespace'], createdAt: '', updatedAt: '' },
  // Docker
  { id: 'docker-ps', name: 'List Containers', command: 'docker ps --format "table {{`{{.Names}}`}}\t{{`{{.Status}}`}}\t{{`{{.Ports}}`}}"', description: 'List running containers', category: 'Docker', tags: ['docker'], variables: [], createdAt: '', updatedAt: '' },
  { id: 'docker-logs', name: 'Container Logs', command: 'docker logs -f --tail={{lines}} {{container}}', description: 'Stream container logs', category: 'Docker', tags: ['docker', 'logs'], variables: ['container', 'lines'], createdAt: '', updatedAt: '' },
  { id: 'docker-exec', name: 'Exec into Container', command: 'docker exec -it {{container}} /bin/sh', description: 'Shell into container', category: 'Docker', tags: ['docker', 'exec'], variables: ['container'], createdAt: '', updatedAt: '' },
  // Systemd
  { id: 'systemd-status', name: 'Service Status', command: 'systemctl status {{service}}', description: 'Check service status', category: 'Systemd', tags: ['systemd', 'service'], variables: ['service'], createdAt: '', updatedAt: '' },
  { id: 'systemd-logs', name: 'Service Logs', command: 'journalctl -u {{service}} -f --since "{{since}}"', description: 'Stream service logs', category: 'Systemd', tags: ['systemd', 'logs'], variables: ['service', 'since'], createdAt: '', updatedAt: '' },
  { id: 'systemd-restart', name: 'Restart Service', command: 'sudo systemctl restart {{service}}', description: 'Restart a service', category: 'Systemd', tags: ['systemd'], variables: ['service'], createdAt: '', updatedAt: '' },
  // Networking
  { id: 'net-ports', name: 'Open Ports', command: 'ss -tlnp', description: 'List listening TCP ports', category: 'Networking', tags: ['network', 'ports'], variables: [], createdAt: '', updatedAt: '' },
  { id: 'net-connections', name: 'Active Connections', command: 'ss -tnp | head -{{lines}}', description: 'Show active TCP connections', category: 'Networking', tags: ['network'], variables: ['lines'], createdAt: '', updatedAt: '' },
  { id: 'net-dns', name: 'DNS Lookup', command: 'dig {{domain}} +short', description: 'Quick DNS lookup', category: 'Networking', tags: ['network', 'dns'], variables: ['domain'], createdAt: '', updatedAt: '' },
  { id: 'net-curl', name: 'HTTP Request', command: 'curl -v -X {{method}} {{url}} -H "Content-Type: application/json"', description: 'Make HTTP request', category: 'Networking', tags: ['network', 'http'], variables: ['method', 'url'], createdAt: '', updatedAt: '' },
  // Disk & Files
  { id: 'disk-usage', name: 'Disk Usage', command: 'df -h', description: 'Show disk space', category: 'System', tags: ['disk'], variables: [], createdAt: '', updatedAt: '' },
  { id: 'disk-top', name: 'Large Files', command: 'du -sh {{path}}/* | sort -rh | head -{{lines}}', description: 'Find largest files/dirs', category: 'System', tags: ['disk', 'files'], variables: ['path', 'lines'], createdAt: '', updatedAt: '' },
  { id: 'sys-resources', name: 'System Resources', command: 'top -bn1 | head -20', description: 'CPU & memory overview', category: 'System', tags: ['system', 'monitoring'], variables: [], createdAt: '', updatedAt: '' },
  { id: 'sys-uptime', name: 'Uptime', command: 'uptime && free -h && df -h /', description: 'Quick system health check', category: 'System', tags: ['system'], variables: [], createdAt: '', updatedAt: '' },
  // Security
  { id: 'sec-ssh-keys', name: 'SSH Authorized Keys', command: 'cat ~/.ssh/authorized_keys', description: 'View authorized SSH keys', category: 'Security', tags: ['ssh', 'security'], variables: [], createdAt: '', updatedAt: '' },
  { id: 'sec-failed-logins', name: 'Failed Logins', command: 'grep "Failed password" /var/log/auth.log | tail -{{lines}}', description: 'Recent failed SSH logins', category: 'Security', tags: ['security', 'audit'], variables: ['lines'], createdAt: '', updatedAt: '' },
  { id: 'sec-firewall', name: 'Firewall Rules', command: 'sudo iptables -L -n -v', description: 'List firewall rules', category: 'Security', tags: ['security', 'firewall'], variables: [], createdAt: '', updatedAt: '' },
]

export class SnippetManager {
  private snippets: Snippet[] = []
  private filePath: string | null = null

  private ensureFile(): string {
    if (!this.filePath) {
      const dir = join(app.getPath('userData'), 'snippets')
      mkdirSync(dir, { recursive: true })
      this.filePath = join(dir, 'snippets.json')

      if (existsSync(this.filePath)) {
        this.snippets = JSON.parse(readFileSync(this.filePath, 'utf-8'))
      } else {
        const now = new Date().toISOString()
        this.snippets = DEFAULT_SNIPPETS.map((s) => ({
          ...s,
          createdAt: now,
          updatedAt: now
        }))
        this.save()
      }
    }
    return this.filePath
  }

  private save(): void {
    if (this.filePath) {
      writeFileSync(this.filePath, JSON.stringify(this.snippets, null, 2), 'utf-8')
    }
  }

  getAll(): Snippet[] {
    this.ensureFile()
    return this.snippets
  }

  getByCategory(category: string): Snippet[] {
    this.ensureFile()
    return this.snippets.filter((s) => s.category === category)
  }

  search(query: string): Snippet[] {
    this.ensureFile()
    const q = query.toLowerCase()
    return this.snippets.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.command.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)) ||
        (s.description ?? '').toLowerCase().includes(q)
    )
  }

  getCategories(): string[] {
    this.ensureFile()
    return [...new Set(this.snippets.map((s) => s.category))]
  }

  add(snippet: Omit<Snippet, 'id' | 'variables' | 'createdAt' | 'updatedAt'>): Snippet {
    this.ensureFile()
    const now = new Date().toISOString()
    const variables = extractVariables(snippet.command)
    const newSnippet: Snippet = {
      ...snippet,
      id: `snippet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      variables,
      createdAt: now,
      updatedAt: now
    }
    this.snippets.push(newSnippet)
    this.save()
    return newSnippet
  }

  update(id: string, updates: Partial<Snippet>): void {
    this.ensureFile()
    const idx = this.snippets.findIndex((s) => s.id === id)
    if (idx !== -1) {
      this.snippets[idx] = {
        ...this.snippets[idx],
        ...updates,
        updatedAt: new Date().toISOString()
      }
      if (updates.command) {
        this.snippets[idx].variables = extractVariables(updates.command)
      }
      this.save()
    }
  }

  delete(id: string): void {
    this.ensureFile()
    this.snippets = this.snippets.filter((s) => s.id !== id)
    this.save()
  }

  resolveCommand(command: string, values: Record<string, string>): string {
    let resolved = command
    for (const [key, value] of Object.entries(values)) {
      resolved = resolved.replaceAll(`{{${key}}}`, value)
    }
    return resolved
  }
}

function extractVariables(command: string): string[] {
  const matches = command.match(/\{\{([^}]+)\}\}/g)
  if (!matches) return []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

export const snippetManager = new SnippetManager()
