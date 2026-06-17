/**
 * Brand session — a signed cookie identifying a connected brand by its store
 * domain. The Shopify OAuth handshake *is* the login: once a brand connects,
 * we issue this cookie. HMAC-signed with NEXTAUTH_SECRET so it can't be forged.
 */

import crypto from 'crypto'
import { cookies } from 'next/headers'

const COOKIE = 'from_brand'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

function secret(): string {
  return process.env.NEXTAUTH_SECRET || 'from-brand-dev-secret'
}

export function signBrandToken(storeDomain: string): string {
  const payload = `${storeDomain}.${Date.now()}`
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

export function verifyBrandToken(token: string | undefined): string | null {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  let payload: string
  try { payload = Buffer.from(body, 'base64url').toString('utf8') } catch { return null }
  const expected = crypto.createHmac('sha256', secret()).update(payload).digest('base64url')
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch { return null }
  const domain = payload.split('.')[0]
  return domain || null
}

/** Read the connected store domain from the request cookies (server side). */
export async function getBrandSession(): Promise<string | null> {
  const store = await cookies()
  return verifyBrandToken(store.get(COOKIE)?.value)
}

export const BRAND_COOKIE = COOKIE
export const BRAND_COOKIE_MAX_AGE = MAX_AGE
