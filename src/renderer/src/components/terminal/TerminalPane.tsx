import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { cn } from '@renderer/lib/utils'
import { XTerminal } from './XTerminal'
import { useSessionsStore, type TerminalPane as TerminalPaneType, type TerminalStyle } from '@renderer/stores/sessions.store'

const SPECTRAL_GRADIENT =
  'linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff)'

interface TerminalPaneProps {
  pane: TerminalPaneType
  tabId: string
  connectionId?: string | null
  terminalStyle?: TerminalStyle
  shell?: string
  shellArgs?: string[]
}

function isPaneVisible(pane: TerminalPaneType, targetId: string): boolean {
  if (pane.id === targetId) return true
  if (pane.split) {
    return isPaneVisible(pane.split.panes[0], targetId) || isPaneVisible(pane.split.panes[1], targetId)
  }
  return false
}

export function TerminalPane({ pane, tabId, connectionId, terminalStyle, shell, shellArgs }: TerminalPaneProps): JSX.Element {
  const setTerminalId = useSessionsStore((s) => s.setTerminalId)
  const maximizedPaneId = useSessionsStore((s) => s.maximizedPaneId)

  if (pane.split) {
    const { direction, panes } = pane.split
    const isHorizontal = direction === 'horizontal'

    // If a pane is maximized and it's within this split, only show the maximized one
    if (maximizedPaneId) {
      const firstContains = isPaneVisible(panes[0], maximizedPaneId)
      const secondContains = isPaneVisible(panes[1], maximizedPaneId)
      if (firstContains && !secondContains) {
        return <TerminalPane pane={panes[0]} tabId={tabId} connectionId={connectionId} terminalStyle={terminalStyle} shell={shell} shellArgs={shellArgs} />
      }
      if (secondContains && !firstContains) {
        return <TerminalPane pane={panes[1]} tabId={tabId} connectionId={connectionId} terminalStyle={terminalStyle} shell={shell} shellArgs={shellArgs} />
      }
    }

    return (
      <PanelGroup direction={direction} className="h-full">
        <Panel minSize={10}>
          <TerminalPane pane={panes[0]} tabId={tabId} connectionId={connectionId} terminalStyle={terminalStyle} shell={shell} shellArgs={shellArgs} />
        </Panel>
        <PanelResizeHandle
          className={cn(
            'transition-colors group',
            isHorizontal
              ? 'w-[2px] bg-[#1b1b1e] hover:bg-[#2a2a2d]'
              : 'h-[2px] bg-[#1b1b1e] hover:bg-[#2a2a2d]',
            'data-[resize-handle-state=drag]:bg-transparent'
          )}
        >
          <div
            className={cn(
              'w-full h-full opacity-0 group-hover:opacity-60 transition-opacity',
              'group-data-[resize-handle-state=drag]:opacity-100'
            )}
            style={{ background: SPECTRAL_GRADIENT }}
          />
        </PanelResizeHandle>
        <Panel minSize={10}>
          <TerminalPane pane={panes[1]} tabId={tabId} connectionId={connectionId} terminalStyle={terminalStyle} shell={shell} shellArgs={shellArgs} />
        </Panel>
      </PanelGroup>
    )
  }

  return (
    <XTerminal
      paneId={pane.id}
      tabId={tabId}
      connectionId={connectionId}
      terminalStyle={terminalStyle}
      shell={shell}
      shellArgs={shellArgs}
      onTerminalCreated={(terminalId) => setTerminalId(tabId, pane.id, terminalId)}
    />
  )
}
