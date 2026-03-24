import { ipcMain } from 'electron'
import { getDatabase, schema } from '../db'
import { eq, desc, like, or } from 'drizzle-orm'

export interface SessionNoteData {
  content: string
  connectionId?: string
  connectionName?: string
  host?: string
  user?: string
  tag?: string
  tabTitle?: string
}

export function registerNotesIpc(): void {
  ipcMain.handle('notes:list', (_event, tag?: string) => {
    const db = getDatabase()
    if (tag) {
      return db.select().from(schema.sessionNotes)
        .where(eq(schema.sessionNotes.tag, tag))
        .orderBy(desc(schema.sessionNotes.createdAt))
        .all()
    }
    return db.select().from(schema.sessionNotes)
      .orderBy(desc(schema.sessionNotes.createdAt))
      .all()
  })

  ipcMain.handle('notes:search', (_event, query: string) => {
    const db = getDatabase()
    const pattern = `%${query}%`
    return db.select().from(schema.sessionNotes)
      .where(or(
        like(schema.sessionNotes.content, pattern),
        like(schema.sessionNotes.connectionName, pattern),
        like(schema.sessionNotes.host, pattern),
        like(schema.sessionNotes.tabTitle, pattern)
      ))
      .orderBy(desc(schema.sessionNotes.createdAt))
      .all()
  })

  ipcMain.handle('notes:create', (_event, data: SessionNoteData) => {
    const db = getDatabase()
    const id = `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const now = new Date().toISOString()
    db.insert(schema.sessionNotes).values({
      id,
      content: data.content,
      connectionId: data.connectionId ?? null,
      connectionName: data.connectionName ?? '',
      host: data.host ?? '',
      user: data.user ?? '',
      tag: data.tag ?? 'note',
      tabTitle: data.tabTitle ?? '',
      createdAt: now
    }).run()
    return id
  })

  ipcMain.handle('notes:delete', (_event, id: string) => {
    const db = getDatabase()
    db.delete(schema.sessionNotes).where(eq(schema.sessionNotes.id, id)).run()
  })

  ipcMain.handle('notes:deleteAll', () => {
    const db = getDatabase()
    db.delete(schema.sessionNotes).run()
  })
}
