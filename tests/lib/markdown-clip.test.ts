import { describe, it, expect } from 'vitest'
import {
  csvEscape,
  domToMarkdown,
  markdownToCsv,
  tablesToCsv,
  textToCsv
} from '../../src/renderer/src/lib/markdown-clip'

function html(markup: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = markup
  return el
}

const TABLE = html(`
  <table>
    <thead><tr><th>#</th><th>Host</th><th>IP</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>atentovivo</td><td>34.95.222.213</td></tr>
      <tr><td>2</td><td>om-atentob2c</td><td>34.39.255.156</td></tr>
    </tbody>
  </table>
`)

describe('csvEscape', () => {
  it('leaves plain values untouched', () => {
    expect(csvEscape('atentovivo')).toBe('atentovivo')
  })

  it('quotes and doubles embedded quotes', () => {
    expect(csvEscape('a "b" c')).toBe('"a ""b"" c"')
  })

  it('quotes values containing commas or newlines', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('a\nb')).toBe('"a\nb"')
  })
})

describe('tablesToCsv', () => {
  it('converts a rendered table to CSV', () => {
    expect(tablesToCsv(TABLE)).toBe(
      '#,Host,IP\r\n1,atentovivo,34.95.222.213\r\n2,om-atentob2c,34.39.255.156'
    )
  })

  it('returns null when there is no table', () => {
    expect(tablesToCsv(html('<p>no tables here</p>'))).toBeNull()
  })

  it('separates multiple tables with a blank line', () => {
    const two = html('<table><tr><td>a</td></tr></table><table><tr><td>b</td></tr></table>')
    expect(tablesToCsv(two)).toBe('a\r\n\r\nb')
  })
})

describe('textToCsv', () => {
  it('splits aligned columns on runs of spaces', () => {
    expect(textToCsv('name    age\nalice   30')).toBe('name,age\r\nalice,30')
  })

  it('skips blank lines', () => {
    expect(textToCsv('a\tb\n\nc\td')).toBe('a,b\r\nc,d')
  })
})

describe('markdownToCsv', () => {
  const md = [
    'Some intro text.',
    '',
    '| # | Host | IP |',
    '| --- | --- | --- |',
    '| 1 | atentovivo | 34.95.222.213 |',
    '| 2 | om-atentob2c | 34.39.255.156 |',
    '',
    'A trailing note.'
  ].join('\n')

  it('extracts a GFM table from Markdown source', () => {
    expect(markdownToCsv(md)).toBe(
      '#,Host,IP\r\n1,atentovivo,34.95.222.213\r\n2,om-atentob2c,34.39.255.156'
    )
  })

  it('returns null when prose has pipes but no separator row', () => {
    expect(markdownToCsv('a | b is not | a table\njust prose')).toBeNull()
  })

  it('returns null when there is no table at all', () => {
    expect(markdownToCsv('# Heading\n\nplain text')).toBeNull()
  })

  it('handles escaped pipes inside cells', () => {
    const t = '| cmd |\n| --- |\n| a \\| b |'
    expect(markdownToCsv(t)).toBe('cmd\r\na | b')
  })

  it('extracts multiple tables separated by a blank line', () => {
    const two = '| a |\n| --- |\n| 1 |\n\n| b |\n| --- |\n| 2 |'
    expect(markdownToCsv(two)).toBe('a\r\n1\r\n\r\nb\r\n2')
  })
})

describe('domToMarkdown', () => {
  it('round-trips a table to GFM', () => {
    expect(domToMarkdown(TABLE)).toBe(
      '| # | Host | IP |\n' +
        '| --- | --- | --- |\n' +
        '| 1 | atentovivo | 34.95.222.213 |\n' +
        '| 2 | om-atentob2c | 34.39.255.156 |\n'
    )
  })

  it('converts headings, emphasis and links', () => {
    const md = domToMarkdown(
      html('<h2>Title</h2><p>a <strong>bold</strong> and <em>em</em> and <a href="http://x">link</a></p>')
    )
    expect(md).toBe('## Title\n\na **bold** and *em* and [link](http://x)\n')
  })

  it('converts unordered and ordered lists', () => {
    expect(domToMarkdown(html('<ul><li>one</li><li>two</li></ul>'))).toBe('- one\n- two\n')
    expect(domToMarkdown(html('<ol><li>one</li><li>two</li></ol>'))).toBe('1. one\n2. two\n')
  })

  it('escapes pipes inside table cells', () => {
    const md = domToMarkdown(html('<table><tr><th>cmd</th></tr><tr><td>a | b</td></tr></table>'))
    expect(md).toContain('| a \\| b |')
  })
})
