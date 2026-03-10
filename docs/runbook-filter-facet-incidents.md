# Runbook: Filter Facet Incidents

## Назначение

Документ описывает действия при деградации фильтров каталога (падение coverage, дрейф фасетов, неконсистентные значения).

## Триггеры инцидента

- `check:filter-metadata-coverage` = FAIL
- `check:critical-facets-by-category` = FAIL
- `check:facet-consistency` = FAIL
- `check:facet-drift` = FAIL

## Severity

- **SEV-1**: coverage по `filter_brand` или `filter_category` < 90% на всем каталоге
- **SEV-2**: coverage < порога в критичной категории (Часы/Сумки/Одежда)
- **SEV-3**: локальная неконсистентность в ограниченном наборе товаров

## SLA реакции

- SEV-1: реакция ≤ 15 мин, mitigation ≤ 60 мин
- SEV-2: реакция ≤ 30 мин, mitigation ≤ 4 ч
- SEV-3: реакция ≤ 1 раб. день

## Ответственные

- Data owner: миграция/маппинг фасетов
- Backend owner: backfill/import scripts
- Storefront owner: фильтры UI и SEO
- Release owner: Go/No-Go решение

## Порядок действий

1. Проверить `logs/filter-metadata-coverage-latest.json` и `docs/filter-metadata-coverage-latest.md`.
2. Проверить проблемные категории в nightly summary (Top-3 degradation block).
3. Открыть диагностику: `docs/facet-diagnostics-latest.md`.
4. Запустить incremental backfill: `cd apps/medusa && npm run backfill:filter-metadata:incremental`.
5. Перезапустить проверки:
   - `npm run check:filter-metadata-coverage`
   - `npm run check:critical-facets-by-category`
   - `npm run check:facet-consistency`
   - `npm run check:facet-drift`
6. При сохранении деградации — rollback стадии rollout через `report:filters-rollout-v2`.
7. Зафиксировать RCA и remediation в release decision ledger.

## Postmortem checklist

- Причина (данные/маппинг/код/инфраструктура)
- Влияние (категории, SKU, SEO, конверсия)
- Что изменили (код/конфиг/процесс)
- Как предотвратить повтор (новые checks/алерты/пороги)
