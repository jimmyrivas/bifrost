/**
 * #15: Zmodem file transfer detection.
 *
 * Detects Zmodem transfer initiation in terminal output and shows a notification.
 * For v1 we only detect the header and inform the user.
 */

/** Zmodem ZRQINIT header: **\x18B00 */
const ZMODEM_HEADER = '**\x18B00'

/** Alternate detection: raw bytes for ZRINIT / ZRQINIT */
const ZMODEM_DETECT_RE = /\*\*\x18B0[01]/

let lastNotificationTime = 0
const NOTIFICATION_COOLDOWN_MS = 5000

/**
 * Scan terminal output data for Zmodem transfer initiation.
 * Returns true if Zmodem was detected.
 */
export function detectZmodem(data: string): boolean {
  return data.includes(ZMODEM_HEADER) || ZMODEM_DETECT_RE.test(data)
}

/**
 * Show a notification that Zmodem transfer was detected.
 * Debounced to avoid spamming.
 */
export function notifyZmodemDetected(): void {
  const now = Date.now()
  if (now - lastNotificationTime < NOTIFICATION_COOLDOWN_MS) return
  lastNotificationTime = now

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Zmodem Transfer Detected', {
      body: 'Zmodem transfer detected - use rz/sz commands directly.',
      silent: true
    })
  }

  // Also dispatch a custom event for any UI listener
  document.dispatchEvent(
    new CustomEvent('bifrost:zmodem-detected', {
      detail: { timestamp: now }
    })
  )
}
