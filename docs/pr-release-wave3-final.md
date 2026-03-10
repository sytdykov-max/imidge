# PR Title

feat: wave-3 launch readiness + storefront migration baseline

# PR Description

## Summary
- Migrate storefront sources into monorepo (`apps/storefront`) and remove embedded git submodule reference.
- Implement wave-3 launch automation baseline: CI smoke, lighthouse placeholder, synthetic checkout probe, release freeze guard.
- Add wave-3 operational controls and closeout flow.
- Add checks/schemas/monitoring artifacts for SEO and release governance.
- Add final implementation matrix documenting completed items and external follow-ups.

## What changed
- Workflows:
  - `.github/workflows/ci-smoke.yml`
  - `.github/workflows/lighthouse-ci.yml`
  - `.github/workflows/synthetic-checkout-probe.yml`
  - `.github/workflows/release-freeze-guard.yml`
  - `.github/workflows/wave3-closeout.yml`
  - `.github/workflows/post-release-24h-monitoring.yml`
- Release/quality configs and schemas:
  - `config/release-freeze.json`
  - `config/canary-rollout.json`
  - `config/seo-migration-manifest.schema.json`
  - `config/seo-redirects.schema.json`
- Scripts (checks/reporting/ops):
  - `scripts/check-release-freeze.mjs`
  - `scripts/check-canary-rollout-state.mjs`
  - `scripts/check-seo-migration-schema.mjs`
  - `scripts/check-seo-redirect-schema.mjs`
  - `scripts/check-storefront-bundle-budget.mjs`
  - `scripts/check-product-content-quality.mjs`
  - `scripts/check-seo-ui-text-drift.mjs`
  - `scripts/run-quality-gate-level.mjs`
  - `scripts/run-rollback-drill.mjs`
  - `scripts/generate-release-changelog.mjs`
  - `scripts/generate-release-health-dashboard.mjs`
  - `scripts/generate-wave3-closeout.mjs`
  - `scripts/update-release-freeze.mjs`
  - `scripts/log-incident-event.mjs`
- Documentation:
  - `docs/branch-protection-policy.md`
  - `docs/runbook-canary-rollout.md`
  - `docs/runbook-rollback-drill.md`
  - `docs/post-release-24h-monitoring.md`
  - `docs/wave-3-closeout-template.md`
  - `docs/wave-3-closeout-latest.md`
  - `docs/wave-3-implementation-matrix-2026-03-10.md`

## Validation
- `npm run check:preflight`
- `npm run check:seo-migration-schema`
- `npm run check:seo-redirect-schema`
- `npm run check:gate:quick`
- `npm run report:rollback-drill`

## Pre-review status (verified)
- [x] Branch is pushed and up to date with `origin/release/wave3-final`
- [x] PR range contains 0 merge commits (`git rev-list --merges origin/main..HEAD --count`)
- [x] Local validation commands above pass

## Risks / Notes
- `main` is protected and disallows merge commits/direct pushes.
- This branch is prepared for PR flow only (`release/wave3-final`).

## Rollback
- Revert PR merge commit on `main` if needed.
- Run `npm run report:rollback-drill` and follow `docs/runbook-rollback-drill.md`.

## Checklist
- [ ] CI checks pass on this PR
- [ ] Reviewer confirms branch-protection policy alignment
- [ ] Release freeze and canary configs approved
- [ ] Post-release monitoring workflow is scheduled/verified
- [ ] Merge via squash/rebase (no merge commit)

# Suggested labels
- `release`
- `ci`
- `ops`
- `documentation`
