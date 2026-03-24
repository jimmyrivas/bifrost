import { EventEmitter } from 'events'
import { execFile } from 'child_process'

export interface HealthStatus {
  connectionId: string
  host: string
  reachable: boolean
  latencyMs: number | null
  checkedAt: string
}

export class ConnectionHealthMonitor extends EventEmitter {
  private intervals = new Map<string, ReturnType<typeof setInterval>>()
  private statuses = new Map<string, HealthStatus>()

  /**
   * Start monitoring a host with periodic pings.
   */
  startMonitoring(connectionId: string, host: string, intervalMs = 30000): void {
    this.stopMonitoring(connectionId)

    const check = (): void => {
      this.ping(host).then((result) => {
        const status: HealthStatus = {
          connectionId,
          host,
          reachable: result.reachable,
          latencyMs: result.latencyMs,
          checkedAt: new Date().toISOString()
        }
        this.statuses.set(connectionId, status)
        this.emit('health-update', status)
      })
    }

    check()
    this.intervals.set(connectionId, setInterval(check, intervalMs))
  }

  stopMonitoring(connectionId: string): void {
    const interval = this.intervals.get(connectionId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(connectionId)
    }
    this.statuses.delete(connectionId)
  }

  stopAll(): void {
    for (const [id] of this.intervals) {
      this.stopMonitoring(id)
    }
  }

  getStatus(connectionId: string): HealthStatus | undefined {
    return this.statuses.get(connectionId)
  }

  getAllStatuses(): HealthStatus[] {
    return Array.from(this.statuses.values())
  }

  ping(host: string): Promise<{ reachable: boolean; latencyMs: number | null }> {
    // Validate host to prevent injection
    if (!/^[a-zA-Z0-9._\-:[\]]+$/.test(host)) {
      return Promise.resolve({ reachable: false, latencyMs: null })
    }
    return new Promise((resolve) => {
      execFile(
        'ping', ['-c', '1', '-W', '3', host],
        { timeout: 5000, encoding: 'utf-8' },
        (error, stdout) => {
          if (error) {
            resolve({ reachable: false, latencyMs: null })
            return
          }

          // Parse latency from ping output
          const match = stdout.match(/time[=<](\d+(?:\.\d+)?)\s*ms/)
          const latencyMs = match ? parseFloat(match[1]) : null
          resolve({ reachable: true, latencyMs })
        }
      )
    })
  }
}

export const connectionHealthMonitor = new ConnectionHealthMonitor()
