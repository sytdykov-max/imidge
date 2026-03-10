# Staging Dry-Run Protocol: Filters V2

## Цель

Подтвердить готовность rollout Filters V2 на staging по данным, качеству, SEO, производительности и e2e.

## Входные артефакты

- `logs/filter-metadata-coverage-latest.json`
- `logs/critical-facets-by-category-latest.json`
- `logs/facet-consistency-latest.json`
- `logs/check-catalog-filters-e2e-latest.json`
- `logs/check-catalog-filters-performance-latest.json`
- `logs/check-catalog-filters-seo-latest.json`
- `logs/facet-drift-latest.json`

## Критерии GO

- coverage (`filter_brand`, `filter_category`) >= 95%
- critical facets by category = OK
- facet consistency = OK
- e2e filter checks = OK
- performance (p95) в рамках бюджета
- SEO checks = OK
- drift <= configured threshold

## Порядок прогона

1. Запустить incremental backfill.
2. Запустить checks/reports:
   - `npm run report:facet-coverage`
   - `npm run check:critical-facets-by-category`
   - `npm run check:facet-consistency`
   - `npm run check:catalog-filters-e2e`
   - `npm run check:catalog-filters-performance`
   - `npm run check:catalog-filters-seo`
   - `npm run check:facet-drift`
3. Сгенерировать staging protocol:
   - `npm run report:filters-staging-go-no-go`

## Выход

- `docs/filters-staging-go-no-go-latest.md`
- Решение: GO / NO-GO
- Список блокеров и предупреждений
