# Runbook: Canary Rollout

## Traffic stages
- Stage 1: 10%
- Stage 2: 25%
- Stage 3: 50%
- Stage 4: 100%

## Gate per stage
- `check:all` = PASS
- `check:seo-migration-policy` = PASS
- Ready probes violations = 0
- Checkout synthetic probe = PASS

## Stage progression rule
- Hold each stage at least 30 minutes
- Proceed only if all gates remain green
- Any critical regression => rollback to previous stage
