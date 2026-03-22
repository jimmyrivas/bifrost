import { useCallback, useMemo } from 'react'
import { ArrowLeftToLine } from 'lucide-react'
import { XTerminal } from './XTerminal'

interface DetachedTerminalProps {
  tabId: string
}

export function DetachedTerminal({ tabId }: DetachedTerminalProps): JSX.Element {
  const connectionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('connId') || null
  }, [])

  const handleReattach = useCallback(async () => {
    try {
      await window.bifrost?.window?.reattachTab(tabId)
    } catch (err) {
      console.error('Reattach failed:', err)
    }
  }, [tabId])

  return (
    <div className="flex flex-col h-screen w-screen bg-[#131316]">
      <div className="flex items-center h-8 px-3 bg-[#1b1b1e] shrink-0 select-none">
        <span className="text-xs text-[#c7c4d7]/60 flex-1">
          Bifrost — {connectionId ? 'SSH' : 'Local'} Terminal
        </span>
        <button
          onClick={handleReattach}
          className="flex items-center gap-1.5 px-2 py-0.5 text-[10px] text-[#c7c4d7] hover:text-[#e6e1e5] hover:bg-[#2a2a2d] rounded transition-colors"
          title="Re-attach to main window"
        >
          <ArrowLeftToLine size={12} />
          Re-attach
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <XTerminal
          paneId={`detached-${tabId}`}
          connectionId={connectionId}
        />
      </div>
    </div>
  )
}
