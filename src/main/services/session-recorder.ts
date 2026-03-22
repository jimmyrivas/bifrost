import { app } from 'electron'
import { join } from 'path'
import {
  appendFileSync,
  writeFileSync,
  readFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync
} from 'fs'

/**
 * asciicast v2 format header.
 */
export interface AsciicastHeader {
  version: 2
  width: number
  height: number
  timestamp: number
  title?: string
  env?: Record<string, string>
}

/**
 * A single asciicast v2 event: [time, type, data]
 * type: "o" for output, "i" for input
 */
export type AsciicastEvent = [number, 'o' | 'i', string]

export interface RecordingInfo {
  id: string
  sessionId: string
  filePath: string
  startedAt: string
  stoppedAt?: string
  size: number
}

interface ActiveRecording {
  sessionId: string
  filePath: string
  startTime: number
  startedAt: string
}

const activeRecordings = new Map<string, ActiveRecording>()

function getRecordingsDir(): string {
  const dir = join(app.getPath('userData'), 'recordings')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Start recording terminal I/O for a session.
 * Creates a new asciicast v2 file.
 */
export function startRecording(
  sessionId: string,
  options?: { width?: number; height?: number; title?: string }
): string {
  if (activeRecordings.has(sessionId)) {
    throw new Error(`Recording already active for session ${sessionId}`)
  }

  const recordingId = `rec-${Date.now()}-${sessionId}`
  const filePath = join(getRecordingsDir(), `${recordingId}.cast`)

  const header: AsciicastHeader = {
    version: 2,
    width: options?.width ?? 80,
    height: options?.height ?? 24,
    timestamp: Math.floor(Date.now() / 1000),
    title: options?.title ?? `Session ${sessionId}`
  }

  // Write header as first line (asciicast v2 format)
  writeFileSync(filePath, JSON.stringify(header) + '\n', 'utf-8')

  activeRecordings.set(sessionId, {
    sessionId,
    filePath,
    startTime: Date.now(),
    startedAt: new Date().toISOString()
  })

  return recordingId
}

/**
 * Feed terminal data into an active recording.
 * direction: 'input' or 'output'
 */
export function feedData(
  sessionId: string,
  data: string,
  direction: 'input' | 'output'
): void {
  const recording = activeRecordings.get(sessionId)
  if (!recording) return

  const elapsed = (Date.now() - recording.startTime) / 1000
  const eventType = direction === 'input' ? 'i' : 'o'
  const event: AsciicastEvent = [elapsed, eventType, data]

  try {
    appendFileSync(recording.filePath, JSON.stringify(event) + '\n', 'utf-8')
  } catch (err) {
    console.error('Failed to write recording data:', err)
  }
}

/**
 * Stop recording for a session and finalize the file.
 */
export function stopRecording(sessionId: string): string | null {
  const recording = activeRecordings.get(sessionId)
  if (!recording) return null

  activeRecordings.delete(sessionId)
  return recording.filePath
}

/**
 * Check if a session is being recorded.
 */
export function isRecording(sessionId: string): boolean {
  return activeRecordings.has(sessionId)
}

/**
 * List all saved recordings.
 */
export function listRecordings(): RecordingInfo[] {
  const dir = getRecordingsDir()
  const recordings: RecordingInfo[] = []

  try {
    const files = readdirSync(dir).filter((f) => f.endsWith('.cast'))

    for (const file of files) {
      const filePath = join(dir, file)

      try {
        const stat = statSync(filePath)
        const content = readFileSync(filePath, 'utf-8')
        const firstLine = content.split('\n')[0]
        const header = JSON.parse(firstLine) as AsciicastHeader

        // Extract session ID from filename: rec-{timestamp}-{sessionId}.cast
        const match = file.match(/^rec-\d+-(.+)\.cast$/)
        const sessionId = match ? match[1] : 'unknown'

        recordings.push({
          id: file.replace('.cast', ''),
          sessionId,
          filePath,
          startedAt: new Date((header.timestamp ?? 0) * 1000).toISOString(),
          size: stat.size
        })
      } catch {
        // Skip malformed files
      }
    }
  } catch {
    // Directory read failed
  }

  return recordings.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
}

/**
 * Get a recording's content for playback.
 */
export function getRecording(recordingId: string): string | null {
  const filePath = join(getRecordingsDir(), `${recordingId}.cast`)
  if (!existsSync(filePath)) return null

  try {
    return readFileSync(filePath, 'utf-8')
  } catch {
    return null
  }
}

/**
 * Delete a recording.
 */
export function deleteRecording(recordingId: string): boolean {
  const filePath = join(getRecordingsDir(), `${recordingId}.cast`)
  if (!existsSync(filePath)) return false

  try {
    const { unlinkSync } = require('fs') as typeof import('fs')
    unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Stop all active recordings (used during cleanup).
 */
export function stopAllRecordings(): void {
  for (const [sessionId] of activeRecordings) {
    stopRecording(sessionId)
  }
}
