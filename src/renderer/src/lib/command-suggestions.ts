interface CommandSuggestion {
  query: string[]
  command: string
  description: string
}

const SUGGESTIONS: CommandSuggestion[] = [
  { query: ['list', 'files'], command: 'ls -la', description: 'List all files with details' },
  { query: ['disk', 'space', 'usage'], command: 'df -h', description: 'Show disk space usage' },
  { query: ['directory', 'size'], command: 'du -sh *', description: 'Show directory sizes' },
  { query: ['memory', 'ram', 'usage'], command: 'free -h', description: 'Show memory usage' },
  { query: ['cpu', 'processes', 'top'], command: 'htop || top', description: 'Show running processes' },
  { query: ['find', 'file', 'search'], command: 'find . -name "FILENAME"', description: 'Find file by name' },
  { query: ['search', 'text', 'grep'], command: 'grep -rn "PATTERN" .', description: 'Search text in files' },
  { query: ['network', 'ports', 'listening'], command: 'ss -tulnp', description: 'Show listening ports' },
  { query: ['ip', 'address', 'network'], command: 'ip addr show', description: 'Show IP addresses' },
  { query: ['ping', 'test', 'connectivity'], command: 'ping -c 4 HOST', description: 'Test network connectivity' },
  { query: ['dns', 'resolve', 'lookup'], command: 'nslookup HOSTNAME', description: 'DNS lookup' },
  { query: ['service', 'status', 'systemctl'], command: 'systemctl status SERVICE', description: 'Check service status' },
  { query: ['restart', 'service'], command: 'sudo systemctl restart SERVICE', description: 'Restart a service' },
  { query: ['log', 'journal', 'syslog'], command: 'journalctl -xe --no-pager -n 50', description: 'View recent system logs' },
  { query: ['tail', 'follow', 'log'], command: 'tail -f /var/log/syslog', description: 'Follow log file in real time' },
  { query: ['user', 'who', 'logged'], command: 'who', description: 'Show logged-in users' },
  { query: ['uptime', 'load'], command: 'uptime', description: 'Show system uptime and load' },
  { query: ['kill', 'process', 'stop'], command: 'kill -9 PID', description: 'Force kill a process' },
  { query: ['compress', 'tar', 'archive'], command: 'tar -czf archive.tar.gz DIRECTORY', description: 'Create compressed archive' },
  { query: ['extract', 'untar', 'decompress'], command: 'tar -xzf archive.tar.gz', description: 'Extract archive' },
  { query: ['copy', 'scp', 'remote'], command: 'scp file.txt user@host:/path/', description: 'Copy file to remote host' },
  { query: ['permission', 'chmod'], command: 'chmod 755 FILE', description: 'Set file permissions' },
  { query: ['owner', 'chown'], command: 'sudo chown user:group FILE', description: 'Change file ownership' },
  { query: ['docker', 'container', 'running'], command: 'docker ps', description: 'List running containers' },
  { query: ['docker', 'logs'], command: 'docker logs -f CONTAINER', description: 'Follow container logs' },
  { query: ['kubernetes', 'pods', 'k8s'], command: 'kubectl get pods', description: 'List Kubernetes pods' },
  { query: ['git', 'status'], command: 'git status', description: 'Show git repository status' },
  { query: ['git', 'log', 'history'], command: 'git log --oneline -20', description: 'Show recent git commits' },
  { query: ['cron', 'scheduled', 'jobs'], command: 'crontab -l', description: 'List cron jobs' },
  { query: ['firewall', 'iptables', 'rules'], command: 'sudo iptables -L -n', description: 'List firewall rules' },
  { query: ['ssh', 'key', 'generate'], command: 'ssh-keygen -t ed25519', description: 'Generate SSH key' },
  { query: ['tmux', 'session', 'list'], command: 'tmux list-sessions', description: 'List tmux sessions' },
  { query: ['environment', 'variables', 'env'], command: 'env | sort', description: 'Show environment variables' },
  { query: ['hostname', 'machine'], command: 'hostname -f', description: 'Show full hostname' },
  { query: ['date', 'time'], command: 'date', description: 'Show current date and time' },
  { query: ['kernel', 'version', 'os'], command: 'uname -a', description: 'Show kernel/OS information' }
]

