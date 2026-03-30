/**
 * bifrost-plugin-system-info
 *
 * Example Bifrost plugin demonstrating all API capabilities:
 * - Lifecycle hooks (onConnect, onDisconnect, onData, onTabCreate, onTabClose)
 * - Custom commands (accessible from command palette)
 * - Context menu items
 * - Custom theme
 *
 * Install:
 *   Copy this folder to ~/.config/bifrost/plugins/bifrost-plugin-system-info/
 *   Or: cd ~/.config/bifrost/plugins && npm install /path/to/bifrost-plugin-system-info
 */

const os = require('os')

// Track active sessions for logging
const sessions = new Map()

module.exports = {
  name: 'bifrost-plugin-system-info',
  version: '1.0.0',
  description: 'System info, session logging, and a custom theme',

  activate(api) {
    console.log('[system-info] Plugin activated')

    // ─── Lifecycle Hooks ───────────────────────────────────

    api.registerHooks({
      onConnect(connectionId, sessionId) {
        const timestamp = new Date().toISOString()
        sessions.set(sessionId, { connectionId, connectedAt: timestamp })
        console.log(`[system-info] Connected: ${connectionId} (session: ${sessionId}) at ${timestamp}`)
      },

      onDisconnect(connectionId, sessionId) {
        const session = sessions.get(sessionId)
        if (session) {
          const duration = Date.now() - new Date(session.connectedAt).getTime()
          const mins = Math.round(duration / 60000)
          console.log(`[system-info] Disconnected: ${connectionId} after ${mins}m`)
          sessions.delete(sessionId)
        }
      },

      onData(sessionId, data) {
        // Example: detect "ERROR" in terminal output and log it
        if (data.includes('ERROR') || data.includes('error:')) {
          console.log(`[system-info] Error detected in session ${sessionId}`)
        }
        // Return void = pass data through unchanged
        // Return string = replace data with modified version
      },

      onTabCreate(tabId, connectionId) {
        console.log(`[system-info] Tab created: ${tabId}${connectionId ? ` (conn: ${connectionId})` : ' (local)'}`)
      },

      onTabClose(tabId) {
        console.log(`[system-info] Tab closed: ${tabId}`)
      }
    })

    // ─── Custom Commands ───────────────────────────────────

    api.registerCommand('system-info', () => {
      const info = [
        `Hostname: ${os.hostname()}`,
        `Platform: ${os.platform()} ${os.arch()}`,
        `OS: ${os.type()} ${os.release()}`,
        `CPUs: ${os.cpus().length}x ${os.cpus()[0]?.model || 'unknown'}`,
        `Memory: ${Math.round(os.freemem() / 1073741824)}GB free / ${Math.round(os.totalmem() / 1073741824)}GB total`,
        `Uptime: ${Math.round(os.uptime() / 3600)}h`,
        `User: ${os.userInfo().username}`,
        `Home: ${os.homedir()}`,
        `Node: ${process.version}`,
        `Active plugin sessions: ${sessions.size}`
      ]
      console.log('[system-info]\n' + info.join('\n'))
    })

    api.registerCommand('active-sessions', () => {
      if (sessions.size === 0) {
        console.log('[system-info] No active sessions')
        return
      }
      for (const [sid, data] of sessions) {
        console.log(`[system-info] Session ${sid}: conn=${data.connectionId}, since=${data.connectedAt}`)
      }
    })

    // ─── Context Menu Items ────────────────────────────────

    api.registerContextMenuItem('Show System Info', (context) => {
      console.log(`[system-info] Context menu triggered. Session: ${context.sessionId}, Connection: ${context.connectionId}`)
      // In a real plugin, this could send a command to the terminal
    })

    // ─── Custom Theme ──────────────────────────────────────

    api.registerTheme('Nordic Frost', {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#bf616a',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4'
    })

    console.log('[system-info] Registered: 2 commands, 1 context menu item, 1 theme, all hooks')
  },

  deactivate() {
    sessions.clear()
    console.log('[system-info] Plugin deactivated')
  }
}
