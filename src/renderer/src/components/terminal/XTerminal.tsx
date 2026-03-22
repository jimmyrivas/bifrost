import { useTerminal } from '@renderer/hooks/useTerminal'
import '@xterm/xterm/css/xterm.css'

interface XTerminalProps {
  paneId: string
  onTerminalCreated?: (terminalId: string) => void
}

export function XTerminal({ paneId, onTerminalCreated }: XTerminalProps): JSX.Element {
  const { containerRef } = useTerminal({ paneId, onTerminalCreated })

  return (
    <div
      ref={containerRef}
      className="xterm-container w-full h-full"
      data-pane-id={paneId}
    />
  )
}
