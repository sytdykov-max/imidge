# New Engine Launch: Next 10 Implementation (2026-03-10)

## Status
- Overall: **10/10 implemented**
- Verification run (local):
  - `npm run check:preflight` → OK
  - `npm run check:docs-threshold-drift` → OK
  - `npm run check:seo-audit-fields` → OK

## Implemented items
1. Versioned quality gate thresholds with `local/ci` profiles.
   - `config/quality-gate-thresholds.json`
   - `scripts/lib-quality-thresholds.mjs`

2. Nightly `check:all` in CI with artifacts and summary.
   - `.github/workflows/nightly-regression.yml`
   - `scripts/ci-write-summary.mjs`

3. Failure alerts to Slack/Telegram.
   - `scripts/send-quality-alert.mjs`
   - wired in nightly/PR/probes workflows

4. Docs drift validation in CI.
   - `scripts/check-docs-threshold-drift.mjs`
   - nightly workflow step: `Docs threshold drift check`

5. SEO manifest audit fields (`owner`, `ticket`, `approvedAt`) + validator.
   - `scripts/generate-seo-migration-manifest.mjs`
   - `scripts/check-seo-audit-fields.mjs`

6. Pre-merge lightweight gate (`preflight + seo-policy + regression-thresholds`).
   - `.github/workflows/quality-gate-pr.yml` (explicit step added)

7. Synthetic runtime probes every 15 minutes.
   - `.github/workflows/ready-runtime-probes.yml`
   - `scripts/probe-ready-runtime.mjs`

8. Weekly auto-rollup with archive by date.
   - `scripts/generate-weekly-rollup.mjs`
   - archive path: `docs/weekly-regression-rollup/YYYY-MM-DD.md`

9. SEO rollback playbook.
   - `docs/runbook-seo-migration-rollback.md`

10. Release dry-run v3 + go/no-go artifacts.
   - `docs/release-dry-run-2026-03-06-v3.md`
   - `.github/workflows/release-go-no-go.yml`
   - `scripts/generate-release-go-no-go.mjs`

## Notes
- The implementation is incremental and remains compatible with the existing quality-gate stack.
- Site runtime remains on:
  - Storefront: `http://127.0.0.1:3002`
  - Medusa API: `http://127.0.0.1:9000/health`
