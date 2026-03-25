# Windows Compatibility — Implementation Plan

**Goal**: Make Bifrost run on Windows with full core functionality.
**Approach**: 4 phases, incrementales. Cada fase deja la app funcional.

---

## Phase 1: Platform Foundation (Critical — blocks everything)

**Scope**: Utility functions + build config. Sin esto nada funciona en Windows.

### 1.1 Create platform utility module
**New file**: `src/main/services/platform.ts`

```
- commandExists(cmd) — uses 'where' on win32, 'which' on unix
- getDefaultShell() — powershell.exe on win32, $SHELL or /bin/bash on unix
- getPingArgs(host) — [-n, 1, -w, 3000] on win32, [-c, 1, -W, 3] on unix
- getHomeDir() — os.homedir() (already cross-platform)
- isWindows() / isLinux() / isMac() — platform checks
```

**Files to update** (replace inline platform checks):
| File | Lines | Change |
|------|-------|--------|
| `password-manager.ts` | 13 | `commandExists()` → import from platform.ts |
| `keepass-bridge.ts` | 28 | Same |
| `terminal.ipc.ts` | 32, 70 | `getDefaultShell()`, `commandExists()` from platform.ts |
| `cloud-discovery.ts` | 20 | `commandExists()` from platform.ts |
| `connection-health.ts` | 70 | `getPingArgs()` from platform.ts |

### 1.2 Add Windows/macOS to electron-builder.yml
```yaml
win:
  target:
    - nsis
    - portable
  icon: resources/icon.ico
  publisherName: Jimmy Rivas

mac:
  target:
    - dmg
  category: public.app-category.utilities
  icon: resources/icon.icns
```

### 1.3 Add Windows build script
**New file**: `scripts/build-windows.sh` (cross-compile from Linux via Wine/electron-builder)
**New file**: `scripts/build-windows.ps1` (native Windows build)

**Estimated effort**: 4-6 hours
**Risk**: Low — all changes are additive, no regression on Linux

---

## Phase 2: Terminal & Shell (High — core functionality)

**Scope**: Terminal local, font detection, shell detection.

### 2.1 Font scanner — platform-aware
**File**: `src/main/services/font-scanner.ts:38`

| Platform | Method |
|----------|--------|
| Linux | `fc-list :spacing=mono family` (current) |
| Windows | PowerShell: `[System.Drawing.Text.InstalledFontCollection]::new().Families` or Registry: `HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts` |
| macOS | `system_profiler SPFontsDataType -json` |

Fallback `FALLBACK_FONTS` array ya funciona si la detección falla.

### 2.2 Shell detection — platform-aware candidates
**File**: `src/main/ipc/terminal.ipc.ts:40-44`

```typescript
const UNIX_SHELLS = [
  { id: 'bash', name: 'Bash', bins: ['/bin/bash', '/usr/bin/bash'] },
  { id: 'zsh', name: 'Zsh', bins: ['/bin/zsh', '/usr/bin/zsh'] },
  { id: 'fish', name: 'Fish', bins: ['/usr/bin/fish'] },
  { id: 'pwsh', name: 'PowerShell', bins: ['/usr/bin/pwsh', '/snap/bin/pwsh'] },
  { id: 'sh', name: 'POSIX sh', bins: ['/bin/sh'] }
]

const WIN_SHELLS = [
  { id: 'pwsh', name: 'PowerShell 7', bins: ['pwsh.exe'] },
  { id: 'powershell', name: 'Windows PowerShell', bins: ['powershell.exe'] },
  { id: 'cmd', name: 'Command Prompt', bins: ['cmd.exe'] },
  { id: 'bash', name: 'Git Bash', bins: ['C:\\Program Files\\Git\\bin\\bash.exe'] },
  { id: 'wsl', name: 'WSL', bins: ['wsl.exe'] }
]
```

### 2.3 PTY home directory
**File**: `src/main/ipc/terminal.ipc.ts:95`
- Ya usa `homedir()` como fallback — OK
- Eliminar fallback a `'/'` que no existe en Windows → usar `homedir()` siempre

**Estimated effort**: 3-4 hours
**Risk**: Low — font scanner has fallback, shell detection already has platform check

---

## Phase 3: External Protocols & Commands (Medium — optional features)

**Scope**: RDP, VNC, Mosh, FTP, signals. Features que fallan silenciosamente en Windows.

### 3.1 Process signals
**File**: `src/main/services/external-protocol.ts:719`
```typescript
// Node.js on Windows translates SIGTERM to process termination
// But explicit handling is cleaner:
if (platform() === 'win32') {
  session.process.kill()  // default signal
} else {
  session.process.kill('SIGTERM')
}
```

### 3.2 RDP — use native mstsc.exe on Windows
**File**: `src/main/services/external-protocol.ts:103`
- Linux: `xfreerdp` (current)
- Windows: `mstsc.exe /v:host:port` (native, always available)
- macOS: `open rdp://host` or Microsoft Remote Desktop app

