/**
 * #29-31: Plugin system (basic loading/listing).
 *
 * Plugins are npm packages with a "bifrost-plugin" keyword in package.json.
 * They live in app.getPath('userData')/plugins/.
 */

import { app } from 'electron'
import { join } from 'path'
import { readdirSync, readFileSync, existsSync, mkdirSync, rmSync } from 'fs'
import { execSync, execFileSync } from 'child_process'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'

const DISABLED_PLUGINS_KEY = 'disabled_plugins'

function getDisabledSet(): Set<string> {
  try {
    const db = getDatabase()
    const row = db.select().from(schema.preferences).where(eq(schema.preferences.key, DISABLED_PLUGINS_KEY)).get()
    if (row?.value) return new Set(JSON.parse(row.value) as string[])
  } catch { /* DB not ready */ }
  return new Set()
}

function saveDisabledSet(disabled: Set<string>): void {
  try {
    const db = getDatabase()
    const json = JSON.stringify([...disabled])
    db.insert(schema.preferences)
      .values({ key: DISABLED_PLUGINS_KEY, value: json })
      .onConflictDoUpdate({ target: schema.preferences.key, set: { value: json } })
      .run()
  } catch { /* non-fatal */ }
}

export function enablePlugin(name: string): void {
  const disabled = getDisabledSet()
  disabled.delete(name)
  saveDisabledSet(disabled)
}

export function disablePlugin(name: string): void {
  const disabled = getDisabledSet()
  disabled.add(name)
  saveDisabledSet(disabled)
}

export interface PluginManifest {
  name: string
  version: string
  description: string
  keywords?: string[]
  main?: string
}

export interface PluginInfo {
  name: string
  version: string
  description: string
  path: string
  valid: boolean
  enabled: boolean
}

export interface PluginHooks {
  onConnect?: (connectionId: string, sessionId: string) => void
  onDisconnect?: (connectionId: string, sessionId: string) => void
  onData?: (sessionId: string, data: string) => string | void // return modified data or void
  onTabCreate?: (tabId: string, connectionId?: string) => void
  onTabClose?: (tabId: string) => void
}

export interface PluginApi {
  registerCommand: (name: string, handler: () => void) => void
  registerTheme: (name: string, theme: Record<string, string>) => void
  registerProfileProvider: (name: string, provider: () => unknown) => void
  registerHooks: (hooks: PluginHooks) => void
  registerContextMenuItem: (label: string, handler: (context: { sessionId?: string; connectionId?: string }) => void) => void
}

export interface PluginExports {
  name: string
  version: string
  description?: string
  activate?: (api: PluginApi) => void
  deactivate?: () => void
}

// Global hooks registry
const registeredHooks: PluginHooks[] = []
const contextMenuItems: Array<{ label: string; handler: (ctx: { sessionId?: string; connectionId?: string }) => void }> = []

export function getRegisteredHooks(): PluginHooks[] { return registeredHooks }
export function getContextMenuItems(): typeof contextMenuItems { return contextMenuItems }

export function dispatchHook<K extends keyof PluginHooks>(
  hookName: K,
  ...args: Parameters<NonNullable<PluginHooks[K]>>
): void {
  for (const hooks of registeredHooks) {
    try {
      const fn = hooks[hookName] as ((...a: unknown[]) => unknown) | undefined
      fn?.(...args)
    } catch (err) {
      console.warn(`[plugin] Hook ${hookName} error:`, err)
    }
  }
}

function createPluginApi(): PluginApi {
  return {
    registerCommand: (name, handler) => {
      registeredCommands.set(name, handler)
      console.log(`[plugin] Command registered: ${name}`)
    },
    registerTheme: (name, theme) => {
      registeredThemes.set(name, theme)
      console.log(`[plugin] Theme registered: ${name}`)
    },
    registerProfileProvider: (name, provider) => {
      console.log(`[plugin] Profile provider: ${name}`)
    },
    registerHooks: (hooks) => {
      registeredHooks.push(hooks)
    },
    registerContextMenuItem: (label, handler) => {
      contextMenuItems.push({ label, handler })
    }
  }
}

