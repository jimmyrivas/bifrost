import { useCallback, useEffect, useMemo, useState } from 'react'
import { AIAssistant } from './AIAssistant'

/**
 * Standalone wrapper rendered in the detached AI Assistant window (?aiDetach=1).
 *
 * It follows the main window's active tab live: the main window forwards
 * `{ connectionId, terminalId }` via `onAiActiveContextChanged`, which we use both
 * for AI context (connectionId) and to route inserted commands to the right terminal.
 */
export function DetachedAIAssistant(): JSX.Element {
  const initialConnId = useMemo(
    () => new URLSearchParams(window.location.search).get('connId') || null,
    []
  )

  const [connectionId, setConnectionId] = useState<string | null>(initialConnId)
  const [terminalId, setTerminalId] = useState<string | null>(null)

  // Follow the main window's active tab live.
  useEffect(() => {
    const off = window.bifrost?.window?.onAiActiveContextChanged?.((ctx) => {
      setConnectionId(ctx.connectionId ?? null)
      setTerminalId(ctx.terminalId ?? null)
    })
    return () => off?.()
  }, [])

  const handleReattach = useCallback(() => {
    window.bifrost?.window?.reattachAi().catch((err) => console.error('Reattach AI failed:', err))
  }, [])

  // Insert a command into whatever terminal is currently active in the main window.
  const handleInsertCommand = useCallback(
    (command: string) => {
      if (!terminalId) return
      if (terminalId.startsWith('ssh:')) {
        window.bifrost?.ssh?.write(terminalId.slice(4), command)
      } else {
        window.bifrost?.terminal?.write(terminalId, command)
      }
    },
    [terminalId]
  )

  return (
    <div className="h-screen w-screen bg-[#131316]">
      <AIAssistant
        open
        detached
        onClose={handleReattach}
        onInsertCommand={handleInsertCommand}
        connectionContext={connectionId}
      />
    </div>
  )
}
