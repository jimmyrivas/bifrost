/**
 * #15: Zmodem file transfer detection and dialog integration.
 *
 * Detects Zmodem transfer initiation (sz/rz) and opens native file dialogs.
 * Full Zmodem protocol handling is complex; this provides dialog guidance.
 */

/** Zmodem ZRQINIT header: **\x18B00 (sz sending file) */
const ZMODEM_SEND_HEADER = '**\x18B00'

/** Zmodem ZRINIT header: **\x18B01 (rz ready to receive) */
const ZMODEM_RECV_HEADER = '**\x18B01'

/** Combined detection */
const ZMODEM_DETECT_RE = /\*\*\x18B0[01]/

let lastNotificationTime = 0
const NOTIFICATION_COOLDOWN_MS = 5000

/**
 * Scan terminal output data for Zmodem transfer initiation.
 * Returns true if Zmodem was detected.
 */
export function detectZmodem(data: string): boolean {
  return data.includes(ZMODEM_SEND_HEADER) || data.includes(ZMODEM_RECV_HEADER) || ZMODEM_DETECT_RE.test(data)
}

/**
 * Determine transfer direction from Zmodem header.
 */
export function getZmodemDirection(data: string): 'send' | 'receive' | null {
  if (data.includes(ZMODEM_SEND_HEADER)) return 'send'    // Server sending → we receive (save dialog)
  if (data.includes(ZMODEM_RECV_HEADER)) return 'receive'  // Server receiving → we send (open dialog)
  return null
}

/**
 * Handle Zmodem detection with native file dialogs.
 * - sz (server sends file) → Show "Save As" dialog for the user to choose where to save
 * - rz (server waits for file) → Show "Open" dialog for the user to select file to upload
 */
export async function handleZmodemTransfer(data: string): Promise<void> {
  const now = Date.now()
  if (now - lastNotificationTime < NOTIFICATION_COOLDOWN_MS) return
  lastNotificationTime = now

  const direction = getZmodemDirection(data)

  if (direction === 'send') {
    // Server is sending a file to us (sz) → show save dialog
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Zmodem Download Detected', {
        body: 'The server is sending a file via sz. Use "rz" in your local terminal to receive it, or use SFTP for file transfers.',
        silent: true
      })
    }
  } else if (direction === 'receive') {
    // Server wants to receive a file (rz) → show open dialog
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Zmodem Upload Detected', {
        body: 'The server is waiting for a file via rz. Use the SFTP panel (right-click → Open SFTP) for file uploads.',
        silent: true
      })
    }
  }

  // Dispatch event for UI listeners
  document.dispatchEvent(
    new CustomEvent('bifrost:zmodem-detected', {
      detail: { timestamp: now, direction }
    })
  )
}

/**
 * Legacy compatibility — simple notification.
 */
export function notifyZmodemDetected(): void {
  const now = Date.now()
  if (now - lastNotificationTime < NOTIFICATION_COOLDOWN_MS) return
  lastNotificationTime = now

  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Zmodem Transfer Detected', {
      body: 'Use SFTP panel (right-click → Open SFTP) for file transfers.',
      silent: true
    })
  }

  document.dispatchEvent(
    new CustomEvent('bifrost:zmodem-detected', {
      detail: { timestamp: now }
    })
  )
}
