import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2, AlertTriangle, Copy, Check, FileText } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { useMarkdownViewerStore } from '@renderer/stores/markdownViewer.store'

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

  const [copied, setCopied] = useState(false)

  const onCopy = (): void => {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => { /* clipboard denied */ })
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
            <button
              type="button"
              onClick={onCopy}
              className="mr-8 flex items-center gap-1 rounded-[var(--radius)] px-2 py-1 text-[10px] text-[var(--on-surface-variant)] hover:bg-[var(--surface-bright)] hover:text-[var(--on-surface)]"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          )}
        </DialogHeader>

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
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
                  {content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
