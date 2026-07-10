import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  Loader2,
  AlertTriangle,
  Copy,
  FileText,
  ClipboardCopy,
  Sheet,
  ChevronDown
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger
} from '@renderer/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@renderer/components/ui/dropdown-menu'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useMarkdownViewerStore } from '@renderer/stores/markdownViewer.store'
import { domToMarkdown, tablesToCsv, textToCsv } from '@renderer/lib/markdown-clip'

function basename(p: string): string {
  const parts = p.split('/').filter(Boolean)
  return parts[parts.length - 1] || p
}

/**
 * Internal Markdown viewer modal. Opened by a Ctrl+Click on a remote `.md`
 * path in an SSH terminal (see useTerminal's link provider + markdownViewer
 * store). Renders GitHub-flavored Markdown; raw HTML is dropped (skipHtml) so
 * remote-controlled content can't inject markup.
 */
export function MarkdownViewer(): JSX.Element {
  // Field selectors only (Zustand lesson: no object selectors).
  const open = useMarkdownViewerStore((s) => s.open)
  const path = useMarkdownViewerStore((s) => s.path)
  const host = useMarkdownViewerStore((s) => s.host)
  const content = useMarkdownViewerStore((s) => s.content)
  const status = useMarkdownViewerStore((s) => s.status)
  const error = useMarkdownViewerStore((s) => s.error)
  const truncated = useMarkdownViewerStore((s) => s.truncated)
  const close = useMarkdownViewerStore((s) => s.close)

  const [flash, setFlash] = useState<string | null>(null)

  // Rendered container + the selection captured when the context menu opens.
  const bodyRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<{ fragment: DocumentFragment; text: string } | null>(null)

  const write = (text: string, label: string): void => {
    if (!text.trim()) return
    navigator.clipboard.writeText(text).then(() => {
      setFlash(label)
      setTimeout(() => setFlash(null), 1400)
    }).catch(() => { /* clipboard denied */ })
  }

  // Capture the live selection before Radix opens the menu (capture phase).
  const captureSelection = (): void => {
    selectionRef.current = null
    const body = bodyRef.current
    const sel = window.getSelection()
    if (!body || !sel || sel.isCollapsed || sel.rangeCount === 0) return
    const range = sel.getRangeAt(0)
    if (!body.contains(range.commonAncestorContainer)) return
    selectionRef.current = { fragment: range.cloneContents(), text: sel.toString() }
  }

  const hasSelection = (): boolean => selectionRef.current !== null

  const copyPlain = (): void => {
    const sel = selectionRef.current
    write(sel ? sel.text : (bodyRef.current?.innerText ?? content), 'Copied')
  }

  const copyMarkdown = (): void => {
    const sel = selectionRef.current
    // No selection → the source is already Markdown, so copy it verbatim.
    write(sel ? domToMarkdown(sel.fragment) : content, 'Copied as Markdown')
  }

  const copyCsv = (): void => {
    const sel = selectionRef.current
    const scope = sel ? sel.fragment : bodyRef.current
    const csv = (scope && tablesToCsv(scope)) || textToCsv(sel?.text ?? bodyRef.current?.innerText ?? '')
    write(csv, 'Copied as CSV')
  }

  // Header dropdown always operates on the whole document (ignores any
  // right-click selection, which lives in selectionRef).
  const copyDocPlain = (): void => write(bodyRef.current?.innerText ?? content, 'Copied')
  const copyDocMarkdown = (): void => write(content, 'Copied as Markdown')
  const copyDocCsv = (): void => {
    const csv = (bodyRef.current && tablesToCsv(bodyRef.current)) || textToCsv(bodyRef.current?.innerText ?? '')
    write(csv, 'Copied as CSV')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) close() }}>
      <DialogContent className="max-w-none w-[80vw] h-[80vh] p-0 grid-rows-[auto_1fr] gap-0 overflow-hidden">
        <DialogHeader className="flex flex-row items-center gap-3 space-y-0 px-5 py-3 bg-[var(--surface-container-low)] text-left">
          <FileText className="h-4 w-4 shrink-0 text-[var(--on-surface-variant)]" />
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm" title={path ?? undefined}>
              {path ? basename(path) : 'Markdown'}
            </DialogTitle>
            <p
              className="truncate font-['JetBrains_Mono'] text-[10px] text-[var(--on-surface-variant)]"
              title={path ?? undefined}
            >
              {host ? `${host}:` : ''}{path ?? ''}
            </p>
          </div>
          {status === 'ready' && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mr-8 flex items-center gap-1 rounded-[var(--radius)] px-2 py-1 text-[10px] text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)] hover:text-[var(--on-surface)]"
                >
                  <Copy className="h-3 w-3" />
                  Copy
                  <ChevronDown className="h-3 w-3 opacity-70" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[13rem]">
                <DropdownMenuLabel>Copy document</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={copyDocPlain}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
                  Copy as text
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={copyDocMarkdown}>
                  <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
                  Copy as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={copyDocCsv}>
                  <Sheet className="mr-2 h-3.5 w-3.5" />
                  Copy as CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </DialogHeader>

        {flash && (
          <div className="pointer-events-none absolute left-1/2 top-[52px] z-20 -translate-x-1/2 rounded-[var(--radius)] bg-[var(--surface-container-highest)] px-3 py-1 text-[11px] text-[var(--on-surface)] shadow-md">
            {flash}
          </div>
        )}

        {truncated && status === 'ready' && (
          <div className="absolute left-0 right-0 top-[52px] z-10 bg-[var(--warning)]/15 px-5 py-1 text-[10px] text-[var(--on-surface-variant)]">
            File exceeds the viewer size limit — showing the beginning only. Adjust the limit in Preferences.
          </div>
        )}

        <ScrollArea className="h-full">
          <div className="px-6 py-5">
            {status === 'loading' && (
              <div className="flex items-center gap-2 text-sm text-[var(--on-surface-variant)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading {path ? basename(path) : 'file'}…
              </div>
            )}

            {status === 'error' && (
              <div className="flex items-start gap-2 text-sm text-[var(--error)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">Could not open file</p>
                  <p className="mt-1 font-['JetBrains_Mono'] text-[11px] text-[var(--on-surface-variant)]">
                    {error}
                  </p>
                </div>
              </div>
            )}

            {status === 'ready' && (
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <div
                    ref={bodyRef}
                    className="markdown-body"
                    onContextMenuCapture={captureSelection}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                      {content}
                    </ReactMarkdown>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="min-w-[13rem]">
                  <ContextMenuLabel>
                    {hasSelection() ? 'Copy selection' : 'Copy document'}
                  </ContextMenuLabel>
                  <ContextMenuSeparator />
                  <ContextMenuItem onSelect={copyPlain}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    Copy
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={copyMarkdown}>
                    <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
                    Copy as Markdown
                  </ContextMenuItem>
                  <ContextMenuItem onSelect={copyCsv}>
                    <Sheet className="mr-2 h-3.5 w-3.5" />
                    Copy as CSV
                    <ContextMenuShortcut>tables</ContextMenuShortcut>
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
