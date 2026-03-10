# Runbook: checkout and payment incidents

## Incident: checkout cannot complete order

### Symptoms
- User cannot submit checkout.
- Error toast about payment/shipping appears.

### Diagnostics
1. Run `npm run check:checkout-empty-guard`.
2. Run `npm run check:payment-session-smoke`.
3. Run `npm run check:shipping-options-fallback`.
4. Inspect cart debug entries via browser console:
   - `localStorage.getItem('imidge_cart_debug_log')`

### Recovery
1. Verify backend health `http://127.0.0.1:9000/health`.
2. Verify cart has items and valid region pricing.
3. Recreate cart by clearing stale id:
   - remove `imidge_cart_id` in localStorage.
4. Retry checkout.

## Incident: region/currency mismatch in cart

### Symptoms
- Add-to-cart fails for selected product in current region.
- Warning about region migration appears.

### Diagnostics
1. Run `npm run check:region-price-guard`.
2. Inspect product variant price currencies in Medusa store API.
3. Check cart migration entries in `imidge_cart_debug_log`.

### Recovery
1. Allow automatic fallback/migration flow.
2. If product has no compatible region currency, keep PDP add disabled and show reason.
3. Fix source catalog pricing to include active region currency.

## Incident: no shipping options

### Symptoms
- Checkout reports unavailable shipping method.

### Diagnostics
1. Run `npm run check:shipping-options-fallback`.
2. Check cart region and item compatibility.
3. Validate shipping options API for cart id:
   - `/store/shipping-options?cart_id=<id>`

### Recovery
1. Trigger cart migration to a compatible region.
2. Reattempt checkout.
3. If still unavailable, escalate to catalog/region configuration owners.
