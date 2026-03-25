import { execFileSync } from 'child_process'
import { commandExists } from './platform'

export interface PasswordManagerEntry {
  id: string
  title: string
  username?: string
  category?: string
  vault?: string
}

// === 1Password CLI (op) ===

export const onePassword = {
  isAvailable(): boolean {
    return commandExists('op')
  },

  isSignedIn(): boolean {
    try {
      execFileSync('op', ['whoami'], { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' })
      return true
    } catch {
      return false
    }
  },

  listSSHKeys(): PasswordManagerEntry[] {
    try {
      const json = execFileSync('op', ['item', 'list', '--categories', 'SSH Key', '--format=json'], {
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
      const json = execFileSync('op', ['item', 'list', '--categories', 'Login', '--format=json'], {
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
      return execFileSync('op', ['item', 'get', itemId, '--fields', 'password', '--reveal'], {
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
      return execFileSync('op', ['item', 'get', itemId, '--fields', field, '--reveal'], {
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
      return execFileSync('op', ['read', reference], {
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
      const status = execFileSync('bw', ['status'], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: 'pipe'
      })
      return status.includes('"status":"unlocked"')
    } catch {
      return false
    }
  },

  listItems(search?: string): PasswordManagerEntry[] {
    try {
      const args = ['list', 'items']
      if (search) args.push('--search', search)
      const json = execFileSync('bw', args, {
        encoding: 'utf-8',
        timeout: 15000,
        stdio: 'pipe'
      })
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
      const json = execFileSync('bw', ['get', 'item', itemId], {
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
      const json = execFileSync('bw', ['get', 'item', itemId], {
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

// === HashiCorp Vault SSH Engine (#78) ===

export const vault = {
  isAvailable(): boolean {
    return commandExists('vault')
  },

  signSSHKey(pubKeyPath: string, role: string, addr: string, token: string): string {
    try {
      const { readFileSync: readFs } = require('fs') as typeof import('fs')
      const pubKey = readFs(pubKeyPath, 'utf-8').trim()

      const payload = JSON.stringify({ public_key: pubKey })

      const result = execFileSync(
        'curl',
        ['-s', '-X', 'POST', '-H', `X-Vault-Token: ${token}`, '-H', 'Content-Type: application/json', '-d', payload, `${addr}/v1/ssh/sign/${role}`],
        { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }
      )

      const response = JSON.parse(result) as { data?: { signed_key?: string }; errors?: string[] }
      if (response.errors && response.errors.length > 0) {
        throw new Error(response.errors.join(', '))
      }
      return response.data?.signed_key ?? ''
    } catch (err) {
      throw new Error(`Vault SSH sign failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },

  listRoles(addr: string, token: string): string[] {
    try {
      const result = execFileSync(
        'curl',
        ['-s', '-H', `X-Vault-Token: ${token}`, `${addr}/v1/ssh/roles?list=true`],
        { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' }
      )
      const response = JSON.parse(result) as { data?: { keys?: string[] } }
      return response.data?.keys ?? []
    } catch {
      return []
    }
  },

  getSecret(path: string, addr: string, token: string): string {
    try {
      const result = execFileSync(
        'curl',
        ['-s', '-H', `X-Vault-Token: ${token}`, `${addr}/v1/${path}`],
        { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' }
      )
      const response = JSON.parse(result) as { data?: { data?: Record<string, string>; value?: string } }
      return response.data?.value ?? JSON.stringify(response.data?.data ?? {})
    } catch {
      return ''
    }
  }
}

// === AWS Secrets Manager (#79) ===

export const awsSM = {
  isAvailable(): boolean {
    return commandExists('aws')
  },

  getSecret(secretId: string): string {
    try {
      return execFileSync(
        'aws',
        ['secretsmanager', 'get-secret-value', '--secret-id', secretId, '--query', 'SecretString', '--output', 'text'],
        { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }
      ).trim()
    } catch (err) {
      throw new Error(`AWS Secrets Manager get failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },

  listSecrets(): Array<{ name: string; arn: string; description: string }> {
    try {
      const result = execFileSync(
        'aws',
        ['secretsmanager', 'list-secrets', '--output', 'json'],
        { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }
      )
      const data = JSON.parse(result) as {
        SecretList?: Array<{ Name?: string; ARN?: string; Description?: string }>
      }
      return (data.SecretList ?? []).map((s) => ({
        name: s.Name ?? '',
        arn: s.ARN ?? '',
        description: s.Description ?? ''
      }))
    } catch {
      return []
    }
  }
}

// === Azure Key Vault (#80) ===

export const azureKV = {
  isAvailable(): boolean {
    return commandExists('az')
  },

  getSecret(vaultName: string, secretName: string): string {
    try {
      return execFileSync(
        'az',
        ['keyvault', 'secret', 'show', '--vault-name', vaultName, '--name', secretName, '--query', 'value', '-o', 'tsv'],
        { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }
      ).trim()
    } catch (err) {
      throw new Error(`Azure KV get failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  },

  listSecrets(vaultName: string): Array<{ name: string; id: string; enabled: boolean }> {
    try {
      const result = execFileSync(
        'az',
        ['keyvault', 'secret', 'list', '--vault-name', vaultName, '-o', 'json'],
        { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }
      )
      const data = JSON.parse(result) as Array<{
        name?: string
        id?: string
        attributes?: { enabled?: boolean }
      }>
      return data.map((s) => ({
        name: s.name ?? s.id?.split('/').pop() ?? '',
        id: s.id ?? '',
        enabled: s.attributes?.enabled ?? true
      }))
    } catch {
      return []
    }
  }
}

// === Detect Available Password Managers ===

export interface PasswordManagerStatus {
  onePassword: { available: boolean; signedIn: boolean }
  bitwarden: { available: boolean; unlocked: boolean }
  keepassxc: { available: boolean }
  vault: { available: boolean }
  awsSM: { available: boolean }
  azureKV: { available: boolean }
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
    },
    vault: {
      available: vault.isAvailable()
    },
    awsSM: {
      available: awsSM.isAvailable()
    },
    azureKV: {
      available: azureKV.isAvailable()
    }
  }
}
