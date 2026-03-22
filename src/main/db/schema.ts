import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core'

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  parentId: text('parent_id').references((): ReturnType<typeof text> => groups.id),
  sortOrder: integer('sort_order').default(0),
  icon: text('icon'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
})

export const connectionTemplates = sqliteTable('connection_templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  config: text('config').notNull() // JSON
})

export const connections = sqliteTable('connections', {
  id: text('id').primaryKey(),
  groupId: text('group_id').references(() => groups.id),
  name: text('name').notNull(),
  method: text('method', { enum: ['ssh', 'rdp', 'vnc', 'telnet', 'local', 'ftp'] }).notNull(),
  host: text('host'),
  port: integer('port'),
  authType: text('auth_type', { enum: ['userpass', 'key', 'key_pass', 'manual'] }),
  username: text('username'),
  encryptedPassword: blob('encrypted_password', { mode: 'buffer' }),
  privateKeyPath: text('private_key_path'),
  encryptedPassphrase: blob('encrypted_passphrase', { mode: 'buffer' }),

  // Options
  launchOnStartup: integer('launch_on_startup', { mode: 'boolean' }).default(false),
  reconnectOnDisconnect: integer('reconnect_on_disconnect', { mode: 'boolean' }).default(false),
  runWithSudo: integer('run_with_sudo', { mode: 'boolean' }).default(false),
  useAutossh: integer('use_autossh', { mode: 'boolean' }).default(false),
  tabTitle: text('tab_title'),
  autoSaveLog: integer('auto_save_log', { mode: 'boolean' }).default(false),
  logPattern: text('log_pattern'),

  // Keep-alive
  sendString: text('send_string'),
  sendIntervalSeconds: integer('send_interval_seconds'),
  sendIdleOnly: integer('send_idle_only', { mode: 'boolean' }).default(false),

  // Networking override
  networkMode: text('network_mode', { enum: ['global', 'direct', 'socks', 'jump'] }).default('global'),
  proxyConfig: text('proxy_config'), // JSON
  jumpServerConfig: text('jump_server_config'), // JSON

  // Terminal override
  terminalOverride: integer('terminal_override', { mode: 'boolean' }).default(false),
  terminalConfig: text('terminal_config'), // JSON

  // SSH specific
  sshConfig: text('ssh_config'), // JSON

  sortOrder: integer('sort_order').default(0),
  templateId: text('template_id').references(() => connectionTemplates.id),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP')
})

export const expectRules = sqliteTable('expect_rules', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').references(() => connections.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull(),
  pattern: text('pattern').notNull(),
  sendText: text('send_text').notNull(),
  sendReturn: integer('send_return', { mode: 'boolean' }).default(true),
  hideFromLog: integer('hide_from_log', { mode: 'boolean' }).default(false),
  timeoutMs: integer('timeout_ms').default(10000),
  onMatchRuleId: text('on_match_rule_id'),
  onFailRuleId: text('on_fail_rule_id')
})

export const macros = sqliteTable('macros', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id').references(() => connections.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  command: text('command').notNull(),
  type: text('type', { enum: ['remote', 'local'] }).notNull(),
  sortOrder: integer('sort_order').default(0),
  confirmBeforeExec: integer('confirm_before_exec', { mode: 'boolean' }).default(false)
})

export const execCommands = sqliteTable('exec_commands', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  phase: text('phase', { enum: ['pre', 'post'] }).notNull(),
  command: text('command').notNull(),
  ask: integer('ask', { mode: 'boolean' }).default(false),
  isDefault: integer('is_default', { mode: 'boolean' }).default(true),
  sortOrder: integer('sort_order').notNull()
})

export const globalVariables = sqliteTable('global_variables', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  value: text('value').notNull(),
  isPassword: integer('is_password', { mode: 'boolean' }).default(false)
})

export const connectionVariables = sqliteTable('connection_variables', {
  id: text('id').primaryKey(),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  value: text('value').notNull(),
  isPassword: integer('is_password', { mode: 'boolean' }).default(false)
})

export const clusters = sqliteTable('clusters', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP')
})

export const clusterMembers = sqliteTable('cluster_members', {
  clusterId: text('cluster_id')
    .notNull()
    .references(() => clusters.id, { onDelete: 'cascade' }),
  connectionId: text('connection_id')
    .notNull()
    .references(() => connections.id, { onDelete: 'cascade' })
})

export const preferences = sqliteTable('preferences', {
  key: text('key').primaryKey(),
  value: text('value').notNull()
})

export const globalExpectPatterns = sqliteTable('global_expect_patterns', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  pattern: text('pattern').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).default(true)
})
