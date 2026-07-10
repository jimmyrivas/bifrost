/**
 * Clipboard converters for the Markdown viewer.
 *
 * These let a user copy either a selected fragment or the whole rendered
 * document as GitHub-flavored Markdown or as CSV. Markdown conversion walks
 * the rendered DOM (or a cloned selection Range) rather than the source text,
 * so an arbitrary sub-selection round-trips correctly. CSV extraction pulls
 * every `<table>` in scope and falls back to whitespace-delimited text when the
 * selection contains no tables.
 */

/** A scope we can query: the rendered container or a cloned selection Range. */
type Scope = DocumentFragment | HTMLElement

function collapseWs(s: string): string {
  return s.replace(/\s+/g, ' ')
}

/** Escape one CSV field per RFC 4180 (quote when it holds , " CR or LF). */
export function csvEscape(value: string): string {
  const v = value.trim()
  return /[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}

/** Extract a table's cells as rows of trimmed text. */
function extractRows(table: HTMLTableElement): string[][] {
  return Array.from(table.querySelectorAll('tr')).map((tr) =>
    Array.from(tr.querySelectorAll('th,td')).map((cell) =>
      collapseWs(cell.textContent ?? '').trim()
    )
  )
}

function rowsToCsv(rows: string[][]): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\r\n')
}

/**
 * CSV for every `<table>` in scope (blank line between multiple tables), or
 * null when there is none so the caller can fall back to plain text.
 */
export function tablesToCsv(scope: Scope): string | null {
  const tables = Array.from(scope.querySelectorAll('table')) as HTMLTableElement[]
  if (tables.length === 0) return null
  return tables.map((t) => rowsToCsv(extractRows(t))).join('\r\n\r\n')
}

/** Treat aligned/tab-separated text as a grid: split lines on tabs or 2+ spaces. */
export function textToCsv(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => line.split(/\t| {2,}/).map(csvEscape).join(','))
    .join('\r\n')
}

/** Escape Markdown table-cell content: pipes and collapsed newlines. */
function cellMd(text: string): string {
  return collapseWs(text).trim().replace(/\|/g, '\\|')
}

function tableToMarkdown(table: HTMLTableElement): string {
  const rows = extractRows(table)
  if (rows.length === 0) return ''
  const [header, ...body] = rows
  const lines = [
    `| ${header.map(cellMd).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    ...body.map((r) => `| ${r.map(cellMd).join(' | ')} |`)
  ]
  return `\n${lines.join('\n')}\n\n`
}

function serializeChildren(node: Node): string {
  let out = ''
  node.childNodes.forEach((child) => {
    out += serializeNode(child)
  })
  return out
}

function serializeList(el: HTMLElement, ordered: boolean): string {
  let index = 1
  let out = '\n'
  el.childNodes.forEach((child) => {
    if (child.nodeType !== Node.ELEMENT_NODE) return
    if ((child as HTMLElement).tagName.toLowerCase() !== 'li') return
    const marker = ordered ? `${index++}. ` : '- '
    const content = serializeChildren(child).trim()
    const indented = content
      .split('\n')
      .map((l, i) => (i === 0 ? l : `  ${l}`))
      .join('\n')
    out += `${marker}${indented}\n`
  })
  return `${out}\n`
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return collapseWs(node.textContent ?? '')
  if (node.nodeType !== Node.ELEMENT_NODE) return ''

  const el = node as HTMLElement
  const tag = el.tagName.toLowerCase()
  const inline = (): string => serializeChildren(el).trim()

  switch (tag) {
    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return `\n${'#'.repeat(Number(tag[1]))} ${inline()}\n\n`
    case 'p':
      return `\n${inline()}\n\n`
    case 'br':
      return '  \n'
    case 'hr':
      return '\n---\n\n'
    case 'strong':
    case 'b':
      return `**${inline()}**`
    case 'em':
    case 'i':
      return `*${inline()}*`
    case 'del':
    case 's':
      return `~~${inline()}~~`
    case 'code':
      // Inline code only; fenced code is handled by <pre>.
      return el.closest('pre') ? serializeChildren(el) : `\`${el.textContent ?? ''}\``
    case 'pre':
      return `\n\`\`\`\n${(el.textContent ?? '').replace(/\n+$/, '')}\n\`\`\`\n\n`
    case 'a': {
      const href = el.getAttribute('href')
      const label = inline()
      return href ? `[${label}](${href})` : label
    }
    case 'img': {
      const src = el.getAttribute('src') ?? ''
      const alt = el.getAttribute('alt') ?? ''
      return `![${alt}](${src})`
    }
    case 'ul':
      return serializeList(el, false)
    case 'ol':
      return serializeList(el, true)
    case 'blockquote':
      return `\n${inline()
        .split('\n')
        .map((l) => `> ${l}`.trimEnd())
        .join('\n')}\n\n`
    case 'table':
      return tableToMarkdown(el as HTMLTableElement)
    default:
      return serializeChildren(el)
  }
}

