import { WebLinksAddon } from '@xterm/addon-web-links'

/**
 * Centralized `http(s)://` link handling for every xterm surface (main terminal,
 * SSH hook, detached window). Replaces bare `new WebLinksAddon()` so all three
 * behave identically: a gesture-gated open in the OS handler plus a hover
 * "copy" chip. All DOM work is lazy (inside handlers), so importing this module
 * — e.g. the pure {@link shouldOpenUrl} helper in unit tests — never touches the
 * document.
 */

const URL_SCHEME = /^https?:\/\//i

export interface WebLinksDeps {
  /** Open an http(s) URL in the OS default handler (validated main-side too). */
  openExternal: (url: string) => void
  /** Read live: whether URL links are enabled at all. */
  isEnabled: () => boolean
  /** Read live: the open gesture ('ctrl-click' requires Ctrl/Cmd). */
  activation: () => 'ctrl-click' | 'click'
}

/**
 * Pure decision for whether a click should open a URL. Extracted so the gesture
 * / scheme / enabled logic is unit-testable without xterm or the DOM.
 */
export function shouldOpenUrl(opts: {
  uri: string
  ctrl: boolean
  meta: boolean
  enabled: boolean
  activation: 'ctrl-click' | 'click'
}): boolean {
  if (!opts.enabled) return false
  if (!URL_SCHEME.test(opts.uri)) return false
  if (opts.activation === 'ctrl-click' && !(opts.ctrl || opts.meta)) return false
  return true
}

// ── Shared hover "copy" chip ──────────────────────────────────────────────
// One element reused across all terminals (only one link is hovered at a time).

interface Chip {
  root: HTMLDivElement
  label: HTMLSpanElement
  icon: HTMLSpanElement
  uri: string
}

let chip: Chip | null = null
let hideTimer: ReturnType<typeof setTimeout> | null = null
let iconResetTimer: ReturnType<typeof setTimeout> | null = null

const COPY_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>'
const CHECK_SVG =
  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>'

function cancelHide(): void {
  if (hideTimer) {
    clearTimeout(hideTimer)
    hideTimer = null
  }
}

function ensureChip(): Chip {
  if (chip) return chip
  const root = document.createElement('div')
  root.setAttribute('role', 'button')
  root.setAttribute('aria-label', 'Copy link')
  root.style.cssText = [
    'position:fixed',
    'z-index:2147483647',
    'display:none',
    'align-items:center',
    'gap:6px',
    'max-width:60ch',
    'padding:3px 8px',
    'border-radius:var(--radius,0.25rem)',
    'background:var(--surface-container-highest,#2a2a2d)',
    'color:var(--on-surface,#e8e6ef)',
    'font-family:Inter,system-ui,sans-serif',
    'font-size:11px',
    'line-height:1.4',
    'cursor:pointer',
    'box-shadow:0 4px 14px rgba(0,0,0,0.4)',
    'user-select:none'
  ].join(';')

  const icon = document.createElement('span')
  icon.style.cssText = 'display:inline-flex;color:var(--on-surface-variant,#c7c4d7);flex:0 0 auto'
  icon.innerHTML = COPY_SVG

  const label = document.createElement('span')
  label.style.cssText =
    'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--on-surface-variant,#c7c4d7)'

  root.appendChild(icon)
  root.appendChild(label)

  root.addEventListener('mouseenter', cancelHide)
  root.addEventListener('mouseleave', () => scheduleHide())
  root.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!chip) return
    navigator.clipboard?.writeText(chip.uri).then(
      () => flashCopied(),
      () => {
        /* clipboard blocked — leave the chip as-is */
      }
    )
  })

  document.body.appendChild(root)
  chip = { root, label, icon, uri: '' }
  return chip
}

function flashCopied(): void {
  if (!chip) return
  chip.icon.innerHTML = CHECK_SVG
  chip.icon.style.color = 'var(--success,#34d399)'
  if (iconResetTimer) clearTimeout(iconResetTimer)
  iconResetTimer = setTimeout(() => {
    if (!chip) return
    chip.icon.innerHTML = COPY_SVG
    chip.icon.style.color = 'var(--on-surface-variant,#c7c4d7)'
  }, 1200)
}

function showCopyChip(event: MouseEvent, uri: string): void {
  const c = ensureChip()
  cancelHide()
  c.uri = uri
  c.label.textContent = uri
  c.icon.innerHTML = COPY_SVG
  c.icon.style.color = 'var(--on-surface-variant,#c7c4d7)'
  c.root.style.display = 'inline-flex'
  // Position above the pointer, clamped to the viewport.
  const rect = c.root.getBoundingClientRect()
  const pad = 6
  let left = event.clientX
  let top = event.clientY - rect.height - 8
  left = Math.max(pad, Math.min(left, window.innerWidth - rect.width - pad))
  if (top < pad) top = event.clientY + 16
  c.root.style.left = `${left}px`
  c.root.style.top = `${top}px`
}

function scheduleHide(): void {
  cancelHide()
  hideTimer = setTimeout(() => {
    if (chip) chip.root.style.display = 'none'
    hideTimer = null
  }, 250)
}

/** Build a configured WebLinksAddon for one terminal instance. */
export function makeWebLinksAddon(deps: WebLinksDeps): WebLinksAddon {
  const handler = (event: MouseEvent, uri: string): void => {
    if (
      !shouldOpenUrl({
        uri,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
        enabled: deps.isEnabled(),
        activation: deps.activation()
      })
    ) {
      return
    }
    deps.openExternal(uri)
  }

  return new WebLinksAddon(handler, {
    hover: (event: MouseEvent, uri: string) => {
      if (!deps.isEnabled() || !URL_SCHEME.test(uri)) return
      showCopyChip(event, uri)
    },
    leave: () => scheduleHide()
  })
}
