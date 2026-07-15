import { ipcMain, BrowserWindow } from 'electron'
import { ExpectEngine, type ExpectRule, type ExpectEvent } from '../services/expect-engine'
import { variableEngine, type VariableContext } from '../services/variable-engine'
import { macroExecutor, type MacroDefinition, type ExecCommandDefinition } from '../services/macro-executor'
import { getDatabase, schema } from '../db'
import { eq, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { sshManager } from '../services/ssh-manager'

const engines = new Map<string, ExpectEngine>()

/** Build the effective rule set for a connection's live session: its own
 * expect rules, ordered by sortOrder. (Global detection patterns are NOT
 * included — in watch mode they would fire empty responses and add noise.) */
function buildRulesForConnection(connectionId: string): ExpectRule[] {
  const db = getDatabase()
  const connRules = db
    .select()
    .from(schema.expectRules)
    .where(eq(schema.expectRules.connectionId, connectionId))
    .all()
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return connRules.map((cr) => ({
    id: cr.id,
    pattern: new RegExp(cr.pattern),
    sendText: cr.sendText,
    sendReturn: cr.sendReturn ?? true,
    hideFromLog: cr.hideFromLog ?? false,
    timeout: cr.timeoutMs ?? 10000,
    onMatch: cr.onMatchRuleId,
    onFail: cr.onFailRuleId,
    enabled: (cr as Record<string, unknown>).enabled !== false
  }))
}

/**
 * Create + start an expect engine bound to a live SSH session, if the
 * connection has any rules (global detection patterns count). Idempotent: a
 * second call for the same session returns the existing engine's rule count.
 * The engine writes matched responses straight back to the SSH session and
 * forwards match/buffer events to the renderer for the debug view.
 */
export function ensureExpectEngine(
  sessionId: string,
  connectionId: string,
  mainWindow: BrowserWindow
): number {
  const existing = engines.get(sessionId)
  if (existing) return existing.getRulesCount()

  const rules = buildRulesForConnection(connectionId)
  if (rules.length === 0) return 0

  const engine = new ExpectEngine()
  engine.setRules(rules)
  engine.setWatchMode(true) // independent always-active triggers, no timeout
  engine.setWriteFunction((text: string) => sshManager.write(sessionId, text))
  engine.on('expect-event', (event: ExpectEvent) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('expect:event', sessionId, event)
  })
  engine.on('buffer-update', (buffer: string) => {
    if (!mainWindow.isDestroyed()) mainWindow.webContents.send('expect:bufferUpdate', sessionId, buffer)
  })
  engines.set(sessionId, engine)
  engine.start()
  return rules.length
}

/** Feed live session output into the session's expect engine (no-op if none). */
export function feedExpect(sessionId: string, data: string): void {
  engines.get(sessionId)?.feed(data)
}

/** Tear down a session's expect engine (no-op if none). */
export function destroyExpect(sessionId: string): void {
  const engine = engines.get(sessionId)
  if (engine) {
    engine.stop()
    engine.removeAllListeners()
    engines.delete(sessionId)
  }
}

