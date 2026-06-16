import { describe, it, expect } from 'vitest'
import {
  findMarkdownPaths,
  stripAnsi
} from '../../src/renderer/src/lib/markdown-link-matcher'

describe('findMarkdownPaths', () => {
  it('matches an absolute .md path', () => {
    const out = findMarkdownPaths('see /home/user/README.md for details')
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/home/user/README.md')
    expect(out[0].start).toBe(4)
    expect(out[0].end).toBe(24)
  })

  it('matches a ~-anchored path', () => {
    const out = findMarkdownPaths('open ~/docs/setup.md now')
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('~/docs/setup.md')
  })

  it('matches the .markdown extension', () => {
    const out = findMarkdownPaths('/var/notes.markdown')
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/var/notes.markdown')
  })

  it('is case-insensitive on the extension', () => {
    const out = findMarkdownPaths('/x/READ.MD')
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/x/READ.MD')
  })

  it('strips a :line suffix from the clickable path', () => {
    const out = findMarkdownPaths('error at /a/b/c.md:42')
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/a/b/c.md')
  })

  it('strips a :line:col suffix', () => {
    const out = findMarkdownPaths('/a/b/c.md:42:7 here')
    expect(out[0].path).toBe('/a/b/c.md')
  })

  it('unwraps double-quoted paths', () => {
    const out = findMarkdownPaths('cat "/etc/app/CHANGES.md"')
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/etc/app/CHANGES.md')
  })

  it('unwraps single-quoted paths', () => {
    const out = findMarkdownPaths("vim '~/x.md'")
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('~/x.md')
  })

  it('finds multiple paths in one line, left to right', () => {
    const out = findMarkdownPaths('/a/one.md and /b/two.md')
    expect(out.map((m) => m.path)).toEqual(['/a/one.md', '/b/two.md'])
    expect(out[0].start).toBeLessThan(out[1].start)
  })

  it('ignores relative paths by default (no includeRelative)', () => {
    expect(findMarkdownPaths('./README.md')).toHaveLength(0)
    expect(findMarkdownPaths('../docs/x.md')).toHaveLength(0)
    expect(findMarkdownPaths('docs/setup.md')).toHaveLength(0)
  })

  it('flags absolute/home matches as non-relative', () => {
    expect(findMarkdownPaths('/a/x.md')[0].relative).toBe(false)
    expect(findMarkdownPaths('~/a/x.md')[0].relative).toBe(false)
  })

  it('ignores http(s) URLs ending in .md', () => {
    expect(findMarkdownPaths('https://host/path/x.md')).toHaveLength(0)
    expect(findMarkdownPaths('see http://h/a.md')).toHaveLength(0)
  })

  it('ignores non-markdown files', () => {
    expect(findMarkdownPaths('/etc/passwd')).toHaveLength(0)
    expect(findMarkdownPaths('/a/b/script.sh')).toHaveLength(0)
    expect(findMarkdownPaths('/a/b/notes.txt')).toHaveLength(0)
  })

  it('does not match a bare ".md" with no path', () => {
    expect(findMarkdownPaths('the file is README.md')).toHaveLength(0)
  })

  it('returns empty for blank or slash-less input', () => {
    expect(findMarkdownPaths('')).toHaveLength(0)
    expect(findMarkdownPaths('no paths here')).toHaveLength(0)
  })

  it('computes ranges that slice back to the matched path', () => {
    const line = '   /deep/nested/dir/file.md   '
    const [m] = findMarkdownPaths(line)
    expect(line.slice(m.start, m.end)).toBe(m.path)
  })
})

describe('findMarkdownPaths — includeRelative', () => {
  const REL = { includeRelative: true }

  it('matches ./ and ../ prefixed paths', () => {
    const a = findMarkdownPaths('./README.md', REL)
    expect(a).toHaveLength(1)
    expect(a[0].path).toBe('./README.md')
    expect(a[0].relative).toBe(true)

    const b = findMarkdownPaths('../docs/x.md', REL)
    expect(b[0].path).toBe('../docs/x.md')
    expect(b[0].relative).toBe(true)
  })

  it('matches dir/name.md without a leading dot', () => {
    const out = findMarkdownPaths('docs/setup.md', REL)
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('docs/setup.md')
    expect(out[0].relative).toBe(true)
  })

  it('matches a bare filename', () => {
    const out = findMarkdownPaths('the file is README.md here', REL)
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('README.md')
    expect(out[0].relative).toBe(true)
  })

  it('still flags absolute/home as non-relative in this mode', () => {
    expect(findMarkdownPaths('/a/x.md', REL)[0].relative).toBe(false)
    expect(findMarkdownPaths('~/x.md', REL)[0].relative).toBe(false)
  })

  it('still ignores URLs in relative mode', () => {
    expect(findMarkdownPaths('https://host/path/x.md', REL)).toHaveLength(0)
    expect(findMarkdownPaths('see http://h/a.md', REL)).toHaveLength(0)
  })

  it('strips :line from a relative path', () => {
    const out = findMarkdownPaths('docs/x.md:12 here', REL)
    expect(out[0].path).toBe('docs/x.md')
  })

  it('handles a mix of absolute and relative on one line', () => {
    const out = findMarkdownPaths('/abs/a.md vs ./rel/b.md', REL)
    expect(out.map((m) => m.path)).toEqual(['/abs/a.md', './rel/b.md'])
    expect(out.map((m) => m.relative)).toEqual([false, true])
  })
})

describe('stripAnsi', () => {
  it('removes SGR color sequences', () => {
    expect(stripAnsi('\x1b[31m/a/x.md\x1b[0m')).toBe('/a/x.md')
  })

  it('removes underline sequences wrapping a path', () => {
    expect(stripAnsi('\x1b[4m/a/x.md\x1b[24m')).toBe('/a/x.md')
  })

  it('leaves plain text (including brackets) untouched', () => {
    expect(stripAnsi('plain [not ansi] /a/x.md')).toBe('plain [not ansi] /a/x.md')
  })

  it('feeds cleanly into findMarkdownPaths', () => {
    const raw = 'log: \x1b[1;34m/var/log/report.md\x1b[0m written'
    const out = findMarkdownPaths(stripAnsi(raw))
    expect(out).toHaveLength(1)
    expect(out[0].path).toBe('/var/log/report.md')
  })
})
