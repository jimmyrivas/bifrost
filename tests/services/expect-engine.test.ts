import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ExpectEngine, type ExpectRule, type ExpectEvent } from '../../src/main/services/expect-engine'

function makeRule(overrides: Partial<ExpectRule> & { id: string; pattern: RegExp; sendText: string }): ExpectRule {
  return {
    sendReturn: true,
    hideFromLog: false,
    timeout: 1000,
    onMatch: null,
    onFail: null,
    ...overrides
  }
}

describe('ExpectEngine', () => {
  let engine: ExpectEngine
  let events: ExpectEvent[]
  let writtenData: string[]

  beforeEach(() => {
    engine = new ExpectEngine()
    events = []
    writtenData = []

    engine.on('expect-event', (event: ExpectEvent) => {
      events.push(event)
    })

    engine.setWriteFunction((data: string) => {
      writtenData.push(data)
    })
  })

  it('matches a simple pattern and sends text', () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /password:/i, sendText: 'secret123' })
    ])

    engine.start()
    engine.feed('Enter password:')

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'match', ruleId: 'r1' })
    )
    expect(events).toContainEqual(
      expect.objectContaining({ type: 'send', ruleId: 'r1', text: 'secret123' })
    )
    expect(writtenData).toContain('secret123\r')
    expect(events).toContainEqual({ type: 'complete' })
  })

  it('matches multiple rules in sequence', () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /login:/i, sendText: 'admin' }),
      makeRule({ id: 'r2', pattern: /password:/i, sendText: 'pass' })
    ])

    engine.start()
    engine.feed('login:')
    engine.feed('password:')

    const matchEvents = events.filter((e) => e.type === 'match')
    expect(matchEvents).toHaveLength(2)
    expect(writtenData).toEqual(['admin\r', 'pass\r'])
  })

  it('hides password from log events', () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /password:/i, sendText: 'secret', hideFromLog: true })
    ])

    engine.start()
    engine.feed('password:')

    const sendEvent = events.find((e) => e.type === 'send') as Extract<ExpectEvent, { type: 'send' }>
    expect(sendEvent.hidden).toBe(true)
    expect(sendEvent.text).toBe('***')
  })

  it('fires timeout when pattern not matched', async () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /impossible_pattern/, sendText: 'test', timeout: 100 })
    ])

    engine.start()
    engine.feed('some other text')

    await new Promise((r) => setTimeout(r, 200))

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'timeout', ruleId: 'r1' })
    )
  })

  it('follows onMatch to specific rule', () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /step1/, sendText: 'a', onMatch: 'r3' }),
      makeRule({ id: 'r2', pattern: /step2/, sendText: 'b' }),
      makeRule({ id: 'r3', pattern: /step3/, sendText: 'c' })
    ])

    engine.start()
    engine.feed('step1') // should jump to r3
    engine.feed('step3') // should match r3

    const sendEvents = events.filter((e) => e.type === 'send')
    expect(sendEvents).toHaveLength(2)
    expect(writtenData).toEqual(['a\r', 'c\r']) // skipped r2
  })

  it('follows onFail to specific rule on timeout', async () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /impossible/, sendText: 'a', timeout: 100, onFail: 'r2' }),
      makeRule({ id: 'r2', pattern: /fallback/, sendText: 'b' })
    ])

    engine.start()
    engine.feed('no match')

    await new Promise((r) => setTimeout(r, 200))

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'timeout', ruleId: 'r1' })
    )

    // Engine should now be waiting for r2
    engine.feed('fallback')

    const sendEvents = events.filter((e) => e.type === 'send')
    expect(sendEvents).toContainEqual(
      expect.objectContaining({ ruleId: 'r2', text: 'b' })
    )
  })

  it('does not send return when sendReturn is false', () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /prompt/, sendText: 'yes', sendReturn: false })
    ])

    engine.start()
    engine.feed('prompt')

    expect(writtenData).toContain('yes')
    expect(writtenData).not.toContain('yes\r')
  })

  it('completes with empty rules', () => {
    engine.setRules([])
    engine.start()

    expect(events).toContainEqual({ type: 'complete' })
  })

  it('can be stopped while running', () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /test/, sendText: 'a', timeout: 5000 })
    ])

    engine.start()
    expect(engine.isRunning()).toBe(true)

    engine.stop()
    expect(engine.isRunning()).toBe(false)

    engine.feed('test') // should not match after stop
    expect(events.filter((e) => e.type === 'match')).toHaveLength(0)
  })

  it('accumulates buffer across multiple feed calls', () => {
    engine.setRules([
      makeRule({ id: 'r1', pattern: /full password:/, sendText: 'pass' })
    ])

    engine.start()
    engine.feed('full ')
    engine.feed('password:')

    expect(events).toContainEqual(
      expect.objectContaining({ type: 'match', ruleId: 'r1' })
    )
  })
})
