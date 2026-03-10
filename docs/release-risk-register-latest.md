# Release Risk Register

- Generated at: 2026-03-06T08:12:46.470Z
- Risks total: 8
- Open: 0
- Monitor: 1
- High/Medium/Low: 0/1/7

## Risks

| ID | Severity | Status | Owner | Title | Value | Threshold | Evidence | Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RISK-008 | medium | monitor | seo | Historical runtime coverage drift | 0.5 | 0 | logs/weekly-kpi-trends.json | Keep runtime_ok coverage at 100% for ready entries over time |
| RISK-001 | low | closed | release | Quality gate overall status | true | true | logs/check-all-latest.json | Run check:all and resolve failed checks before release |
| RISK-002 | low | closed | release | Pass rate degradation | 100 | 100 | logs/weekly-kpi-latest.json | Investigate failed checks and recover pass rate to 100% |
| RISK-003 | low | closed | perf | Quality gate duration regression | 54038 | 60000 | logs/check-all-latest.json | Profile slow checks and optimize top duration contributors |
| RISK-004 | low | closed | seo | SEO migration policy violations | 0 | 0 | logs/seo-migration-policy-latest.json | Fix status=ready entries that are not runtime validated |
| RISK-005 | low | closed | seo | SEO audit metadata quality | 0 | 0 | logs/seo-migration-policy-latest.json | Fill owner/ticket/approvedAt for all ready migration entries |
| RISK-006 | low | closed | platform | Runtime probe failures | 0 | 0 | logs/ready-runtime-probes-latest.json | Restore availability for failing ready routes |
| RISK-007 | low | closed | perf | Runtime probe latency budget | 0 | 0 | logs/ready-runtime-probes-latest.json | Investigate latency spikes for ready URLs |

