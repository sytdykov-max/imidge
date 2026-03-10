# Runbook: quality gate и сбои ecommerce

## 1) Быстрый запуск полной проверки

```bash
npm run check:all
```

Артефакты последнего запуска:
- `logs/check-all-latest.log`
- `logs/check-all-latest.json`
- `logs/check-all-latest.md`
- `logs/check-all-latest.junit.xml`
- `logs/check-all-history.jsonl`
- `logs/check-all-history-latest.json`

## 2) Обязательные preflight условия

```bash
npm run check:preflight
```

Ожидается `status=200` для:
- backend: `http://127.0.0.1:9000/health`
- storefront: `http://127.0.0.1:3002/`

## 3) Если не работает add-to-cart

1. Запустить автотест:
   ```bash
   npm run check:add-to-cart
   ```
2. Проверить кейсы:
   - `valid_variant` должен вернуть `status=200`, `item=OK`.
   - `repeat_variant` должен показать `quantity >= 2`.
   - `invalid_variant` должен вернуть ошибку (`status >= 400`).
3. Если `valid_variant` падает:
   - проверить `NEXT_PUBLIC_MEDUSA_BACKEND_URL` и `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` в `apps/storefront/.env.local`;
   - проверить CORS в `apps/medusa/.env` (`STORE_CORS` должен включать origin storefront);
   - убедиться, что товар имеет доступный variant (остаток или отключенный `manage_inventory`).

## 4) Если quality gate падает

1. Открыть `logs/check-all-latest.json` и найти первый check со `status != 0`.
2. Перезапустить конкретный check локально:
   - `npm run check:smoke`
   - `npm run check:catalog-speed`
   - `npm run audit:catalog-text`
   - `npm run check:search-equivalence`
   - `npm run check:add-to-cart`
   - `npm run check:cart-quantity`
   - `npm run check:checkout-empty-guard`
   - `npm run check:payment-session-smoke`
   - `npm run check:shipping-options-fallback`
   - `npm run check:order-complete-smoke`
   - `npm run check:region-price-guard`
   - `npm run check:e2e-flow`
   - `npm run check:jsonld`
   - `npm run check:internal-links`
   - `npm run check:seo-redirect-map`
   - `npm run check:seo-migration-policy`
   - `npm run check:seo-pages`
3. После фикса снова запустить `npm run check:all`.

## 6) Генерация weekly KPI из логов quality gate

```bash
npm run report:weekly-kpi
```

Артефакты:
- `logs/weekly-kpi-latest.json`
- `docs/weekly-regression-report-latest.md`

## 7) Генерация weekly KPI trends

```bash
npm run report:weekly-trends
```

Артефакты:
- `logs/weekly-kpi-trends.json`
- `docs/weekly-regression-trends.md`

## 8) Генерация SEO migration manifest

```bash
npm run report:seo-migration-manifest
```

Артефакты:
- `logs/seo-migration-manifest-latest.json`
- `logs/seo-migration-manifest-latest.csv`
- `docs/seo-migration-manifest-latest.md`
- `docs/seo-migration-checklist-latest.md`

## 9) Проверка blocking policy для SEO migration

```bash
npm run check:seo-migration-policy
```

Артефакты:
- `logs/seo-migration-policy-latest.json`
- `docs/seo-migration-policy-latest.md`

Правило:
- Любая запись со `status=ready` должна иметь `runtimeOk=true`.
- При `status=ready` и `runtimeOk!=true` проверка завершится ошибкой (CI fail).

Smoke-проверка policy-fail сценария:

```bash
npm run check:seo-migration-policy-smoke
```

Скрипт создаёт временный manifest с нарушением и подтверждает, что policy-check фейлится.

## 10) Пороговая проверка регрессий (SLA)

```bash
npm run check:regression-thresholds
```

Пороговые env-переменные:
- `MAX_GATE_MS` (по умолчанию `60000`)
- `MAX_SINGLE_CHECK_MS` (по умолчанию `20000`)
- `MIN_PASS_RATE` (по умолчанию `100`)
- `MAX_READY_RUNTIME_VIOLATIONS` (по умолчанию `0`)
- Пороговые env (для `ci`):
   - `MAX_GATE_MS` (по умолчанию `75000`)
   - `MAX_SINGLE_CHECK_MS` (по умолчанию `25000`)
   - `MIN_PASS_RATE` (по умолчанию `100`)
   - `MAX_READY_RUNTIME_VIOLATIONS` (по умолчанию `0`)

Versioned-конфиг порогов:
- `config/quality-gate-thresholds.json` (профили `local` и `ci`)
- env `QUALITY_GATE_PROFILE` для выбора профиля

## 11) Pre-merge mini gate (быстрый блокирующий)

```bash
npm run check:mini-gate
```

Последовательность:
- `check:preflight`
- `report:seo-migration-manifest`
- `check:seo-migration-policy`
- `check:smoke`
- `check:regression-thresholds:light`

## 12) Проверка дрейфа документации порогов

```bash
npm run check:docs-threshold-drift
```

Проверяет, что дефолты threshold’ов в коде и в документации совпадают.

## 13) Synthetic runtime probes для ready URL

```bash
npm run probe:ready-runtime
```

Артефакты:
- `logs/ready-runtime-probes-latest.json`
- `docs/ready-runtime-probes-latest.md`

## 14) Weekly rollup (KPI + trends + policy)

```bash
npm run report:weekly-rollup
```

Артефакты:
- `logs/weekly-rollup-latest.json`
- `docs/weekly-regression-rollup-latest.md`
- `docs/weekly-regression-rollup/YYYY-MM-DD.md`

## 15) Alerts при падениях quality checks

```bash
npm run alert:send
```

Интеграции:
- Slack: `SLACK_WEBHOOK_URL`
- Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

## 16) Минимальный release-gate перед выкладкой

1. `npm run check:preflight`
2. `npm run check:all`
3. Подтвердить отсутствие ошибок в `logs/check-all-latest.json` (`ok: true`).
