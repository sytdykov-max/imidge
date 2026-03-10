# Release Checklist v2

## Mandatory gates

1. `npm run check:preflight`
2. `npm run check:all`
3. `npm run check:release-evidence`
4. `npm run check:artifact-freshness`
5. Verify artifacts:
   - `logs/check-all-latest.log`
   - `logs/check-all-latest.json`
   - `logs/check-all-latest.md`
   - `logs/check-all-latest.junit.xml`
6. Confirm `ok: true` in `logs/check-all-latest.json`.

## Checkout and payment hardening

1. Verify `/checkout` rejects empty cart submit.
2. Verify phone field formatting and validation.
3. Verify order completion redirects to `/checkout/success`.
4. Verify payment session smoke check passes:
   - `npm run check:payment-session-smoke`
5. Verify shipping fallback smoke check passes:
   - `npm run check:shipping-options-fallback`

## SEO and quality

1. Validate canonical and robots:
   - `npm run check:seo-pages`
2. Validate JSON-LD:
   - `npm run check:jsonld`
3. Validate internal links:
   - `npm run check:internal-links`
4. Validate SEO migration policy (blocking):
   - `npm run report:seo-migration-manifest`
   - `npm run check:seo-migration-policy`
   - Confirm `violationsTotal: 0` in `logs/seo-migration-policy-latest.json`.
5. Validate SEO audit fields (blocking):
   - `npm run check:seo-audit-fields`
   - Confirm `violationsTotal: 0` in `logs/seo-audit-fields-latest.json`.

## CI/CD

1. PR workflow is green (`Quality Gate PR`).
2. Nightly workflow artifacts are available (`Nightly Regression`).
3. Manual release workflow completed (`Release Go No-Go`) with uploaded artifacts.
4. Post-deploy smoke completed (`Post Deploy Smoke`).

## Sign-off template

- Release date/time:
- Environment:
- Gate result:
- Known issues:
- Rollback plan:
- Approver:
- Decision ledger file: `docs/release-decisions/YYYY-MM-DD.md`
