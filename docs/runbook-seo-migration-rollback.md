# Runbook: SEO Migration Rollback

## Purpose
- Быстро и контролируемо откатить SEO-миграцию при критичных регрессиях.
- Минимизировать влияние на индексацию, трафик и checkout-конверсию.

## Rollback triggers
- `check:seo-migration-policy` = FAIL на production.
- `ready_entries_without_runtime_ok > 0` в nightly/probe.
- Массовые 5xx/4xx на `status=ready` URL.
- Критичное падение трафика/конверсии после релиза (по agreed SLA).

## SLA response
- Triage start: до 10 минут после алерта.
- Решение `rollback / no-rollback`: до 30 минут.
- Полный rollback: до 60 минут.

## Owners
- Incident Commander: Release owner
- SEO owner: SEO lead
- Backend owner: Medusa owner
- Frontend owner: Storefront owner

## Rollback procedure
1. Зафиксировать инцидент (время, симптомы, затронутые URL).
2. Остановить rollout/деплой и заморозить merge в `main`.
3. Вернуть предыдущую версию redirect-map (`apps/storefront/config/seo-redirects.json`) из последнего стабильного тега.
4. Перезапустить storefront с rollback-конфигом.
5. Выполнить контроль:
   - `npm run report:seo-migration-manifest`
   - `npm run check:seo-migration-policy`
   - `npm run probe:ready-runtime`
6. Подтвердить нулевые violations и стабилизацию runtime probes.
7. Снять freeze и документировать RCA.

## Validation checklist
- [ ] `seo_migration_policy: status=OK`
- [ ] `violationsTotal = 0`
- [ ] Runtime probes без hard-fail
- [ ] Ключевые SEO страницы отдают ожидаемые коды
- [ ] Checkout-flow не деградирован

## Post-incident
- Обновить `docs/release-dry-run-2026-03-06-v3.md` с итогами.
- Добавить preventive actions в roadmap.
