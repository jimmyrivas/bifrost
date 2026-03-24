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
    registerCommand: (name, handler) => { console.log(`[plugin] Command registered: ${name}`) },
    registerTheme: (name, theme) => { console.log(`[plugin] Theme registered: ${name}`) },
    registerProfileProvider: (name, provider) => { console.log(`[plugin] Profile provider: ${name}`) },
    registerHooks: (hooks) => { registeredHooks.push(hooks) },
    registerContextMenuItem: (label, handler) => { contextMenuItems.push({ label, handler }) }
  }
}

function getPluginsDir(): string {
  const dir = join(app.getPath('userData'), 'plugins')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  return dir
}

/**
 * Scan the plugins directory for valid plugin packages.
 */
export function loadPlugins(): PluginInfo[] {
  const pluginsDir = getPluginsDir()
  const plugins: PluginInfo[] = []

  let entries: string[]
  try {
    entries = readdirSync(pluginsDir)
  } catch {
    return []
  }

  for (const entry of entries) {
    const pkgPath = join(pluginsDir, entry, 'package.json')
    if (!existsSync(pkgPath)) continue

    try {
      const raw = readFileSync(pkgPath, 'utf-8')
      const manifest = JSON.parse(raw) as PluginManifest
      const isBifrostPlugin =
        manifest.keywords?.includes('bifrost-plugin') ?? false

      plugins.push({
        name: manifest.name || entry,
        version: manifest.version || '0.0.0',
        description: manifest.description || '',
        path: join(pluginsDir, entry),
        valid: isBifrostPlugin
      })
    } catch {
      plugins.push({
        name: entry,
        version: '0.0.0',
        description: 'Invalid package.json',
        path: join(pluginsDir, entry),
        valid: false
      })
    }
  }

  return plugins
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
    return {
      name: manifest.name || packageName,
      version: manifest.version || '0.0.0',
      description: manifest.description || '',
      path: nmDir,
      valid: manifest.keywords?.includes('bifrost-plugin') ?? false
    }
  }

  return {
    name: packageName,
    version: '0.0.0',
    description: 'Installed (package.json not found)',
    path: nmDir,
    valid: false
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
