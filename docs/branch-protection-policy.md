# Branch Protection Policy (main)

## Required checks
- `Quality Gate PR / quality-gate`
- `Quality Gate PR / merge-block-policy`
- `CI Smoke / smoke`
- `Release Freeze Guard / freeze-guard`

## Restrictions
- Require pull request before merging
- Require at least 1 review
- Dismiss stale approvals on new commits
- Require linear history
- Block force pushes
- Block branch deletion

## Emergency override
- Allowed only for Release owner
- Must include incident ID in PR description
- Post-merge RCA required within 24h
