import { describe, it, expect } from 'vitest'
import { stripReplayQueries } from '../../src/renderer/src/lib/replay-sanitizer'

const ESC = '\x1b'
const BEL = '\x07'
const ST = ESC + '\\'

describe('stripReplayQueries', () => {
  it('removes OSC 10/11 color queries (BEL-terminated)', () => {
    const buf = `prompt$ ${ESC}]10;?${BEL}${ESC}]11;?${BEL}`
    expect(stripReplayQueries(buf)).toBe('prompt$ ')
  })

  it('removes ST-terminated color queries and OSC 4 palette queries', () => {
    const buf = `x${ESC}]11;?${ST}y${ESC}]4;5;?${BEL}z`
    expect(stripReplayQueries(buf)).toBe('xyz')
  })

  it('removes DSR (cursor position / status) queries', () => {
    expect(stripReplayQueries(`a${ESC}[6nb${ESC}[5nc`)).toBe('abc')
  })

  it('removes Device Attributes queries (primary/secondary)', () => {
    expect(stripReplayQueries(`a${ESC}[cb${ESC}[>0cc${ESC}[=1cd`)).toBe('abcd')
  })

  it('keeps color SET/REPORT sequences (payload is not a bare "?")', () => {
    const report = `${ESC}]11;rgb:0d0d/0d0d/0f0f${BEL}`
    expect(stripReplayQueries(report)).toBe(report)
  })

  it('leaves normal text untouched', () => {
    expect(stripReplayQueries('Last login: ... \r\n$ ls -la')).toBe('Last login: ... \r\n$ ls -la')
  })

  it('does not touch OSC 52 clipboard queries (non-numeric selection)', () => {
    const clip = `${ESC}]52;c;?${BEL}`
    expect(stripReplayQueries(clip)).toBe(clip)
  })
})