export function registerExpectIpc(mainWindow: BrowserWindow): void {
  // Create an expect engine for a session (thin wrapper over ensureExpectEngine,
  // which SSH sessions also call automatically on shell open).
  ipcMain.handle('expect:create', (_event, sessionId: string, connectionId: string) => {
    return ensureExpectEngine(sessionId, connectionId, mainWindow)
  })

  ipcMain.handle('expect:start', (_event, sessionId: string) => {
    engines.get(sessionId)?.start()
  })

  ipcMain.handle('expect:stop', (_event, sessionId: string) => {
    engines.get(sessionId)?.stop()
  })

  ipcMain.on('expect:feed', (_event, sessionId: string, data: string) => {
    feedExpect(sessionId, data)
  })

  ipcMain.handle('expect:setDebug', (_event, sessionId: string, enabled: boolean) => {
    engines.get(sessionId)?.setDebug(enabled)
  })

  ipcMain.handle('expect:getStatus', (_event, sessionId: string) => {
    const engine = engines.get(sessionId)
    if (!engine) return { active: false, rulesCount: 0, currentRule: null, debug: false }
    return {
      active: engine.isRunning(),
      rulesCount: engine.getRulesCount(),
      currentRule: engine.getCurrentRule(),
      debug: engine.isDebug(),
      log: engine.getDebugLog()
    }
  })

  ipcMain.handle('expect:destroy', (_event, sessionId: string) => {
    destroyExpect(sessionId)
  })

  // Variable resolution
  ipcMain.handle(
    'variables:resolve',
    async (_event, input: string, context: VariableContext) => {
      return variableEngine.resolve(input, context)
    }
  )

  // Global variables CRUD
  ipcMain.handle('variables:listGlobal', () => {
    const db = getDatabase()
    return db.select().from(schema.globalVariables).all()
  })

  ipcMain.handle(
    'variables:setGlobal',
    (_event, id: string, name: string, value: string, isPassword: boolean) => {
      const db = getDatabase()
      db.insert(schema.globalVariables)
        .values({ id, name, value, isPassword })
        .onConflictDoUpdate({
          target: schema.globalVariables.id,
          set: { name, value, isPassword }
        })
        .run()
    }
  )

  ipcMain.handle('variables:deleteGlobal', (_event, id: string) => {
    const db = getDatabase()
    db.delete(schema.globalVariables).where(eq(schema.globalVariables.id, id)).run()
  })

  // Macro execution
  ipcMain.handle(
    'macros:execute',
    async (_event, macro: MacroDefinition, context: VariableContext) => {
      return macroExecutor.executeMacro(macro, context)
    }
  )

  ipcMain.handle(
    'macros:executeExecCommands',
    async (_event, commands: ExecCommandDefinition[], context: VariableContext) => {
      return macroExecutor.executeExecCommands(commands, context)
    }
  )

  // List macros: connection-scoped when an id is given, otherwise the global
  // macros (connectionId IS NULL), ordered by sortOrder.
  ipcMain.handle('macros:list', (_event, connectionId?: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.macros)
      .where(connectionId ? eq(schema.macros.connectionId, connectionId) : isNull(schema.macros.connectionId))
      .orderBy(schema.macros.sortOrder)
      .all()
  })

  // Save the whole macro set for a scope (global = null connectionId, or a
  // specific connection): delete-all-for-scope + re-insert, mirroring
  // execCommands:save. No granular CRUD channel existed.
  ipcMain.handle(
    'macros:save',
    (
      _event,
      connectionId: string | null,
      macros: Array<{ name: string; command: string; type: 'remote' | 'local'; confirmBeforeExec?: boolean }>
    ) => {
      const db = getDatabase()
      db.delete(schema.macros)
        .where(connectionId ? eq(schema.macros.connectionId, connectionId) : isNull(schema.macros.connectionId))
        .run()
      macros.forEach((m, i) => {
        db.insert(schema.macros)
          .values({
            id: randomUUID(),
            connectionId,
            name: m.name,
            command: m.command,
            type: m.type,
            confirmBeforeExec: m.confirmBeforeExec ?? false,
            sortOrder: i
          })
          .run()
      })
    }
  )

  // Per-connection expect-rules CRUD. The engine loads rules read-only inside
  // `expect:create`; the editor needs list + persist. saveRules replaces the
  // connection's whole rule set (delete-all + re-insert), mirroring
  // execCommands:save.
  ipcMain.handle('expect:listRules', (_event, connectionId: string) => {
    const db = getDatabase()
    return db
      .select()
      .from(schema.expectRules)
      .where(eq(schema.expectRules.connectionId, connectionId))
      .all()
      .sort((a, b) => a.sortOrder - b.sortOrder)
  })

  ipcMain.handle(
    'expect:saveRules',
    (
      _event,
      connectionId: string,
      rules: Array<{
        pattern: string
        sendText: string
        sendReturn?: boolean
        hideFromLog?: boolean
        timeoutMs?: number
        sortOrder?: number
        onMatchRuleId?: string | null
        onFailRuleId?: string | null
      }>
    ) => {
      const db = getDatabase()
      db.delete(schema.expectRules).where(eq(schema.expectRules.connectionId, connectionId)).run()
      rules.forEach((r, i) => {
        db.insert(schema.expectRules)
          .values({
            id: randomUUID(),
            connectionId,
            sortOrder: r.sortOrder ?? i,
            pattern: r.pattern,
            sendText: r.sendText,
            sendReturn: r.sendReturn ?? true,
            hideFromLog: r.hideFromLog ?? false,
            timeoutMs: r.timeoutMs ?? 10000,
            onMatchRuleId: r.onMatchRuleId ?? null,
            onFailRuleId: r.onFailRuleId ?? null
          })
          .run()
      })
    }
  )
}
