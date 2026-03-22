import { execSync, exec } from 'child_process'

export interface PasswordManagerEntry {
  id: string
  title: string
  username?: string
  category?: string
  vault?: string
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { encoding: 'utf-8', timeout: 3000, stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

// === 1Password CLI (op) ===

export const onePassword = {
  isAvailable(): boolean {
    return commandExists('op')
  },

  isSignedIn(): boolean {
    try {
      execSync('op whoami', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  },

  listSSHKeys(): PasswordManagerEntry[] {
    try {
      const json = execSync('op item list --categories "SSH Key" --format=json', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: 'pipe'
      })
      const items = JSON.parse(json) as Array<{ id: string; title: string; vault: { name: string } }>
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        category: 'SSH Key',
        vault: item.vault?.name
      }))
    } catch {
      return []
    }
  },

  listLogins(): PasswordManagerEntry[] {
    try {
      const json = execSync('op item list --categories "Login" --format=json', {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: 'pipe'
      })
      const items = JSON.parse(json) as Array<{ id: string; title: string; vault: { name: string } }>
      return items.map((item) => ({
        id: item.id,
        title: item.title,
        category: 'Login',
        vault: item.vault?.name
      }))
    } catch {
      return []
    }
  },

  getPassword(itemId: string): string {
    try {
      return execSync(`op item get "${itemId}" --fields password --reveal`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: 'pipe'
      }).trim()
    } catch {
      return ''
    }
  },

  getField(itemId: string, field: string): string {
    try {
      return execSync(`op item get "${itemId}" --fields "${field}" --reveal`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: 'pipe'
      }).trim()
    } catch {
      return ''
    }
  },

  readSecret(reference: string): string {
    try {
      return execSync(`op read "${reference}"`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: 'pipe'
      }).trim()
    } catch {
      return ''
    }
  }
}

// === Bitwarden CLI (bw) ===

export const bitwarden = {
  isAvailable(): boolean {
    return commandExists('bw')
  },

  isUnlocked(): boolean {
    try {
      const status = execSync('bw status', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' })
      return status.includes('"status":"unlocked"')
    } catch {
      return false
    }
  },

  listItems(search?: string): PasswordManagerEntry[] {
    try {
      const cmd = search ? `bw list items --search "${search}"` : 'bw list items'
      const json = execSync(cmd, { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' })
      const items = JSON.parse(json) as Array<{
        id: string
        name: string
        login?: { username?: string }
        type: number
      }>
      return items
        .filter((item) => item.type === 1) // Login items
        .map((item) => ({
          id: item.id,
          title: item.name,
          username: item.login?.username,
          category: 'Login'
        }))
    } catch {
      return []
    }
  },

  getPassword(itemId: string): string {
    try {
      const json = execSync(`bw get item "${itemId}"`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: 'pipe'
      })
      const item = JSON.parse(json) as { login?: { password?: string } }
      return item.login?.password ?? ''
    } catch {
      return ''
    }
  },

  getField(itemId: string, fieldName: string): string {
    try {
      const json = execSync(`bw get item "${itemId}"`, {
        encoding: 'utf-8',
        timeout: 10000,
        stdio: 'pipe'
      })
      const item = JSON.parse(json) as { fields?: Array<{ name: string; value: string }> }
      const field = item.fields?.find((f) => f.name === fieldName)
      return field?.value ?? ''
    } catch {
      return ''
    }
  }
}

// === Detect Available Password Managers ===

export interface PasswordManagerStatus {
  onePassword: { available: boolean; signedIn: boolean }
  bitwarden: { available: boolean; unlocked: boolean }
  keepassxc: { available: boolean }
}

export function detectPasswordManagers(): PasswordManagerStatus {
  return {
    onePassword: {
      available: onePassword.isAvailable(),
      signedIn: onePassword.isAvailable() ? onePassword.isSignedIn() : false
    },
    bitwarden: {
      available: bitwarden.isAvailable(),
      unlocked: bitwarden.isAvailable() ? bitwarden.isUnlocked() : false
    },
    keepassxc: {
      available: commandExists('keepassxc-cli')
    }
  }
}
