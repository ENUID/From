import crypto from 'crypto'

const TOKEN_PREFIX = 'enc:v1'

function getEncryptionKey() {
  const secret = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error('Set SHOPIFY_TOKEN_ENCRYPTION_KEY or NEXTAUTH_SECRET to encrypt Shopify tokens')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function isEncryptedShopifySecret(value?: string | null) {
  return typeof value === 'string' && value.startsWith(`${TOKEN_PREFIX}:`)
}

export function encryptShopifySecret(value?: string | null) {
  if (!value) return undefined
  if (isEncryptedShopifySecret(value)) return value

  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    TOKEN_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

export function decryptShopifySecret(value?: string | null) {
  if (!value) return undefined
  if (!isEncryptedShopifySecret(value)) return value

  const [, partA, partB, partC] = value.split(':')
  if (!partA || !partB || !partC) {
    throw new Error('Invalid encrypted Shopify token format')
  }

  const decodeFlexible = (raw: string) => {
    try {
      return Buffer.from(raw, 'base64url')
    } catch {
      return Buffer.from(raw, 'base64')
    }
  }

  const tryDecrypt = (ivRaw: string, tagRaw: string, encryptedRaw: string) => {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getEncryptionKey(),
      decodeFlexible(ivRaw)
    )
    decipher.setAuthTag(decodeFlexible(tagRaw))

    return Buffer.concat([
      decipher.update(decodeFlexible(encryptedRaw)),
      decipher.final(),
    ]).toString('utf8')
  }

  try {
    // Current format: enc:v1:iv:tag:ciphertext
    return tryDecrypt(partA, partB, partC)
  } catch (err: any) {
    try {
      // Legacy format fallback: enc:v1:iv:ciphertext:tag
      return tryDecrypt(partA, partC, partB)
    } catch {
      const secretName = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY ? 'SHOPIFY_TOKEN_ENCRYPTION_KEY' : 'NEXTAUTH_SECRET'
      throw new Error(`Decryption failed (Secret: ${secretName}). The token may have been encrypted with a different secret. Original error: ${err?.message}`)
    }
  }
}