### 3.3 VNC — add Windows viewers
**File**: `src/main/services/external-protocol.ts:151`
- Add TightVNC, RealVNC, UltraVNC to candidate list
- Check: `vncviewer.exe` in `%ProgramFiles%`

### 3.4 Mosh — detect and warn
**File**: `src/main/services/external-protocol.ts:299`
- Mosh is not natively available on Windows
- Options: warn user, suggest WSL, or detect if Cygwin mosh exists
- Return error: "Mosh is not available on Windows. Use SSH instead."

### 3.5 FTP — use native ftp.exe on Windows
**File**: `src/main/services/external-protocol.ts:479-487`
- Windows has built-in `ftp.exe` (deprecated but available)
- Or detect WinSCP if installed

### 3.6 TN3270 / WebDAV
- Niche protocols. Detect if tools exist, warn if not.
- No blockers.

**Estimated effort**: 6-8 hours
**Risk**: Medium — needs testing on actual Windows with protocol clients

---

## Phase 4: Content & Suggestions (Low — cosmetic/UX)

**Scope**: Sample scripts, snippets, command suggestions. No funcionalidad rota, solo contenido irrelevante en Windows.

### 4.1 Platform-aware sample scripts
**File**: `src/main/services/script-engine.ts:47-84`

Agregar set alternativo de samples para Windows:
```javascript
// Windows Health Check
const windowsSamples = [
  { name: 'System Health Check (Windows)',
    code: `Get-ComputerInfo | Select CsName, OsVersion, OsArchitecture
Get-Process | Sort-Object CPU -Descending | Select -First 10
Get-Volume | Where-Object DriveLetter
Get-Service | Where-Object Status -eq Running | Measure-Object` }
]
```

Seleccionar set basado en `process.platform`.

### 4.2 Platform-aware snippets
**File**: `src/main/services/snippet-manager.ts`

Agregar snippets Windows:
- `Get-Service` → `systemctl`
- `Get-EventLog` → `journalctl`
- `Get-Process` → `ps aux`
- `netstat -an` → `ss -tlnp`
- `taskkill /F /PID` → `kill -9`

### 4.3 Platform-aware command suggestions
**File**: `src/renderer/src/lib/command-suggestions.ts`

Agregar sugerencias Windows/PowerShell al array, filtrar por `navigator.platform`.

### 4.4 Platform-aware runbook samples
**File**: `src/renderer/src/components/automation/RunbookEditor.tsx`

Agregar runbooks Windows:
- "Windows Server Health Check" (PowerShell)
- "Windows Security Audit" (Event Viewer, netsh, etc.)

**Estimated effort**: 4-5 hours
**Risk**: None — only content changes, existing content still works on Linux

---

## Dependencies & Prerequisites

```
Phase 1 ──→ Phase 2 ──→ Phase 3
                  └──→ Phase 4 (independent)
```

- Phase 1 is required before anything else (platform.ts utility)
- Phase 2 depends on Phase 1 (uses platform utilities)
- Phase 3 depends on Phase 1 (uses platform checks)
- Phase 4 is independent (content-only changes)

## Testing Strategy

### Dev testing (Linux → Windows cross-compile)
```bash
# Cross-compile AppImage for testing
npx electron-builder --win portable --x64
```

### CI/CD (future)
```yaml
# GitHub Actions matrix
strategy:
  matrix:
    os: [ubuntu-latest, windows-latest, macos-latest]
```

### Manual testing checklist
- [ ] Local terminal opens with correct shell (PowerShell on Windows)
- [ ] Font picker shows system monospace fonts
- [ ] SSH connections work (ssh2 is pure JS — should work)
- [ ] SFTP panel works
- [ ] Ping health check works
- [ ] Password managers detected (op.exe, bw.exe)
- [ ] RDP connects via mstsc.exe
- [ ] VNC connects if viewer installed
- [ ] Mosh shows appropriate error
- [ ] Snippets show Windows commands
- [ ] AI assistant works (API calls are cross-platform)
- [ ] Notes, runbooks, session resume all work
- [ ] AppImage/NSIS installer builds correctly

## Estimated Total Effort

| Phase | Hours | Priority |
|-------|-------|----------|
| Phase 1: Foundation | 4-6h | CRITICAL |
| Phase 2: Terminal & Shell | 3-4h | HIGH |
| Phase 3: Protocols | 6-8h | MEDIUM |
| Phase 4: Content | 4-5h | LOW |
| **Total** | **17-23h** | |

## What Already Works on Windows (no changes needed)

- SSH/SFTP (ssh2 is pure JS)
- Database (better-sqlite3 has Windows binaries)
- UI (React + xterm.js)
- AI Assistant (HTTP API calls)
- Session Notes (SQLite)
- Runbooks (localStorage + IPC)
- Credential store (Electron safeStorage uses Windows DPAPI)
- Config sync (git CLI if installed)
- Session recording (asciicast format)
- Audit logging (JSON files)
- All Zustand stores
- All keyboard shortcuts
