# Bifrost Plugin API

## Overview

Bifrost plugins are npm packages installed in `~/.config/bifrost/plugins/`. They can extend Bifrost with custom commands, themes, connection providers, and lifecycle hooks.

## Plugin Structure

```
my-plugin/
  package.json    # Must include "bifrost-plugin" in keywords
  index.js        # Main entry point
```

### package.json

```json
{
  "name": "bifrost-plugin-example",
  "version": "1.0.0",
  "description": "Example Bifrost plugin",
  "keywords": ["bifrost-plugin"],
  "main": "index.js"
}
```

### index.js

```javascript
module.exports = {
  name: 'example-plugin',
  version: '1.0.0',
  description: 'Example plugin demonstrating the Bifrost Plugin API',

  activate(api) {
    // Register lifecycle hooks
    api.registerHooks({
      onConnect: (connectionId, sessionId) => {
        console.log(`Connected: ${connectionId} (session: ${sessionId})`)
      },
      onDisconnect: (connectionId, sessionId) => {
        console.log(`Disconnected: ${connectionId}`)
      },
      onData: (sessionId, data) => {
        // Optionally transform data before display
        // Return modified string or void to pass through
      },
      onTabCreate: (tabId, connectionId) => {
        console.log(`Tab created: ${tabId}`)
      },
      onTabClose: (tabId) => {
        console.log(`Tab closed: ${tabId}`)
      }
    })

    // Register a custom command
    api.registerCommand('hello', () => {
      console.log('Hello from plugin!')
    })

    // Register a context menu item
    api.registerContextMenuItem('My Plugin Action', (context) => {
      console.log('Context:', context.sessionId, context.connectionId)
    })

    // Register a custom theme
    api.registerTheme('My Theme', {
      background: '#1a1a2e',
      foreground: '#e6e6e6',
      cursor: '#ff6b6b',
      // ... xterm.js theme colors
    })
  },

  deactivate() {
    console.log('Plugin deactivated')
  }
}
```

## API Reference

### `api.registerHooks(hooks: PluginHooks)`

Register lifecycle hooks:

| Hook | Signature | When |
|------|-----------|------|
| `onConnect` | `(connectionId, sessionId) => void` | SSH/Mosh session established |
| `onDisconnect` | `(connectionId, sessionId) => void` | Session closed |
| `onData` | `(sessionId, data) => string \| void` | Terminal data received (can transform) |
| `onTabCreate` | `(tabId, connectionId?) => void` | New tab created |
| `onTabClose` | `(tabId) => void` | Tab closed |

### `api.registerCommand(name, handler)`

Register a command accessible from the command palette.

### `api.registerContextMenuItem(label, handler)`

Add an item to the terminal right-click context menu.

### `api.registerTheme(name, theme)`

Register a custom terminal color scheme.

### `api.registerProfileProvider(name, provider)`

Register a custom connection profile provider (e.g., fetch from external API).

## Installation

```bash
# From the Bifrost Settings > Plugins tab
# Or manually:
cd ~/.config/bifrost/plugins
npm install bifrost-plugin-example
```

## Plugin Lifecycle

1. **Discovery**: Bifrost scans `plugins/` directory on startup
2. **Validation**: Checks `package.json` for `bifrost-plugin` keyword
3. **Activation**: Calls `activate(api)` with the Plugin API
4. **Runtime**: Hooks are invoked during app lifecycle
5. **Deactivation**: Calls `deactivate()` when plugin is uninstalled or app closes
