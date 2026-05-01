import fs from 'node:fs'
import path from 'node:path'

const webRoot = path.resolve(import.meta.dirname, '..')
const configPath = path.join(webRoot, 'config', 'shopifyScopes.json')
const tomlPath = path.join(webRoot, 'shopify.app.toml')

const scopeConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const expectedScopes = scopeConfig.requiredScopes.join(',')
const toml = fs.readFileSync(tomlPath, 'utf8')

const scopeMatch = toml.match(/^\s*scopes\s*=\s*"([^"]*)"/m)
if (!scopeMatch) {
  console.error('Missing [access_scopes].scopes in shopify.app.toml')
  process.exit(1)
}

const actualScopes = scopeMatch[1]
if (actualScopes !== expectedScopes) {
  console.error('Shopify scope mismatch detected.')
  console.error(`Expected: ${expectedScopes}`)
  console.error(`Actual:   ${actualScopes}`)
  process.exit(1)
}

const legacyMatch = toml.match(/^\s*use_legacy_install_flow\s*=\s*(true|false)/m)
if (!legacyMatch || legacyMatch[1] !== 'true') {
  console.error('shopify.app.toml must keep use_legacy_install_flow = true while OAuth is handled by /api/shopify/install.')
  process.exit(1)
}

console.log('Shopify scope configuration is aligned.')
