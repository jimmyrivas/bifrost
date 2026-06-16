import { describe, it, expect } from 'vitest'
import {
  resolveRemotePath,
  parseCwdFromPrompt
} from '../../src/renderer/src/lib/markdown-path-resolver'

describe('resolveRemotePath', () => {
  it('returns absolute paths normalized', () => {
    expect(resolveRemotePath('/home/user/README.md')).toBe('/home/user/README.md')
    expect(resolveRemotePath('/a/./b/../c.md')).toBe('/a/c.md')
  })

  it('keeps ~ anchored paths for backend expansion', () => {
    expect(resolveRemotePath('~/docs/x.md')).toBe('~/docs/x.md')
    expect(resolveRemotePath('~')).toBe('~')
  })

  it('collapses .. against a ~ anchor without escaping it', () => {
    expect(resolveRemotePath('~/proj/../docs/x.md')).toBe('~/docs/x.md')
    // cannot go above the home anchor
    expect(resolveRemotePath('~/../x.md')).toBe('~/x.md')
  })

  it('joins a relative path onto an absolute cwd', () => {
    expect(resolveRemotePath('./README.md', '/srv/app')).toBe('/srv/app/README.md')
    expect(resolveRemotePath('docs/setup.md', '/srv/app')).toBe('/srv/app/docs/setup.md')
    expect(resolveRemotePath('../x.md', '/srv/app/sub')).toBe('/srv/app/x.md')
  })

  it('joins a bare filename onto the cwd', () => {
    expect(resolveRemotePath('README.md', '/srv/app')).toBe('/srv/app/README.md')
  })

  it('joins a relative path onto a ~-anchored cwd', () => {
    expect(resolveRemotePath('./x.md', '~/proj')).toBe('~/proj/x.md')
    expect(resolveRemotePath('../x.md', '~/proj/sub')).toBe('~/proj/x.md')
  })

  it('tolerates trailing slash on cwd', () => {
    expect(resolveRemotePath('x.md', '/srv/app/')).toBe('/srv/app/x.md')
  })

  it('returns null for a relative path with no cwd', () => {
    expect(resolveRemotePath('./x.md')).toBeNull()
    expect(resolveRemotePath('docs/x.md', null)).toBeNull()
  })

  it('returns null when cwd is not absolute or ~-anchored', () => {
    expect(resolveRemotePath('x.md', 'relative/cwd')).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(resolveRemotePath('')).toBeNull()
  })
})

describe('parseCwdFromPrompt', () => {
  it('reads cwd from a user@host:path$ prompt', () => {
    expect(parseCwdFromPrompt('user@web01:/var/www$ ')).toBe('/var/www')
    expect(parseCwdFromPrompt('admin@db:~/data# ')).toBe('~/data')
    expect(parseCwdFromPrompt('me@host:~$ ')).toBe('~')
  })

  it('reads cwd from a bare path prompt', () => {
    expect(parseCwdFromPrompt('/opt/service > ')).toBe('/opt/service')
    expect(parseCwdFromPrompt('~/proj % ')).toBe('~/proj')
  })

  it('uses the last non-empty line', () => {
    const buf = 'some output here\n\nuser@host:/srv/app$ '
    expect(parseCwdFromPrompt(buf)).toBe('/srv/app')
  })

  it('returns null when the last line is not a recognizable prompt', () => {
    expect(parseCwdFromPrompt('just some output text')).toBeNull()
    expect(parseCwdFromPrompt('')).toBeNull()
  })

  it('does not match a prompt that is not on the last non-empty line', () => {
    const buf = 'user@host:/srv$ ls\nfile-a.txt  file-b.txt'
    expect(parseCwdFromPrompt(buf)).toBeNull()
  })

  it('resolves end-to-end with resolveRemotePath', () => {
    const cwd = parseCwdFromPrompt('user@web01:/var/www/html$ ')
    expect(resolveRemotePath('./index.md', cwd)).toBe('/var/www/html/index.md')
  })
})
