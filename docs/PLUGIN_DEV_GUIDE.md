# Bifrost Plugin Development Guide

Create plugins to extend Bifrost with custom commands, themes, hooks, and context menu actions.

## Quick Start

```bash
# Create your plugin
mkdir my-plugin && cd my-plugin
npm init -y

# Edit package.json — add the "bifrost-plugin" keyword
# Edit index.js — export activate(api) and deactivate()

# Install into Bifrost
cp -r my-plugin ~/.config/bifrost/plugins/
# Or: cd ~/.config/bifrost/plugins && npm install /path/to/my-plugin
# Restart Bifrost
```

## Plugin Structure

```
my-plugin/
  package.json    # MUST have "bifrost-plugin" in keywords
  index.js        # Main entry — exports activate(api) and deactivate()
  README.md       # Optional
```

### package.json

```json
{
  "name": "bifrost-plugin-my-feature",
  "version": "1.0.0",
  "description": "What this plugin does",
  "keywords": ["bifrost-plugin"],
  "main": "index.js",
  "license": "GPL-3.0"
}
```

The `"bifrost-plugin"` keyword is **required** — without it, Bifrost won't activate your plugin.

### index.js

```javascript
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',

  activate(api) {
    // Your plugin code here — called once at startup
  },

  deactivate() {
    // Cleanup — called when plugin is uninstalled or app quits
  }
}
```

## API Reference

### api.registerHooks(hooks)

Subscribe to terminal and session lifecycle events.

```javascript
api.registerHooks({
  onConnect(connectionId, sessionId) {
    // SSH/Mosh session established
  },

  onDisconnect(connectionId, sessionId) {
    // Session closed
  },

  onData(sessionId, data) {
    // Terminal output received
    // Return void: pass data through unchanged
    // Return string: replace data (e.g., redact secrets, highlight patterns)
  },

  onTabCreate(tabId, connectionId) {
    // New tab created (connectionId is null for local terminals)
  },

  onTabClose(tabId) {
    // Tab closed
  }
})
```

**Hook reference:**

| Hook | Parameters | Return | When |
|------|-----------|--------|------|
| `onConnect` | `(connectionId, sessionId)` | void | SSH/Mosh connected |
| `onDisconnect` | `(connectionId, sessionId)` | void | Session closed |
| `onData` | `(sessionId, data)` | `string \| void` | Terminal data received |
| `onTabCreate` | `(tabId, connectionId?)` | void | Tab created |
| `onTabClose` | `(tabId)` | void | Tab closed |

### api.registerCommand(name, handler)

Register a command that can be invoked from the command palette or programmatically.

```javascript
api.registerCommand('deploy-check', () => {
  // This runs in the main process (Node.js)
  const os = require('os')
  console.log(`Running on ${os.hostname()}`)
})
```

### api.registerContextMenuItem(label, handler)

Add an item to the terminal right-click context menu.

```javascript
api.registerContextMenuItem('Run Diagnostic', (context) => {
  // context.sessionId — current terminal session ID
  // context.connectionId — SSH connection ID (null for local)
  console.log('Diagnostic for:', context.sessionId)
})
```

### api.registerTheme(name, theme)

Register a custom terminal color scheme.

```javascript
api.registerTheme('My Theme', {
  background: '#1a1a2e',
  foreground: '#e6e6e6',
  cursor: '#ff6b6b',
  cursorAccent: '#1a1a2e',
  selectionBackground: '#3a3a5e',
  // ANSI colors (required)
  black: '#1a1a2e',
  red: '#ff6b6b',
  green: '#6bff6b',
  yellow: '#ffd56b',
  blue: '#6b6bff',
  magenta: '#d56bff',
  cyan: '#6bd5ff',
  white: '#e6e6e6',
  // Bright variants
  brightBlack: '#3a3a5e',
  brightRed: '#ff8a8a',
  brightGreen: '#8aff8a',
  brightYellow: '#ffe08a',
  brightBlue: '#8a8aff',
  brightMagenta: '#e08aff',
  brightCyan: '#8ae0ff',
  brightWhite: '#ffffff'
})
```

### api.registerProfileProvider(name, provider)

Register a custom connection profile provider (e.g., fetch hosts from an API).

```javascript
api.registerProfileProvider('my-cloud', async () => {
  // Return array of connection objects
  return [
    { name: 'prod-1', host: '10.0.1.1', port: 22, username: 'deploy' },
    { name: 'prod-2', host: '10.0.1.2', port: 22, username: 'deploy' }
  ]
})
```

## Plugin Execution Environment

- Plugins run in the **Electron main process** (Node.js)
- Full access to Node.js APIs: `require('fs')`, `require('os')`, `require('child_process')`, etc.
- Plugins are NOT sandboxed — they have the same privileges as Bifrost itself
- Errors in plugins are caught and logged, not propagated to the app

## Installation Methods

### Manual (development)

```bash
# Copy directly to plugins directory
cp -r my-plugin/ ~/.config/bifrost/plugins/my-plugin/

# Restart Bifrost to activate
```

### npm install

```bash
cd ~/.config/bifrost/plugins/
npm install bifrost-plugin-my-feature

# Restart Bifrost to activate
```

### From Bifrost UI

Settings > Plugins > Enter package name > Install

## Plugin Ideas

| Plugin | Description | Hooks Used |
|--------|-------------|-----------|
| **Session logger** | Log all commands to a file | `onConnect`, `onData`, `onDisconnect` |
| **Error alerter** | Desktop notification on error patterns | `onData` |
| **Auto-sudo** | Detect permission denied, offer to re-run with sudo | `onData` |
| **Connection counter** | Track time spent per host | `onConnect`, `onDisconnect` |
| **Output redactor** | Mask sensitive data patterns | `onData` (return modified) |
| **Theme pack** | Bundle multiple color schemes | `registerTheme` (multiple) |
| **Cloud importer** | Fetch hosts from AWS/GCP/Azure | `registerProfileProvider` |
| **Slack notifier** | Post to Slack on connect/disconnect | `onConnect`, `onDisconnect` |
| **Audit trail** | Send session events to SIEM | All hooks |
| **Command suggester** | Add context menu with smart suggestions | `registerContextMenuItem` |

## Example Plugin

See `examples/bifrost-plugin-system-info/` in the Bifrost repo for a complete working example with:
- All lifecycle hooks
- Two custom commands (`system-info`, `active-sessions`)
- One context menu item
- One custom theme (Nordic Frost)

## Debugging

Plugin console output goes to Electron's main process console:
```bash
# Run Bifrost in dev mode to see plugin logs
npm run dev
# Plugin logs appear with [plugin] prefix in the terminal
```

## Publishing

1. Name your package `bifrost-plugin-*` (convention, not required)
2. Include `"bifrost-plugin"` in `keywords` (required)
3. Publish to npm: `npm publish`
4. Users install via: Settings > Plugins > `bifrost-plugin-your-name`
