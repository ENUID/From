# Shopify App Scope Expansion Update

## Partner Dashboard / App Review Note
Fluid Orbit is an AI shopping platform that connects independent brands and stores to intent-based product discovery, catalog sync, merchant workspace tools, and assisted commerce flows.

Today, the app already supports:
- catalog sync from Shopify
- inventory-aware buyer discovery
- storefront handoff from product results
- merchant workspace management for catalog quality and store settings

The requested scope expansion supports the next committed merchant capabilities already planned in the workspace:
- order dashboard and order state sync
- assisted checkout orchestration
- customer-linked service context
- fulfillment and shipping visibility
- returns operations
- analytics-aware merchandising and reporting
- discount and price-rule aware recommendations

We are requesting the following scopes to power those capabilities:

### Catalog intelligence
- `read_products`
- `read_inventory`
- `read_locations`
- `read_metafields`
- `read_product_listings`
- `read_collections`

These scopes are used to sync structured catalog data, product availability, location-aware inventory, enriched merchandising metadata, and collection context so buyer search results and merchant catalog views stay accurate.

### Commerce operations
- `read_checkouts`
- `write_checkouts`
- `read_orders`
- `read_all_orders`
- `write_orders`

These scopes are used for assisted checkout creation, historical order visibility, order outcome sync beyond the default recent-order window, and merchant-side commerce orchestration tied to Fluid Orbit buyer sessions and handoff flows.

### Customer and post-purchase
- `read_customers`
- `read_fulfillments`
- `read_shipping`
- `read_returns`
- `write_returns`

These scopes are used to support customer-linked order context, fulfillment and shipping visibility, and return visibility plus handling inside the merchant workspace.

### Merchant optimization
- `read_analytics`
- `read_discounts`
- `read_price_rules`

These scopes are used for performance dashboards, campaign-aware merchandising, discount-aware recommendations, and price-rule-aware buyer guidance.

We request only the scopes needed to support catalog sync, merchant operations, and the near-term commerce surfaces already planned in product.

## Scope Matrix
| Scope | Product use case | Merchant-facing surface | Data touchpoint |
| --- | --- | --- | --- |
| `read_products` | Core catalog sync | Merchant catalog, buyer discovery | Product title, handle, vendor, description |
| `read_inventory` | Stock-aware availability | Catalog readiness, low stock views | Variant inventory counts |
| `read_locations` | Location-aware inventory context | Merchant inventory insights | Store inventory locations |
| `read_metafields` | Enriched product attributes | Buyer matching, catalog quality | Product/store metafields |
| `read_product_listings` | Published storefront visibility | Storefront handoff and listing validation | Online listing availability |
| `read_collections` | Collection-aware discovery | Catalog segmentation, merchandising | Manual and smart collections |
| `read_orders` | Order visibility and sync | Merchant order dashboard | Order status and lifecycle |
| `read_all_orders` | Historical order visibility beyond Shopify's default recent-order window | Merchant order dashboard, reporting | Full order history sync and analysis |
| `write_orders` | Assisted commerce actions | Order workspace actions | Order operations initiated by app workflows |
| `read_checkouts` | Checkout state awareness | Checkout orchestration | Checkout state and recovery |
| `write_checkouts` | Create/update assisted checkout | Buyer handoff, merchant conversion flows | Checkout creation and line items |
| `read_customers` | Customer-linked support context | Merchant support and order context | Customer/order association |
| `read_fulfillments` | Fulfillment monitoring | Merchant order dashboard | Fulfillment status |
| `read_shipping` | Shipping visibility | Post-purchase tracking views | Shipping lines and delivery data |
| `read_returns` | Return visibility and status tracking | Merchant returns workspace | Existing return records and status |
| `write_returns` | Return operations | Merchant returns workspace | Return initiation and updates |
| `read_analytics` | Store performance reporting | Merchant analytics surfaces | Analytics and performance data |
| `read_discounts` | Discount-aware recommendations | Merchant optimization, buyer guidance | Discount definitions |
| `read_price_rules` | Promotion-aware pricing logic | Campaign and pricing views | Price rules and promotion logic |

## Technical Update
- Canonical scope list lives in `web/config/shopifyScopes.json`.
- Runtime OAuth install flow uses the shared scope string from `web/lib/shopifyScopes.ts`.
- `web/shopify.app.toml` now declares the same scope set in `[access_scopes]`.
- `use_legacy_install_flow = true` is kept because the app still uses `/api/shopify/install` and `/api/shopify/callback` rather than Shopify-managed installation.
- `npm run verify:shopify-scopes` checks that runtime config and TOML do not drift.

## Follow-up Implementation Tickets
- Add order sync storage and merchant order dashboard data model.
- Add customer-to-order context for merchant workspace support surfaces.
- Add checkout creation flow wired to `write_checkouts`.
- Add returns read/write flow wired to `read_returns` and `write_returns`.
- Add analytics ingestion and dashboard widgets.
- Add discount and price-rule ingestion for recommendation and campaign logic.

## Deployment Reminder
After merging, deploy the Shopify app configuration so the new access scopes are applied to the app version in Shopify:

```bash
shopify app deploy
```

Then reconnect or reinstall on a test store and confirm the requested permissions screen matches the scope set above.
