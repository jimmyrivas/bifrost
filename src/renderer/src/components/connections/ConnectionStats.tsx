import { useState, useEffect } from 'react'
import { Activity, Clock, Plug, TrendingUp } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

interface ConnectionStatsProps {
  connectionId: string
  connectionName: string
}

interface StatsData {
  totalConnects: number
  lastConnected: string | null
  totalTimeSeconds: number
  avgSessionSeconds: number
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const remainMins = mins % 60
  if (hours < 24) return `${hours}h ${remainMins}m`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)

  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}

export function ConnectionStats({ connectionId, connectionName }: ConnectionStatsProps): JSX.Element {
  const [stats, setStats] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    window.bifrost?.audit
      ?.query({ connectionId, limit: 1000 })
      .then((events) => {
        const connects = events.filter((e) => e.event === 'connect')
        const disconnects = events.filter((e) => e.event === 'disconnect')

        let totalTime = 0
        for (let i = 0; i < connects.length; i++) {
          const connectTime = new Date(connects[i].timestamp).getTime()
          const disconnectEvent = disconnects.find(
            (d) => new Date(d.timestamp).getTime() > connectTime
          )
          if (disconnectEvent) {
            totalTime += new Date(disconnectEvent.timestamp).getTime() - connectTime
          }
        }

        const totalTimeSeconds = totalTime / 1000
        const avgSession = connects.length > 0 ? totalTimeSeconds / connects.length : 0
        const lastConnect = connects.length > 0 ? connects[0].timestamp : null

        setStats({
          totalConnects: connects.length,
          lastConnected: lastConnect,
          totalTimeSeconds,
          avgSessionSeconds: avgSession
        })
      })
      .catch(() => {
        setStats({ totalConnects: 0, lastConnected: null, totalTimeSeconds: 0, avgSessionSeconds: 0 })
      })
      .finally(() => setLoading(false))
  }, [connectionId])

  if (loading) {
    return (
      <div className="px-3 py-4 text-xs text-[var(--on-surface-variant)] text-center">
        Loading statistics...
      </div>
    )
  }

  const items = [
    {
      icon: Plug,
      label: 'Total Connects',
      value: stats?.totalConnects.toString() ?? '0'
    },
    {
      icon: Clock,
      label: 'Last Connected',
      value: stats?.lastConnected ? formatDate(stats.lastConnected) : 'Never'
    },
    {
      icon: Activity,
      label: 'Total Time',
      value: formatDuration(stats?.totalTimeSeconds ?? 0)
    },
    {
      icon: TrendingUp,
      label: 'Avg Session',
      value: formatDuration(stats?.avgSessionSeconds ?? 0)
    }
  ]

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--on-surface-variant)]">
        {connectionName}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className={cn(
              'flex flex-col gap-1 p-2 rounded-[var(--radius)]',
              'bg-[var(--surface-container-high)]'
            )}
          >
            <div className="flex items-center gap-1.5">
              <Icon size={10} className="text-[var(--on-surface-variant)]" />
              <span className="text-[9px] text-[var(--on-surface-variant)] uppercase tracking-wider">
                {label}
              </span>
            </div>
            <span className="text-sm font-semibold text-[var(--on-surface)] font-[family-name:var(--font-mono)]">
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
