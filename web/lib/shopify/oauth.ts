/**
 * Shopify OAuth — the brand-connect handshake.
 *
 * Flow: brand enters their shop domain → we redirect to Shopify's authorize
 * screen → brand approves → Shopify calls our callback with a code + HMAC →
 * we verify the HMAC, exchange the code for a permanent admin token, and store
 * it. From then on FROM can read that brand's catalog authoritatively.
 *
 * Requires a Shopify Partner app:
 *   SHOPIFY_API_KEY      — app client id
 *   SHOPIFY_API_SECRET   — app client secret (used for HMAC + token exchange)
 *   SHOPIFY_APP_URL      — public base url, e.g. https://from.app (no trailing /)
 */

import crypto from 'crypto'

// Read-only catalog access is all we need to ingest products.
export const SHOPIFY_SCOPES = 'read_products'
const API_VERSION = '2024-10'

export function shopifyConfigured(): boolean {
  return Boolean(process.env.SHOPIFY_API_KEY && process.env.SHOPIFY_API_SECRET)
}

function appUrl(): string {
  return (process.env.SHOPIFY_APP_URL || '').replace(/\/+$/, '')
}

/** Normalise + validate a shop domain. Accepts "acme", "acme.myshopify.com",
 *  or a pasted URL; returns the canonical "acme.myshopify.com" or null. */
export function normalizeShopDomain(input: string): string | null {
  if (!input) return null
  let s = input.trim().toLowerCase()
  s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '')   // strip scheme + path
  if (!s.includes('.')) s = `${s}.myshopify.com`
  // Only allow *.myshopify.com to keep the OAuth target trustworthy.
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(s)) return null
  return s
}

/** Build the Shopify install/authorize URL to redirect the brand to. */
export function buildInstallUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SHOPIFY_API_KEY!,
    scope: SHOPIFY_SCOPES,
    redirect_uri: `${appUrl()}/api/brands/connect/callback`,
    state,
    'grant_options[]': '',
  })
  return `https://${shop}/admin/oauth/authorize?${params}`
}

/** Verify the HMAC Shopify appends to the OAuth callback query. Timing-safe. */
export function verifyOAuthHmac(query: Record<string, string>): boolean {
  const secret = process.env.SHOPIFY_API_SECRET
  if (!secret) return false
  const { hmac, signature, ...rest } = query
  if (!hmac) return false

  const message = Object.keys(rest)
    .sort()
    .map(k => `${k}=${rest[k]}`)
    .join('&')

  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, 'utf8'), Buffer.from(hmac, 'utf8'))
  } catch {
    return false
  }
}

/** Verify a Shopify webhook body signature (base64 HMAC header). */
export function verifyWebhookHmac(rawBody: string, hmacHeader: string | null): boolean {
  const secret = process.env.SHOPIFY_API_SECRET
  if (!secret || !hmacHeader) return false
  const digest = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  try {
    return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader))
  } catch {
    return false
  }
}

/** Exchange the temporary OAuth code for a permanent admin access token. */
export async function exchangeCodeForToken(
  shop: string,
  code: string,
): Promise<{ access_token: string; scope: string }> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  })
  if (!res.ok) {
    throw new Error(`Shopify token exchange failed: ${res.status} ${await res.text()}`)
  }
  return res.json() as Promise<{ access_token: string; scope: string }>
}

export const SHOPIFY_API_VERSION = API_VERSION
