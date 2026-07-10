import { describe, it, expect } from 'vitest'
import {
  csvEscape,
  domToMarkdown,
  markdownToCsv,
  parseDelimitedTable,
  tablesToCsv,
  terminalToCsv,
  terminalToMarkdown,
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

  it('ignores pipe tables inside fenced code blocks', () => {
    const fenced = '```\n| a | b |\n| --- | --- |\n| 1 | 2 |\n```'
    expect(markdownToCsv(fenced)).toBeNull()
  })

  it('still extracts a real table after a fence closes', () => {
    const md = '```\n| x |\n| --- |\n| 0 |\n```\n\n| a |\n| --- |\n| 1 |'
    expect(markdownToCsv(md)).toBe('a\r\n1')
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

describe('parseDelimitedTable', () => {
  it('parses an ASCII pipe table dropping the GFM separator', () => {
    const t = '| Repo | PR |\n| --- | --- |\n| backend | #541 |\n| web | #631 |'
    expect(parseDelimitedTable(t)).toEqual([
      ['Repo', 'PR'],
      ['backend', '#541'],
      ['web', '#631']
    ])
  })

  it('parses a box-drawing bordered table', () => {
    const t = [
      '┌──────────┬──────┐',
      '│ Repo     │ PR   │',
      '├──────────┼──────┤',
      '│ backend  │ #541 │',
      '│ web      │ #631 │',
      '└──────────┴──────┘'
    ].join('\n')
    expect(parseDelimitedTable(t)).toEqual([
      ['Repo', 'PR'],
      ['backend', '#541'],
      ['web', '#631']
    ])
  })

  it('rejects selections mixing prose with delimited lines', () => {
    const t = 'Estado global\n| a | b |\n| 1 | 2 |'
    expect(parseDelimitedTable(t)).toBeNull()
  })

  it('returns null for text with no delimited grid', () => {
    expect(parseDelimitedTable('just some prose\nover two lines')).toBeNull()
  })

  it('rejects piped shell commands (no edge delimiter, no border)', () => {
    const t = 'ps aux | grep ssh\ncat /var/log/syslog | tail -n 5'
    expect(parseDelimitedTable(t)).toBeNull()
  })

  it('rejects rows with inconsistent column counts', () => {
    const t = '| a | b |\n| 1 | 2 | 3 |'
    expect(parseDelimitedTable(t)).toBeNull()
  })

  it('keeps data rows whose cells are single-dash placeholders', () => {
    const t = '| a | b |\n| --- | --- |\n| - | - |\n| 1 | 2 |'
    expect(parseDelimitedTable(t)).toEqual([
      ['a', 'b'],
      ['-', '-'],
      ['1', '2']
    ])
  })

  it('accepts psql-style tables via their border row', () => {
    const t = ' id | name \n----+------\n  1 | alice\n  2 | bob'
    expect(parseDelimitedTable(t)).toEqual([
      ['id', 'name'],
      ['1', 'alice'],
      ['2', 'bob']
    ])
  })
})

describe('terminalToCsv', () => {
  it('converts a pipe table selection to CSV', () => {
    const t = '| Repo | PR |\n| --- | --- |\n| backend | #541, urgent |'
    expect(terminalToCsv(t)).toBe('Repo,PR\r\nbackend,"#541, urgent"')
  })

  it('falls back to aligned text when there is no table', () => {
    expect(terminalToCsv('name    age\nalice   30')).toBe('name,age\r\nalice,30')
  })
})

describe('terminalToMarkdown', () => {
  it('rebuilds a box-drawing table as clean GFM', () => {
    const t = [
      '│ Repo    │ PR   │',
      '│ backend │ #541 │'
    ].join('\n')
    expect(terminalToMarkdown(t)).toBe(
      '| Repo | PR |\n| --- | --- |\n| backend | #541 |'
    )
  })

  it('returns the text unchanged when there is no table', () => {
    expect(terminalToMarkdown('  plain line  ')).toBe('plain line')
  })

  it('passes piped shell commands through instead of faking a table', () => {
    const t = 'ps aux | grep ssh\ncat /var/log/syslog | tail -n 5'
    expect(terminalToMarkdown(t)).toBe(t)
    expect(terminalToCsv(t)).toBe('ps aux | grep ssh\r\ncat /var/log/syslog | tail -n 5')
  })
})

describe('partial table selections (orphaned tr/td fragments)', () => {
  it('domToMarkdown renders orphaned rows as pipe rows, not glued text', () => {
    // Range.cloneContents of a two-row selection yields <tr>s with no <table>
    // ancestor. Build the fragment with DOM nodes (innerHTML strips bare <tr>).
    const frag = document.createDocumentFragment()
    for (const [name, age] of [
      ['alice', '22'],
      ['bob', '31']
    ]) {
      const tr = document.createElement('tr')
      for (const v of [name, age]) {
        const td = document.createElement('td')
        td.textContent = v
        tr.appendChild(td)
      }
      frag.appendChild(tr)
    }
    expect(domToMarkdown(frag)).toBe('| alice | 22 |\n| bob | 31 |\n')
    expect(tablesToCsv(frag)).toBe('alice,22\r\nbob,31')
  })

  it('tablesToCsv treats orphaned lone cells as one row', () => {
    const frag = document.createDocumentFragment()
    for (const v of ['alice', '22']) {
      const td = document.createElement('td')
      td.textContent = v
      frag.appendChild(td)
    }
    expect(tablesToCsv(frag)).toBe('alice,22')
  })
})

describe('code blocks in domToMarkdown', () => {
  it('fences a detached multi-line <code> instead of inline backticks', () => {
    const code = document.createElement('code')
    code.textContent = 'line one\nline two'
    const frag = document.createDocumentFragment()
    frag.appendChild(code)
    expect(domToMarkdown(frag)).toBe('```\nline one\nline two\n```\n')
  })

  it('keeps single-line detached <code> inline', () => {
    expect(domToMarkdown(html('<p>run <code>ls -la</code> now</p>'))).toBe(
      'run `ls -la` now\n'
    )
  })
})