function getPluginsDir(): string {
  const dir = join(app.getPath('userData'), 'plugins')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

const activatedPlugins: Array<{ info: PluginInfo; exports: PluginExports }> = []
const registeredCommands = new Map<string, () => void>()
const registeredThemes = new Map<string, Record<string, string>>()

export function getRegisteredCommands(): Map<string, () => void> { return registeredCommands }
export function getRegisteredThemes(): Map<string, Record<string, string>> { return registeredThemes }

/**
 * Scan the plugins directory for valid plugin packages.
 */
export function listPlugins(): PluginInfo[] {
  const pluginsDir = getPluginsDir()
  const disabled = getDisabledSet()
  const plugins: PluginInfo[] = []

  // Scan direct directories
  let entries: string[]
  try {
    entries = readdirSync(pluginsDir)
  } catch {
    return []
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === 'package.json' || entry === 'package-lock.json') continue
    const pkgPath = join(pluginsDir, entry, 'package.json')
    if (!existsSync(pkgPath)) continue

    try {
      const raw = readFileSync(pkgPath, 'utf-8')
      const manifest = JSON.parse(raw) as PluginManifest
      const isBifrostPlugin = manifest.keywords?.includes('bifrost-plugin') ?? false

      const name = manifest.name || entry
      plugins.push({
        name,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        path: join(pluginsDir, entry),
        valid: isBifrostPlugin,
        enabled: isBifrostPlugin && !disabled.has(name)
      })
    } catch {
      plugins.push({
        name: entry,
        version: '0.0.0',
        description: 'Invalid package.json',
        path: join(pluginsDir, entry),
        valid: false,
        enabled: false
      })
    }
  }

  // Also scan node_modules for npm-installed plugins
  const nmDir = join(pluginsDir, 'node_modules')
  if (existsSync(nmDir)) {
    try {
      for (const entry of readdirSync(nmDir)) {
        if (entry.startsWith('.')) continue
        const pkgPath = join(nmDir, entry, 'package.json')
        if (!existsSync(pkgPath)) continue
        try {
          const raw = readFileSync(pkgPath, 'utf-8')
          const manifest = JSON.parse(raw) as PluginManifest
          if (manifest.keywords?.includes('bifrost-plugin')) {
            const pname = manifest.name || entry
            plugins.push({
              name: pname,
              version: manifest.version || '0.0.0',
              description: manifest.description || '',
              path: join(nmDir, entry),
              valid: true,
              enabled: !disabled.has(pname)
            })
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }

  return plugins
}

/** Kept for backward compat — alias for listPlugins */
export function loadPlugins(): PluginInfo[] {
  return listPlugins()
}

/**
 * Activate all valid plugins — call activate(api) on each.
 * Called once at startup.
 */
export function activatePlugins(): void {
  const plugins = listPlugins()
  const api = createPluginApi()

  for (const info of plugins) {
    if (!info.valid || !info.enabled) continue
    try {
      const mainFile = join(info.path, 'index.js')
      if (!existsSync(mainFile)) {
        console.warn(`[plugin] ${info.name}: no index.js found`)
        continue
      }
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const exports = require(mainFile) as PluginExports
      if (typeof exports.activate === 'function') {
        exports.activate(api)
        activatedPlugins.push({ info, exports })
        console.log(`[plugin] Activated: ${info.name} v${info.version}`)
      }
    } catch (err) {
      console.error(`[plugin] Failed to activate ${info.name}:`, err)
    }
  }
}

/**
 * Deactivate all plugins — call deactivate() on each.
 * Called on app quit.
 */
export function deactivatePlugins(): void {
  for (const { info, exports } of activatedPlugins) {
    try {
      exports.deactivate?.()
    } catch (err) {
      console.warn(`[plugin] Deactivate error for ${info.name}:`, err)
    }
  }
  activatedPlugins.length = 0
  registeredHooks.length = 0
  contextMenuItems.length = 0
  registeredCommands.clear()
  registeredThemes.clear()
}

/**
 * Install a plugin by running npm install in the plugins directory.
 */
export function installPlugin(packageName: string): PluginInfo {
  const pluginsDir = getPluginsDir()

  // Ensure package.json exists in plugins dir for npm
  const rootPkg = join(pluginsDir, 'package.json')
  if (!existsSync(rootPkg)) {
    const pkg = JSON.stringify(
      { name: 'bifrost-plugins', version: '1.0.0', private: true },
      null,
      2
    )
    const { writeFileSync } = require('fs') as typeof import('fs')
    writeFileSync(rootPkg, pkg, 'utf-8')
  }

  // Validate package name to prevent injection
  if (!/^[@a-z0-9][-a-z0-9._/]*$/i.test(packageName)) {
    throw new Error(`Invalid package name: ${packageName}`)
  }
  execFileSync('npm', ['install', packageName], {
    cwd: pluginsDir,
    timeout: 60000,
    stdio: 'pipe'
  })

  // Find the installed package in node_modules
  const nmDir = join(pluginsDir, 'node_modules', packageName)
  if (existsSync(join(nmDir, 'package.json'))) {
    const raw = readFileSync(join(nmDir, 'package.json'), 'utf-8')
    const manifest = JSON.parse(raw) as PluginManifest
    const isValid = manifest.keywords?.includes('bifrost-plugin') ?? false
    return {
      name: manifest.name || packageName,
      version: manifest.version || '0.0.0',
      description: manifest.description || '',
      path: nmDir,
      valid: isValid,
      enabled: isValid  // enabled by default on install
    }
  }

  return {
    name: packageName,
    version: '0.0.0',
    description: 'Installed (package.json not found)',
    path: nmDir,
    valid: false,
    enabled: false
  }
}

/**
 * Uninstall a plugin by removing its directory.
 */
export function uninstallPlugin(pluginName: string): void {
  const pluginsDir = getPluginsDir()

  // Check node_modules first (npm installed)
  const nmPath = join(pluginsDir, 'node_modules', pluginName)
  if (existsSync(nmPath)) {
    rmSync(nmPath, { recursive: true, force: true })
    return
  }

  // Check direct directory
  const directPath = join(pluginsDir, pluginName)
  if (existsSync(directPath)) {
    rmSync(directPath, { recursive: true, force: true })
  }
}
