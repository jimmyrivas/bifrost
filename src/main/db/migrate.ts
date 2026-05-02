import { getSqlite } from './index'

/**
 * Run migrations using SQLite user_version pragma.
 * Each migration is a function that receives the raw sqlite instance.
 */

type Migration = (db: import('better-sqlite3').Database) => void

const migrations: Migration[] = [
  // Migration 0: Create all initial tables
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES groups(id),
        sort_order INTEGER DEFAULT 0,
        icon TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS connection_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        config TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        group_id TEXT REFERENCES groups(id),
        name TEXT NOT NULL,
        method TEXT NOT NULL CHECK(method IN ('ssh','rdp','vnc','telnet','local','ftp')),
        host TEXT,
        port INTEGER,
        auth_type TEXT CHECK(auth_type IN ('userpass','key','key_pass','manual')),
        username TEXT,
        encrypted_password BLOB,
        private_key_path TEXT,
        encrypted_passphrase BLOB,
        launch_on_startup BOOLEAN DEFAULT 0,
        reconnect_on_disconnect BOOLEAN DEFAULT 0,
        run_with_sudo BOOLEAN DEFAULT 0,
        use_autossh BOOLEAN DEFAULT 0,
        tab_title TEXT,
        auto_save_log BOOLEAN DEFAULT 0,
        log_pattern TEXT,
        send_string TEXT,
        send_interval_seconds INTEGER,
        send_idle_only BOOLEAN DEFAULT 0,
        network_mode TEXT DEFAULT 'global' CHECK(network_mode IN ('global','direct','socks','jump')),
        proxy_config TEXT,
        jump_server_config TEXT,
        terminal_override BOOLEAN DEFAULT 0,
        terminal_config TEXT,
        ssh_config TEXT,
        sort_order INTEGER DEFAULT 0,
        template_id TEXT REFERENCES connection_templates(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS expect_rules (
        id TEXT PRIMARY KEY,
        connection_id TEXT REFERENCES connections(id) ON DELETE CASCADE,
        sort_order INTEGER NOT NULL,
        pattern TEXT NOT NULL,
        send_text TEXT NOT NULL,
        send_return BOOLEAN DEFAULT 1,
        hide_from_log BOOLEAN DEFAULT 0,
        timeout_ms INTEGER DEFAULT 10000,
        on_match_rule_id TEXT,
        on_fail_rule_id TEXT
      );

      CREATE TABLE IF NOT EXISTS macros (
        id TEXT PRIMARY KEY,
        connection_id TEXT REFERENCES connections(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        command TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('remote','local')),
        sort_order INTEGER DEFAULT 0,
        confirm_before_exec BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS exec_commands (
        id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        phase TEXT NOT NULL CHECK(phase IN ('pre','post')),
        command TEXT NOT NULL,
        ask BOOLEAN DEFAULT 0,
        is_default BOOLEAN DEFAULT 1,
        sort_order INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS global_variables (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        is_password BOOLEAN DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS connection_variables (
        id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        is_password BOOLEAN DEFAULT 0,
        UNIQUE(connection_id, name)
      );

      CREATE TABLE IF NOT EXISTS clusters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS cluster_members (
        cluster_id TEXT NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
        connection_id TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
        PRIMARY KEY (cluster_id, connection_id)
      );

      CREATE TABLE IF NOT EXISTS preferences (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS global_expect_patterns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        pattern TEXT NOT NULL,
        enabled BOOLEAN DEFAULT 1
      );
    `)

    // Seed global expect patterns
    db.exec(`
      INSERT OR IGNORE INTO global_expect_patterns (id, name, pattern, enabled) VALUES
        ('gep-password', 'password_prompt', '(?mi)(pass(word|phrase)|contraseña).*?:\\s*$', 1),
        ('gep-username', 'username_prompt', '([lL]ogin|[uU]suario|([uU]ser-?)*[nN]ame.*|[uU]ser)\\s*:\\s*$', 1),
        ('gep-prompt', 'command_prompt', '[#%$>]|:\\/ \\s*$', 1),
        ('gep-hostkey-changed', 'host_key_changed', '.*ffending .*key in (.+?)\\:(\\d+).*', 1),
        ('gep-hostkey-verify', 'host_key_verification', '^.+ontinue connecting \\(([^/]+)\\/([^/]+)(?:[^)]+)?\\)\\?\\s*$', 1),
        ('gep-anykey', 'press_any_key', '.*(any key to continue|tecla para continuar).*', 1);
    `)
  },

  // Migration 1: Add 'mosh' to connections method (SQLite CHECK workaround)
  // SQLite can't ALTER CHECK constraints, but Drizzle inserts bypass CHECK validation.
  // This migration is a no-op marker to track schema version.
  (db) => {
    // The schema.ts enum now includes 'mosh'. Drizzle ORM handles validation.
    db.exec(`SELECT 1`) // no-op
  },

  // Migration 2: Remote Commands (Asbru-style)
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS remote_commands (
        id TEXT PRIMARY KEY,
        connection_id TEXT REFERENCES connections(id) ON DELETE CASCADE,
        command TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        cmd_group TEXT DEFAULT '',
        confirm INTEGER DEFAULT 0,
        send_intro INTEGER DEFAULT 1,
        keybinding TEXT DEFAULT '',
        sort_order INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
  },

  // Migration 3: Tunnels (independent port forwarding)
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tunnels (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER DEFAULT 22,
        username TEXT,
        auth_type TEXT CHECK(auth_type IN ('userpass','key','key_pass')),
        private_key_path TEXT,
        encrypted_password BLOB,
        encrypted_passphrase BLOB,
        forwards TEXT NOT NULL DEFAULT '[]',
        auto_start BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `)
  },

  // Migration 4: Session Notes
  (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS session_notes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        connection_id TEXT,
        connection_name TEXT DEFAULT '',
        host TEXT DEFAULT '',
        user TEXT DEFAULT '',
        tag TEXT DEFAULT 'note',
        tab_title TEXT DEFAULT '',
        created_at TEXT NOT NULL
      );
    `)
  },

  // Migration 5: Jump host support for tunnels.
  // Uses ALTER TABLE ADD COLUMN — runs exactly once thanks to the
  // user_version gate at the bottom of this file.
  (db) => {
    db.exec(`ALTER TABLE tunnels ADD COLUMN jump_server_config TEXT;`)
  },

  // Migration 6: tunnels can now reference an existing connection.
  // SQLite cannot ALTER COLUMN to drop NOT NULL on `host`, so we recreate
  // the table. Existing rows are dump→restore preserved.
  (db) => {
    db.exec(`
      CREATE TABLE tunnels_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        connection_id TEXT REFERENCES connections(id) ON DELETE SET NULL,
        host TEXT,
        port INTEGER DEFAULT 22,
        username TEXT,
        auth_type TEXT CHECK(auth_type IN ('userpass','key','key_pass')),
        private_key_path TEXT,
        encrypted_password BLOB,
        encrypted_passphrase BLOB,
        forwards TEXT NOT NULL DEFAULT '[]',
        auto_start BOOLEAN DEFAULT 0,
        jump_server_config TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO tunnels_new (
        id, name, connection_id, host, port, username, auth_type,
        private_key_path, encrypted_password, encrypted_passphrase,
        forwards, auto_start, jump_server_config, created_at, updated_at
      )
      SELECT
        id, name, NULL, host, port, username, auth_type,
        private_key_path, encrypted_password, encrypted_passphrase,
        forwards, auto_start, jump_server_config, created_at, updated_at
      FROM tunnels;

      DROP TABLE tunnels;
      ALTER TABLE tunnels_new RENAME TO tunnels;
    `)
  }
]

export function runMigrations(): void {
  const sqlite = getSqlite()
  const currentVersion = (sqlite.pragma('user_version', { simple: true }) as number) || 0

  if (currentVersion >= migrations.length) return

  const migrate = sqlite.transaction(() => {
    for (let i = currentVersion; i < migrations.length; i++) {
      migrations[i](sqlite)
    }
    sqlite.pragma(`user_version = ${migrations.length}`)
  })

  migrate()
}
