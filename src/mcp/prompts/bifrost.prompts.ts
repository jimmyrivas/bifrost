/**
 * MCP Prompts: Reusable prompt templates for common infrastructure tasks.
 * These provide structured context for AI agents working with Bifrost.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { listConnections, getConnection, listClusters, getClusterMembers, listTunnels, queryAuditLog } from '../db'

export function registerPrompts(server: McpServer): void {
  server.prompt(
    'troubleshoot_connection',
    'Diagnose SSH connection issues for a specific host. Provides connection config, recent audit events, and diagnostic steps.',
    { connectionId: z.string().describe('Connection ID to troubleshoot') },
    async ({ connectionId }) => {
      const conn = getConnection(connectionId)
      if (!conn) {
        return { messages: [{ role: 'user', content: { type: 'text', text: `Connection ${connectionId} not found.` } }] }
      }

      const recentEvents = queryAuditLog({ connectionId, limit: 10 })
      const eventsSummary = recentEvents.length > 0
        ? recentEvents.map((e) => `  ${e.timestamp} | ${e.event} | ${JSON.stringify(e.details)}`).join('\n')
        : '  No recent audit events'

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Troubleshoot SSH connection to "${conn.name}":

**Connection Config:**
- Host: ${conn.host}
- Port: ${conn.port ?? 22}
- Username: ${conn.username ?? '(none)'}
- Auth Type: ${conn.authType ?? 'unknown'}
- Key Path: ${conn.privateKeyPath ?? '(none)'}
- Network Mode: ${conn.networkMode ?? 'global'}

**Recent Audit Events:**
${eventsSummary}

**Diagnostic Steps:**
1. First, use \`health_ping\` to check if the host is reachable
2. Try \`ssh_connect\` with the connectionId to see the exact error
3. If auth fails, check if the key file exists and has correct permissions
4. If timeout, check firewall rules and network connectivity
5. Review audit events for patterns (repeated auth_fail, host_key_changed, etc.)

Please diagnose the issue and suggest fixes.`
            }
          }
        ]
      }
    }
  )

  server.prompt(
    'deploy_to_cluster',
    'Guide a deployment to a Bifrost cluster with pre-flight checks and rollback plan.',
    {
      clusterId: z.string().describe('Cluster ID to deploy to'),
      description: z.string().optional().describe('What is being deployed')
    },
    async ({ clusterId, description }) => {
      const clusters = listClusters()
      const cluster = clusters.find((c) => c.id === clusterId)
      const memberIds = getClusterMembers(clusterId)
      const members = memberIds.map((id) => getConnection(id)).filter(Boolean)

      const memberList = members.map((m) => `  - ${m!.name} (${m!.host})`).join('\n')

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Deploy to cluster "${cluster?.name ?? clusterId}":

**Cluster Members (${members.length} hosts):**
${memberList}

**Deployment: ${description ?? '(not specified)'}**

**Recommended deployment procedure:**

1. **Pre-flight checks** — Use \`cluster_execute\` to verify:
   - All hosts reachable (\`cluster_multi_host_diff\` with \`uptime\`)
   - Disk space sufficient (\`df -h\`)
   - Current version/state (\`cluster_multi_host_diff\` to detect drift)

2. **Backup** — Before deploying:
   - Snapshot current config/state on each host
   - Note the current version for rollback

3. **Rolling deployment** — Deploy one host at a time:
   - Use \`ssh_execute\` per host (not cluster broadcast)
   - Verify each host before moving to next
   - Monitor for errors between hosts

4. **Verification** — After all hosts deployed:
   - \`cluster_multi_host_diff\` to verify consistent state
   - Run health checks
   - Check application logs

5. **Rollback plan** — If issues detected:
   - Revert to previous version on affected hosts
   - Verify cluster consistency

Please proceed with the deployment, asking me to confirm at each step.`
            }
          }
        ]
      }
    }
  )

  server.prompt(
    'setup_tunnel',
    'Step-by-step guide for creating an SSH tunnel with Bifrost.',
    {
      useCase: z.string().describe('What the tunnel is for (e.g. "access remote database", "expose internal API")')
    },
    async ({ useCase }) => {
      const existing = listTunnels()
      const tunnelList = existing.length > 0
        ? existing.map((t) => `  - ${t.name}: ${t.host}:${t.port} (${JSON.parse(t.forwards).length} forwards)`).join('\n')
        : '  No existing tunnels'

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Help me set up an SSH tunnel for: ${useCase}

**Existing tunnels:**
${tunnelList}

**To create a tunnel, I need:**
1. The SSH host (bastion/jump server) to tunnel through
2. The target service host and port (what you want to reach)
3. The local port to listen on

**Example configurations:**
- Database access: \`localhost:5432 → db.internal:5432\` via bastion
- Internal API: \`localhost:8080 → api.internal:80\` via jump host
- Remote debugging: \`localhost:9229 → app-server:9229\` via bastion

Use \`tunnel_create_adhoc\` for temporary tunnels or \`tunnel_start\` for saved Bifrost tunnels.

What are the specific details for your tunnel?`
            }
          }
        ]
      }
    }
  )

  server.prompt(
    'discover_infrastructure',
    'Map complete cloud infrastructure across all available providers.',
    {},
    async () => {
      const connections = listConnections()
      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Map my complete infrastructure inventory.

**Current Bifrost connections:** ${connections.length} saved

**Discovery plan:**
1. First, run \`discover_available\` to see which CLIs are installed
2. For each available provider, run the corresponding discovery tool:
   - \`discover_aws\` — EC2 instances
   - \`discover_gcp\` — Compute Engine VMs
   - \`discover_azure\` — Azure VMs
   - \`discover_docker\` — Local Docker containers
   - \`discover_kubernetes\` — K8s pods
3. Compare discovered hosts against saved Bifrost connections
4. Identify:
   - Hosts in cloud but not in Bifrost (gaps)
   - Bifrost connections that may be stale (host unreachable)
   - New hosts that should be added

Run the discovery and present a unified inventory.`
            }
          }
        ]
      }
    }
  )

  server.prompt(
    'security_audit',
    'Audit SSH connection security configuration across all connections.',
    {},
    async () => {
      const connections = listConnections({ method: 'ssh' })
      const authTypes = connections.reduce((acc, c) => {
        const t = c.authType ?? 'unknown'
        acc[t] = (acc[t] ?? 0) + 1
        return acc
      }, {} as Record<string, number>)

      const recentFailures = queryAuditLog({ event: 'auth_fail', limit: 20 })
      const hostKeyChanges = queryAuditLog({ event: 'host_key_changed', limit: 10 })

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Perform a security audit of my SSH connections.

**Connection overview:** ${connections.length} SSH connections
**Auth type distribution:** ${JSON.stringify(authTypes)}

**Recent auth failures:** ${recentFailures.length} events
**Host key changes:** ${hostKeyChanges.length} events

**Audit checklist:**
1. **Authentication** — Flag connections using password auth (prefer key-based)
2. **Key files** — Check if referenced key files exist and have secure permissions (600)
3. **Host diversity** — Identify connections to the same host with different configs
4. **Audit trail** — Review recent auth failures for brute-force patterns
5. **Host key changes** — Investigate any unexpected host key changes (potential MITM)
6. **Network modes** — Review proxy/jump configurations for security
7. **Sudo access** — Flag connections with runWithSudo enabled

For each connection using key auth, use \`terminal_execute\` to check:
- \`ls -la <keyPath>\` — permissions should be 600
- \`ssh-keygen -l -f <keyPath>\` — key type and strength

Present findings with severity levels and remediation steps.`
            }
          }
        ]
      }
    }
  )

  server.prompt(
    'migrate_server',
    'Plan a server migration between two hosts.',
    {
      sourceConnectionId: z.string().describe('Source server connection ID'),
      targetConnectionId: z.string().describe('Target server connection ID')
    },
    async ({ sourceConnectionId, targetConnectionId }) => {
      const source = getConnection(sourceConnectionId)
      const target = getConnection(targetConnectionId)

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Plan a server migration:
- **Source:** ${source?.name ?? sourceConnectionId} (${source?.host ?? 'unknown'})
- **Target:** ${target?.name ?? targetConnectionId} (${target?.host ?? 'unknown'})

**Migration procedure:**
1. **Inventory source** — Connect and catalog:
   - Running services (\`systemctl list-units --type=service --state=running\`)
   - Installed packages (\`dpkg -l\` or \`rpm -qa\`)
   - Cron jobs (\`crontab -l\`, \`ls /etc/cron.d/\`)
   - Open ports (\`ss -tlnp\`)
   - Disk usage (\`df -h\`, \`du -sh /*/\`)

2. **Pre-migrate checks on target** — Verify:
   - Sufficient disk space
   - Network connectivity to source
   - Required services installed

3. **Data transfer** — Use SFTP tools or rsync via SSH:
   - Config files
   - Application data
   - User data

4. **Service setup on target** — Install and configure

5. **Verification** — Compare source vs target:
   - Use \`cluster_multi_host_diff\` to compare outputs
   - Test each service

6. **Cutover** — DNS/load balancer switch

Start by connecting to both servers and inventorying the source.`
            }
          }
        ]
      }
    }
  )

  server.prompt(
    'incident_response',
    'Incident response runbook for investigating a server issue.',
    {
      connectionId: z.string().describe('Connection ID of the affected server'),
      symptom: z.string().describe('What symptom or alert triggered the investigation')
    },
    async ({ connectionId, symptom }) => {
      const conn = getConnection(connectionId)

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `**INCIDENT RESPONSE** — ${conn?.name ?? connectionId} (${conn?.host ?? 'unknown'})

**Reported symptom:** ${symptom}

**Triage steps (execute in order):**

1. **Verify reachability** — \`health_ping\` the host
2. **Connect** — \`ssh_connect\` to the server
3. **Quick health check:**
   - \`uptime\` — load average, how long up
   - \`free -h\` — memory usage
   - \`df -h\` — disk space
   - \`top -bn1 | head -20\` — CPU/process overview
   - \`dmesg -T | tail -20\` — kernel messages

4. **Service investigation:**
   - \`systemctl --failed\` — failed services
   - \`journalctl -p err --since "1 hour ago"\` — recent errors

5. **Network check:**
   - \`ss -tlnp\` — listening ports
   - \`ss -tnp | wc -l\` — active connection count

6. **Log review:**
   - \`tail -50 /var/log/syslog\` or \`journalctl -n 50\`
   - Application-specific logs

7. **Document findings** and determine root cause
8. **Apply fix** or escalate

Execute each step and report findings. Flag anything unusual.`
            }
          }
        ]
      }
    }
  )

  server.prompt(
    'bulk_configuration',
    'Configure multiple servers simultaneously using cluster execution.',
    {
      clusterId: z.string().optional().describe('Cluster ID to configure'),
      connectionIds: z.array(z.string()).optional().describe('Or specific connection IDs'),
      task: z.string().describe('What needs to be configured (e.g. "install nginx", "update timezone")')
    },
    async ({ clusterId, connectionIds, task }) => {
      let members: string[] = []
      if (clusterId) {
        members = getClusterMembers(clusterId)
      } else if (connectionIds) {
        members = connectionIds
      }
      const conns = members.map((id) => getConnection(id)).filter(Boolean)
      const hostList = conns.map((c) => `  - ${c!.name} (${c!.host})`).join('\n')

      return {
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Bulk configure ${conns.length} servers.

**Target hosts:**
${hostList}

**Task:** ${task}

**Approach:**
1. **Verify state** — Use \`cluster_multi_host_diff\` to check current state across all hosts
2. **Plan commands** — Determine the exact commands needed
3. **Test on one** — Execute on a single host first using \`ssh_execute\`
4. **Verify test** — Confirm the change worked correctly
5. **Roll out** — Use \`cluster_execute\` to apply to all hosts
6. **Verify all** — Use \`cluster_multi_host_diff\` to confirm consistent state

Please proceed step by step. I'll confirm before the bulk rollout.`
            }
          }
        ]
      }
    }
  )
}
