import { ipcMain, BrowserWindow } from 'electron'
import { ExpectEngine, type ExpectRule, type ExpectEvent } from '../services/expect-engine'
import { variableEngine, type VariableContext } from '../services/variable-engine'
import { macroExecutor, type MacroDefinition, type ExecCommandDefinition } from '../services/macro-executor'
import { getDatabase, schema } from '../db'
import { eq } from 'drizzle-orm'

const engines = new Map<string, ExpectEngine>()

export function registerExpectIpc(mainWindow: BrowserWindow): void {
  // Create an expect engine for a session
  ipcMain.handle(
    'expect:create',
    (_event, sessionId: string, connectionId: string) => {
      const engine = new ExpectEngine()
      engines.set(sessionId, engine)

      // Load rules from database
      const db = getDatabase()

      // Load global expect patterns
      const globalPatterns = db
        .select()
        .from(schema.globalExpectPatterns)
        .all()
        .filter((p) => p.enabled)

      // Load connection-specific rules
      const connRules = db
        .select()
        .from(schema.expectRules)
        .where(eq(schema.expectRules.connectionId, connectionId))
        .all()
        .sort((a, b) => a.sortOrder - b.sortOrder)

      // Build ExpectRule array: globals first, then connection rules
      const rules: ExpectRule[] = []

      for (const gp of globalPatterns) {
        rules.push({
          id: gp.id,
          pattern: new RegExp(gp.pattern),
          sendText: '', // global patterns just detect, action depends on type
          sendReturn: true,
          hideFromLog: gp.name === 'password_prompt',
          timeout: 10000,
          onMatch: null,
          onFail: null
        })
      }

      for (const cr of connRules) {
        rules.push({
          id: cr.id,
          pattern: new RegExp(cr.pattern),
          sendText: cr.sendText,
          sendReturn: cr.sendReturn ?? true,
          hideFromLog: cr.hideFromLog ?? false,
          timeout: cr.timeoutMs ?? 10000,
          onMatch: cr.onMatchRuleId,
          onFail: cr.onFailRuleId
        })
      }

      engine.setRules(rules)

      // Forward expect events to renderer
      engine.on('expect-event', (event: ExpectEvent) => {
        if (!mainWindow.isDestroyed()) {
          mainWindow.webContents.send('expect:event', sessionId, event)
        }
      })

      return rules.length
    }
  )

  ipcMain.handle('expect:start', (_event, sessionId: string) => {
    engines.get(sessionId)?.start()
  })

  ipcMain.handle('expect:stop', (_event, sessionId: string) => {
    engines.get(sessionId)?.stop()
  })

  ipcMain.on('expect:feed', (_event, sessionId: string, data: string) => {
    engines.get(sessionId)?.feed(data)
  })

  ipcMain.handle('expect:setDebug', (_event, sessionId: string, enabled: boolean) => {
    engines.get(sessionId)?.setDebug(enabled)
  })

  ipcMain.handle('expect:destroy', (_event, sessionId: string) => {
    const engine = engines.get(sessionId)
    if (engine) {
      engine.stop()
      engine.removeAllListeners()
      engines.delete(sessionId)
    }
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

  // List macros
  ipcMain.handle('macros:list', (_event, connectionId?: string) => {
    const db = getDatabase()
    if (connectionId) {
      return db
        .select()
        .from(schema.macros)
        .where(eq(schema.macros.connectionId, connectionId))
        .all()
    }
    // Global macros (connectionId is null)
    return db.select().from(schema.macros).all()
  })
}
