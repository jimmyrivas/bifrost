import { execSync } from 'child_process'

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
  'monospace'
]

/**
 * Scan system for available monospace fonts.
 * Linux: parses `fc-list :spacing=mono family` output.
 * Returns a deduplicated, sorted array of font family names.
 */
export function scanMonospaceFonts(): string[] {
  const systemFonts = new Set<string>()

  try {
    const output = execSync('fc-list :spacing=mono family', {
      encoding: 'utf-8',
      timeout: 5000
    })

    for (const line of output.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      // fc-list may output comma-separated aliases: "DejaVu Sans Mono,DejaVu Sans Mono"
      const families = trimmed.split(',')
      for (const family of families) {
        const cleaned = family.trim()
        if (cleaned) systemFonts.add(cleaned)
      }
    }
  } catch {
    // fc-list not available or failed; rely on fallbacks
  }

  // Merge with fallbacks
  for (const font of FALLBACK_FONTS) {
    systemFonts.add(font)
  }

  return Array.from(systemFonts).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  )
}
