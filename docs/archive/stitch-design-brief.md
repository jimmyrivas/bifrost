> **⚠️ Archived (2026-07-11).** Historical planning document — not an accurate description of the current app. See [docs/guide](../guide/README.md) and [openspec/specs](../../openspec/specs/) for the verified state.

# Bifrost — Design Brief for Google Stitch

## What is Bifrost?

Bifrost is a **modern desktop connection manager for Linux**, the spiritual successor to [Ásbrú Connection Manager](https://www.asbru-cm.net/). It's built with Electron, React, and xterm.js for sysadmins, DevOps, and DevSecOps professionals who manage dozens or hundreds of remote servers via SSH, RDP, VNC, and Telnet.

The name "Bifrost" comes from the rainbow bridge in Norse mythology that connects Midgard to Asgard — the same mythological reference that inspired the original Ásbrú project.

---

## Design Goal

We want a **dark-themed, modern UI that feels like a professional evolution of Ásbrú Connection Manager**, with the layout density and information architecture of Ásbrú but the visual polish and component quality of modern apps like VS Code, Warp terminal, or Tabby.

**Key inspiration: Ásbrú Connection Manager** — please reference its screenshots and UI patterns:
- Left sidebar with a hierarchical connection tree (folders/groups + connections with status icons)
- Tabbed terminal area in the center, supporting split panes (horizontal + vertical)
- Bottom status bar showing connection info
- Right-click context menus everywhere
- Connection-specific terminal color overrides (e.g. red background for production, green for staging)

---

## Application Layout

```
┌─────────────────────────────────────────────────────────┐
│ [Bifrost Logo/Brand]              [Quick Connect Bar]   │
├──────────┬──────────────────────────────────────────────┤
│          │  [Tab 1] [Tab 2] [Tab 3]  [+]               │
│ SIDEBAR  │──────────────────────────────────────────────│
│          │                                              │
│ - Search │            TERMINAL AREA                     │
│ - Groups │     (xterm.js with split panes)              │
│   └ Conn │                                              │
│   └ Conn │  Can split horizontally or vertically:       │
│ - Groups │  ┌─────────────┬────────────┐                │
│   └ Conn │  │ Terminal 1  │ Terminal 2 │                │
│          │  │             │            │                │
│          │  ├─────────────┴────────────┤                │
│ [Clusters]│  │      Terminal 3          │                │
│ [Settings]│  └─────────────────────────┘                │
│          │──────────────────────────────────────────────│
│          │  [PCC Bar: broadcast input to all terminals] │
├──────────┴──────────────────────────────────────────────┤
│ STATUS BAR: Ready | 3 tabs | UTF-8 | Connected: root@… │
└─────────────────────────────────────────────────────────┘
```

---

## Screens / Views Needed

### 1. Main View (Terminal + Connection Tree)
- **Left sidebar** (~200px, resizable, collapsible):
  - Bifrost logo/wordmark at top with subtle rainbow gradient
  - Quick connect input field (user@host:port format)
  - Hierarchical tree view: folders/groups containing connections
  - Each connection shows: icon (by protocol: SSH 🔑, RDP 🖥️, VNC 📺), name, host, status dot (green=connected, gray=disconnected, red=error)
  - Drag-and-drop reordering
  - Right-click context menu: Connect, Edit, Delete, Duplicate
  - Bottom: Clusters button, Settings gear icon
- **Tab bar**: horizontal tabs for open sessions, close button on hover, + button for new tab, middle-click to close
- **Terminal area**: dark background (#0a0a0b), monospace font, colored output. Support for split panes with thin resize handles
- **PCC bar** (optional, toggleable): amber-tinted bar at bottom of terminal area for broadcasting commands to all open terminals simultaneously
- **Status bar**: minimal, shows connection count, encoding, status text

### 2. Connection Form (Dialog/Panel)
- Full form to create/edit an SSH connection
- Fields organized in sections:
  - **General**: Name, Protocol (SSH/RDP/VNC/Telnet/Local), Host, Port
  - **Authentication**: Auth type (password/key/key+passphrase/manual), username, password (masked), private key path (with file picker), passphrase
  - **Options**: Launch on startup, auto-reconnect, run with sudo, custom tab title, auto-save logs
  - **Keep-alive**: Send string, interval, idle-only toggle
  - **Terminal override**: Custom color scheme, font, cursor style per connection
- Save / Cancel buttons
- Modern form design with proper labels, grouped sections, and subtle separators

### 3. Expect Editor (Automation Rules)
- Visual list of regex-based automation rules for a connection
- Each rule row shows: drag handle, regex pattern input, send text input, timeout, toggles (send return, hide from log)
- On match/on fail dropdowns to jump to other rules
- Add/remove/reorder controls
- This is the key differentiator from other terminal apps

### 4. Cluster Manager
- List of named clusters with member count
- Create: name + multi-select connections from tree
- "Open Cluster" button opens all member connections in tabs simultaneously
- PCC (Power Cluster Controller): separate input field that broadcasts keystrokes to all cluster terminals

### 5. Settings / Preferences
- Tab-based settings panel:
  - **Terminal**: font family, font size, cursor style, cursor blink, scrollback buffer, theme
  - **Language**: English / Spanish selector
  - **Network**: Global SOCKS proxy configuration
  - **KeePass**: Database path, key file, test connection
  - **Key Bindings**: Action → shortcut table with recording capability

### 6. Variable Manager
- Table of global variables: name, value (masked if secret), password toggle
- Used throughout the app for credential substitution in connection fields

### 7. SFTP Panel
- Split view alongside terminal
- Remote file browser: path bar, file/folder list with icons, size, permissions
- Toolbar: up, refresh, upload, download buttons
- Double-click folders to navigate, double-click files to download

### 8. Quake Terminal
- Dropdown terminal from top of screen (F12 hotkey, like Guake/Yakuake)
- Frameless window, slides down from top
- Same terminal styling as main app

---

## Color Palette & Theme

**Base (Dark Theme)**:
| Element | Color | Hex |
|---------|-------|-----|
| Background | Near-black | #0a0a0b |
| Surface | Dark zinc | #18181b |
| Surface elevated | Medium zinc | #27272a |
| Border | Zinc | #3f3f46 |
| Text primary | Light zinc | #e4e4e7 |
| Text secondary | Mid zinc | #a1a1aa |
| Text muted | Dark zinc | #71717a |

**Accent Colors**:
| Use | Color | Hex |
|-----|-------|-----|
| Brand gradient | Rainbow bridge | linear-gradient(135deg, #ff6b6b, #ffa36b, #ffd56b, #6bff6b, #6bd5ff, #6b6bff, #d56bff) |
| Focus/selection | Blue | #3b82f6 |
| Success/connected | Green | #22c55e |
| Error/disconnected | Red | #ef4444 |
| Warning | Yellow | #eab308 |
| PCC active | Amber | amber-tinted background |

**Connection-specific terminal backgrounds** (user-configurable per connection):
- Production servers: subtle red tint (#1a0505)
- Staging servers: subtle green tint (#051a0a)
- Development: default dark (#0a0a0b)

---

## Typography

- **UI text**: Inter or system-ui, -apple-system, sans-serif
- **Terminal / Code**: JetBrains Mono, Fira Code, Cascadia Code, monospace
- **Sizes**: 12px body, 14px terminal default, 11px status bar, 13px sidebar

---

## Brand Identity

- **Logo concept**: The word "Bifrost" with a subtle rainbow gradient on the text or as an underline/accent
- **Icon concept**: A stylized bridge or connection symbol incorporating rainbow colors — should work at 16x16 (tray), 32x32 (tab), and 256x256 (app icon) sizes
- **Visual motif**: Subtle rainbow gradient used sparingly — in the logo, as a thin line at the top of the window, or as hover effects on the sidebar brand area. NOT overwhelming — think "professional tool with a hint of color identity"

---

## Design Principles

1. **Information density**: Sysadmins need to see a lot of information at once. Don't waste space with large padding or oversized elements.
2. **Dark by default**: Terminal users work in dark environments. High contrast text on dark backgrounds.
3. **Professional, not playful**: This is a daily-driver tool for infrastructure professionals. Clean, minimal, functional.
4. **Keyboard-first**: Every action should be accessible via keyboard. Visual focus indicators matter.
5. **Visual feedback for state**: Connected/disconnected/error states should be immediately visible through color and icons.
6. **Ásbrú heritage**: The layout should feel familiar to Ásbrú users — same mental model, modernized execution.

---

## Reference Screenshots

For Ásbrú Connection Manager visual reference, see:
- https://www.asbru-cm.net/ (official site with screenshots)
- The app has: GTK-based UI, left sidebar tree, tabbed terminals, bottom info bar, gray/dark theme

We want to take that same layout and information architecture, but render it with modern web technologies (React + Tailwind + shadcn/ui) and a polished dark theme inspired by VS Code's aesthetic.
