# Pre-Prod Checklist (One Screen) — 2026-03-06

## 1) Final gate (must be green)

- `npm run check:mini-gate:strict`
- `npm run check:all`
- `npm run check:regression-thresholds`
- `npm run check:release-evidence`
- `npm run check:artifact-freshness`

Pass criteria:
- `check-all-latest.json` => `ok: true`
- `release-go-no-go-latest.json` => `decision: GO`
- `seo-audit-fields-latest.json` => `violationsTotal: 0`

## 2) Release docs/sign-off

- `npm run report:release-go-no-go`
- `npm run report:release-risk-register`
- `npm run report:release-handoff`
- `npm run report:release-decision-ledger`
- Заполнить подписи в `docs/release-decisions/2026-03-06.md`:
  - SEO
  - Checkout
  - Performance
  - Release

## 3) CI confirmation

- Запустить manual workflow `Release Go No-Go`.
- Проверить, что job success и загружен artifact `release-go-no-go-artifacts`.
- Добавить URL run в release карточку/таск.

## 4) Deploy window

- Freeze: не мерджить новые PR до окончания окна.
- Выполнить deploy по стандартной процедуре.
- Сохранить отметку времени старта/окончания релиза.

## 5) Post-deploy smoke (blocking)

Проверить HTTP 200:
- `/`
- `/catalog`
- `/product/shorts`
- `/cart`
- `/checkout`
- `/blog`
- `/account`

Обновить ledger:
- Incident watch window
- Rollback triggers
- Итог: GO-LIVE / ROLLBACK
