import { useTerminal } from '@renderer/hooks/useTerminal'
import '@xterm/xterm/css/xterm.css'

interface XTerminalProps {
  paneId: string
  connectionId?: string | null
  onTerminalCreated?: (terminalId: string) => void
}

export function XTerminal({ paneId, connectionId, onTerminalCreated }: XTerminalProps): JSX.Element {
  const { containerRef } = useTerminal({ paneId, connectionId, onTerminalCreated })

  return (
    <div
      ref={containerRef}
      className="xterm-container w-full h-full"
      data-pane-id={paneId}
    />
  )
}
