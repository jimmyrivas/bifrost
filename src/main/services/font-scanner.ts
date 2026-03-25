import { scanMonospaceFonts as platformScan } from './platform'

const FALLBACK_FONTS = [
  'JetBrains Mono',
  'Fira Code',
  'Cascadia Code',
  'Source Code Pro',
  'IBM Plex Mono',
  'Inconsolata',
  'Ubuntu Mono',
  'Hack',
  'Iosevka',
  'Victor Mono',
  'Anonymous Pro',
  'Roboto Mono',
  'Meslo LG S',
  'Meslo LG M',
  'Meslo LG L',
  'Menlo',
  'Space Mono',
  'DM Mono',
  'Droid Sans Mono',
  'Liberation Mono',
  'DejaVu Sans Mono',
  'Courier New',
  'Consolas',
  'monospace'
]

/**
 * Scan system for available monospace fonts.
 * Cross-platform: Linux (fc-list), Windows (PowerShell), macOS (system_profiler).
 * Merges with fallback list and returns deduplicated, sorted array.
 */
export function scanMonospaceFonts(): string[] {
  const systemFonts = new Set<string>()

  try {
    for (const font of platformScan()) {
      systemFonts.add(font)
    }
  } catch {
    // Platform scan failed; rely on fallbacks
  }

  for (const font of FALLBACK_FONTS) {
    systemFonts.add(font)
  }

  return Array.from(systemFonts).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )
}
