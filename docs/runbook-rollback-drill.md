# Runbook: Rollback Drill

## Goal
Validate rollback readiness and recovery time for storefront + SEO policy.

## Drill cadence
- Weekly in staging
- Mandatory before major release

## Drill script
1. Mark current candidate build and checks.
2. Introduce controlled bad config (staging only).
3. Confirm detection by probes/quality gate.
4. Execute rollback to previous stable config.
5. Run verification checks.
6. Record MTTR and lessons learned.

## Success criteria
- Detection < 10 min
- Rollback complete < 60 min
- Post-rollback checks all green