const WINDOWS_SUGGESTIONS: CommandSuggestion[] = [
  { query: ['list', 'files', 'directory'], command: 'Get-ChildItem', description: 'List files and directories' },
  { query: ['disk', 'space', 'usage'], command: 'Get-Volume', description: 'Show disk volume info' },
  { query: ['directory', 'size'], command: 'Get-ChildItem -Recurse | Measure-Object -Property Length -Sum', description: 'Calculate directory size' },
  { query: ['memory', 'ram'], command: 'Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum', description: 'Show physical memory' },
  { query: ['cpu', 'processes', 'top'], command: 'Get-Process | Sort-Object CPU -Descending | Select-Object -First 10', description: 'Top 10 CPU consumers' },
  { query: ['find', 'file', 'search'], command: 'Get-ChildItem -Recurse -Filter "FILENAME"', description: 'Find file by name' },
  { query: ['search', 'text', 'grep'], command: 'Select-String -Path * -Pattern "PATTERN"', description: 'Search text in files' },
  { query: ['network', 'ports', 'listening'], command: 'Get-NetTCPConnection -State Listen', description: 'Show listening TCP ports' },
  { query: ['ip', 'address', 'network'], command: 'Get-NetIPAddress | Format-Table', description: 'Show IP addresses' },
  { query: ['ping', 'test', 'connectivity'], command: 'Test-Connection HOST -Count 4', description: 'Test network connectivity' },
  { query: ['dns', 'resolve', 'lookup'], command: 'Resolve-DnsName HOSTNAME', description: 'DNS lookup' },
  { query: ['service', 'status'], command: 'Get-Service SERVICE', description: 'Check service status' },
  { query: ['restart', 'service'], command: 'Restart-Service SERVICE', description: 'Restart a service' },
  { query: ['log', 'event', 'syslog'], command: 'Get-EventLog -LogName System -Newest 50', description: 'View recent system events' },
  { query: ['user', 'who', 'logged'], command: 'query user', description: 'Show logged-in users' },
  { query: ['uptime', 'boot'], command: '(Get-CimInstance Win32_OperatingSystem).LastBootUpTime', description: 'Show last boot time' },
  { query: ['kill', 'process', 'stop'], command: 'Stop-Process -Id PID -Force', description: 'Force kill a process' },
  { query: ['firewall', 'rules'], command: 'Get-NetFirewallRule | Where-Object Enabled -eq True | Format-Table', description: 'List active firewall rules' },
  { query: ['environment', 'variables', 'env'], command: 'Get-ChildItem Env: | Sort-Object Name', description: 'Show environment variables' },
  { query: ['hostname', 'machine'], command: 'hostname', description: 'Show computer name' },
  { query: ['kernel', 'version', 'os'], command: '[System.Environment]::OSVersion', description: 'Show OS version' },
  { query: ['docker', 'container'], command: 'docker ps', description: 'List running containers' },
  { query: ['git', 'status'], command: 'git status', description: 'Show git repository status' }
]

const IS_WINDOWS = typeof navigator !== 'undefined' && navigator.platform?.startsWith('Win')

export function getFallbackSuggestions(query: string): Array<{ command: string; description: string }> {
  const lower = query.toLowerCase()
  const words = lower.split(/\s+/)

  const allSuggestions = IS_WINDOWS ? [...WINDOWS_SUGGESTIONS, ...SUGGESTIONS] : SUGGESTIONS
  const scored = allSuggestions.map((s) => {
    let score = 0
    for (const word of words) {
      for (const keyword of s.query) {
        if (keyword.includes(word) || word.includes(keyword)) {
          score += word === keyword ? 3 : 1
        }
      }
      if (s.command.toLowerCase().includes(word)) score += 1
      if (s.description.toLowerCase().includes(word)) score += 1
    }
    return { ...s, score }
  })

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(({ command, description }) => ({ command, description }))
}
