/**
 * Register Shopify webhooks for a connected store so catalog changes flow into
 * FROM in real time — no manual re-sync. Best-effort: a failure here never
 * blocks the connect flow (full sync still runs, manual re-sync still works).
 */

import { SHOPIFY_API_VERSION } from './oauth'

const TOPICS = ['products/create', 'products/update', 'products/delete', 'app/uninstalled']

function appUrl(): string {
  return (process.env.SHOPIFY_APP_URL || '').replace(/\/+$/, '')
}

async function createWebhook(shop: string, token: string, topic: string, address: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${shop}/admin/api/${SHOPIFY_API_VERSION}/webhooks.json`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Shopify-Access-Token': token },
      body: JSON.stringify({ webhook: { topic, address, format: 'json' } }),
    })
    // 422 = already exists for this address/topic — treat as success.
    return res.ok || res.status === 422
  } catch {
    return false
  }
}

export async function registerWebhooks(shop: string, token: string): Promise<number> {
  const address = `${appUrl()}/api/brands/webhook`
  if (!appUrl()) return 0
  let ok = 0
  for (const topic of TOPICS) {
    if (await createWebhook(shop, token, topic, address)) ok++
  }
  return ok
}