/** Convert a rendered container or cloned selection Range to Markdown. */
export function domToMarkdown(root: Node): string {
  // Collapse the 3+ blank lines that block spacing tends to produce.
  return `${serializeChildren(root).replace(/\n{3,}/g, '\n\n').trim()}\n`
}

// ── Markdown-source parsing ──────────────────────────────────────────────
// Used where content is raw Markdown text rather than rendered DOM (e.g. the
// AI Assistant, which never turns `| a | b |` into a real <table>).

/** Split a GFM table row into cells, honoring escaped pipes and edge pipes. */
function splitTableRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|')) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, '|').trim())
}

function isTableRow(line: string | undefined): boolean {
  return line !== undefined && line.includes('|')
}

/** A GFM header separator, e.g. `| --- | :---: |`. */
function isSeparatorRow(line: string | undefined): boolean {
  if (!isTableRow(line)) return false
  const cells = splitTableRow(line as string)
  return cells.length > 0 && cells.every((c) => /^:?-{1,}:?$/.test(c))
}

/**
 * Extract every GFM table from Markdown source as CSV, or null when the text
 * holds no table (header row immediately followed by a `---` separator row).
 */
export function markdownToCsv(md: string): string | null {
  const lines = md.split('\n')
  const tables: string[][][] = []
  let i = 0
  while (i < lines.length) {
    if (isTableRow(lines[i]) && isSeparatorRow(lines[i + 1])) {
      const rows: string[][] = [splitTableRow(lines[i])]
      let j = i + 2
      while (j < lines.length && isTableRow(lines[j])) {
        rows.push(splitTableRow(lines[j]))
        j++
      }
      tables.push(rows)
      i = j
    } else {
      i++
    }
  }
  if (tables.length === 0) return null
  return tables.map(rowsToCsv).join('\r\n\r\n')
}

// ── Terminal-selection parsing ───────────────────────────────────────────
// A terminal only yields plain text, so a table copied from xterm arrives as
// lines delimited by ASCII pipes (`|`) or box-drawing verticals (`│ ┃ ║`),
// often wrapped in border/separator rows. These helpers reconstruct such a
// grid so a terminal selection can be copied as CSV or clean GFM Markdown.

/** Any cell delimiter a terminal table might use. */
const TERM_DELIM = /[|│┃║]/

/** A rule/border/separator row: only frame characters, dashes, colons, pipes. */
function isBorderLine(line: string): boolean {
  return line.trim() !== '' && /^[\s─-╿|+=:_-]*$/.test(line)
}

/** Split one row on delimiters, trimming cells and dropping edge-border blanks. */
function splitDelimited(line: string): string[] {
  const cells = line.split(TERM_DELIM).map((c) => c.trim())
  if (cells.length && cells[0] === '') cells.shift()
  if (cells.length && cells[cells.length - 1] === '') cells.pop()
  return cells
}

/**
 * Reconstruct a delimited terminal table as rows of cells, or null when the
 * text isn't a delimited grid (fewer than two delimited rows). Border and GFM
 * separator rows are dropped; non-delimited lines (titles, prose) are ignored.
 */
export function parseDelimitedTable(text: string): string[][] | null {
  const rows: string[][] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/[ \t]+$/, '')
    if (line.trim() === '') continue
    if (isBorderLine(line)) continue
    if (!TERM_DELIM.test(line)) continue
    rows.push(splitDelimited(line))
  }
  return rows.length >= 2 ? rows : null
}

/** Render rows as a GFM table, padding every row to the widest column count. */
function rowsToMarkdown(rows: string[][]): string {
  const cols = Math.max(...rows.map((r) => r.length))
  const pad = (r: string[]): string[] =>
    Array.from({ length: cols }, (_, i) => cellMd(r[i] ?? ''))
  const [header, ...body] = rows
  return [
    `| ${pad(header).join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')}${' | ---'.repeat(cols - header.length)} |`,
    ...body.map((r) => `| ${pad(r).join(' | ')} |`)
  ].join('\n')
}

/**
 * Convert a terminal selection to CSV: reconstruct a delimited table when
 * present, otherwise treat whitespace/tab-aligned columns as the grid.
 */
export function terminalToCsv(text: string): string {
  const rows = parseDelimitedTable(text)
  return rows ? rowsToCsv(rows) : textToCsv(text)
}

/**
 * Convert a terminal selection to Markdown: reconstruct a delimited table as a
 * clean GFM table, otherwise return the selected text unchanged.
 */
export function terminalToMarkdown(text: string): string {
  const rows = parseDelimitedTable(text)
  return rows ? rowsToMarkdown(rows) : text.trim()
}
