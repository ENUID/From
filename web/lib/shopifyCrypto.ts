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

  const [, ivRaw, tagRaw, encryptedRaw] = value.split(':')
  if (!ivRaw || !tagRaw || !encryptedRaw) {
    throw new Error('Invalid encrypted Shopify token format')
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getEncryptionKey(),
    Buffer.from(ivRaw, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
