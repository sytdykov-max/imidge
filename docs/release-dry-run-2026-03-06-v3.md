# Release Dry Run v3 — 2026-03-06

## Scope
- Sign-off качества перед выкладкой: SEO, checkout, performance, policy.
- Проверка новых процессов: mini-gate, docs drift, probes, rollup, alerts.

## Sign-off matrix
- SEO owner: [ ]
- Checkout owner: [ ]
- Performance owner: [ ]
- Release owner: [ ]

## Required commands
1. `npm run check:mini-gate`
2. `npm run check:all`
3. `npm run report:weekly-kpi`
4. `npm run report:weekly-trends`
5. `npm run report:weekly-rollup`
6. `npm run check:regression-thresholds`
7. `npm run probe:ready-runtime`

## Go / No-Go criteria
### GO
- Все обязательные проверки = OK.
- `ready_entries_without_runtime_ok = 0`.
- Regression thresholds в пределах профиля `ci`.
- Runtime probes без hard-fail.

### NO-GO
- Любая блокирующая проверка = FAIL.
- Нарушение policy или threshold SLA.
- Несогласованный риск по SEO/checkout/perf.

## Evidence links
- `logs/check-all-latest.json`
- `logs/weekly-kpi-latest.json`
- `logs/weekly-kpi-trends.json`
- `logs/weekly-rollup-latest.json`
- `logs/seo-migration-policy-latest.json`
- `logs/ready-runtime-probes-latest.json`

## Decision log
- Decision: [ ] GO / [ ] NO-GO
- Timestamp:
- Approvers:
- Notes:
