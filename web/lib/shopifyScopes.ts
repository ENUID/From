import scopeConfig from '@/config/shopifyScopes.json'

export const SHOPIFY_REQUIRED_SCOPES = [...scopeConfig.requiredScopes]

export const SHOPIFY_REQUIRED_SCOPE_STRING = SHOPIFY_REQUIRED_SCOPES.join(',')
