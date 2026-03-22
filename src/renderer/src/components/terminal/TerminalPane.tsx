import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { XTerminal } from './XTerminal'
import { useSessionsStore, type TerminalPane as TerminalPaneType } from '@renderer/stores/sessions.store'

interface TerminalPaneProps {
  pane: TerminalPaneType
  tabId: string
}

export function TerminalPane({ pane, tabId }: TerminalPaneProps): JSX.Element {
  const setTerminalId = useSessionsStore((s) => s.setTerminalId)

  if (pane.split) {
    const { direction, panes } = pane.split
    return (
      <PanelGroup direction={direction} className="h-full">
        <Panel minSize={10}>
          <TerminalPane pane={panes[0]} tabId={tabId} />
        </Panel>
        <PanelResizeHandle className="w-[2px] h-full bg-zinc-800 hover:bg-blue-500 transition-colors data-[resize-handle-state=drag]:bg-blue-400" />
        <Panel minSize={10}>
          <TerminalPane pane={panes[1]} tabId={tabId} />
        </Panel>
      </PanelGroup>
    )
  }

  return (
    <XTerminal
      paneId={pane.id}
      onTerminalCreated={(terminalId) => setTerminalId(tabId, pane.id, terminalId)}
    />
  )
}
