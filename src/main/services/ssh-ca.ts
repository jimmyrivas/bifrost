import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import { join, dirname, basename } from 'path'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

export interface SignedCertificateResult {
  certificatePath: string
  serial: string
  validUntil: string
}

export interface VaultSignOptions {
  pubKeyPath: string
  vaultAddr: string
  vaultToken: string
  role: string
  validPrincipals?: string[]
  ttl?: string
}

export interface LocalCaSignOptions {
  pubKeyPath: string
  caKeyPath: string
  identity: string
  principals?: string[]
  validityInterval?: string
  serialNumber?: number
}

/**
 * Sign an SSH public key using HashiCorp Vault's SSH secrets engine.
 * Calls POST /v1/ssh/sign/{role} with the public key content.
 */
export async function signPublicKeyWithVault(
  options: VaultSignOptions
): Promise<SignedCertificateResult> {
  const { pubKeyPath, vaultAddr, vaultToken, role, validPrincipals, ttl } = options

  if (!existsSync(pubKeyPath)) {
    throw new Error(`Public key not found: ${pubKeyPath}`)
  }

  const { readFileSync } = await import('fs')
  const pubKeyContent = readFileSync(pubKeyPath, 'utf-8').trim()

  const payload: Record<string, unknown> = {
    public_key: pubKeyContent
  }

  if (validPrincipals && validPrincipals.length > 0) {
    payload.valid_principals = validPrincipals.join(',')
  }

  if (ttl) {
    payload.ttl = ttl
  }

  const url = `${vaultAddr.replace(/\/$/, '')}/v1/ssh/sign/${role}`

  // Use curl for the HTTP request to avoid external dependencies
  const { stdout } = await execFileAsync('curl', [
    '-s',
    '-X', 'POST',
    '-H', `X-Vault-Token: ${vaultToken}`,
    '-H', 'Content-Type: application/json',
    '-d', JSON.stringify(payload),
    url
  ], { timeout: 30000 })

  const response = JSON.parse(stdout) as {
    data?: {
      signed_key?: string
      serial_number?: string
    }
    errors?: string[]
  }

  if (response.errors && response.errors.length > 0) {
    throw new Error(`Vault signing failed: ${response.errors.join(', ')}`)
  }

  if (!response.data?.signed_key) {
    throw new Error('Vault returned no signed key')
  }

  // Write the signed certificate next to the public key
  const certPath = pubKeyPath.replace(/\.pub$/, '-cert.pub')
  const { writeFileSync } = await import('fs')
  writeFileSync(certPath, response.data.signed_key, 'utf-8')

  return {
    certificatePath: certPath,
    serial: response.data.serial_number ?? 'unknown',
    validUntil: ttl ?? '24h'
  }
}

/**
 * Sign an SSH public key using a local CA key via ssh-keygen.
 * Equivalent to: ssh-keygen -s ca_key -I identity [-n principals] [-V interval] user_key.pub
 */
export async function signPublicKeyWithLocalCa(
  options: LocalCaSignOptions
): Promise<SignedCertificateResult> {
  const { pubKeyPath, caKeyPath, identity, principals, validityInterval, serialNumber } = options

  if (!existsSync(pubKeyPath)) {
    throw new Error(`Public key not found: ${pubKeyPath}`)
  }
  if (!existsSync(caKeyPath)) {
    throw new Error(`CA key not found: ${caKeyPath}`)
  }

  const args: string[] = [
    '-s', caKeyPath,
    '-I', identity
  ]

  if (principals && principals.length > 0) {
    args.push('-n', principals.join(','))
  }

  if (validityInterval) {
    args.push('-V', validityInterval)
  }

  if (serialNumber !== undefined) {
    args.push('-z', String(serialNumber))
  }

  args.push(pubKeyPath)

  await execFileAsync('ssh-keygen', args, { timeout: 15000 })

  const certPath = pubKeyPath.replace(/\.pub$/, '-cert.pub')

  if (!existsSync(certPath)) {
    throw new Error('ssh-keygen did not produce a certificate file')
  }

  return {
    certificatePath: certPath,
    serial: serialNumber !== undefined ? String(serialNumber) : 'auto',
    validUntil: validityInterval ?? 'default'
  }
}

/**
 * Check if ssh-keygen is available for local CA signing.
 */
export async function isSshKeygenAvailable(): Promise<boolean> {
  try {
    await execFileAsync('which', ['ssh-keygen'])
    return true
  } catch {
    return false
  }
}

/**
 * Check if Vault CLI is available.
 */
export async function isVaultCliAvailable(): Promise<boolean> {
  try {
    await execFileAsync('which', ['vault'])
    return true
  } catch {
    return false
  }
}
