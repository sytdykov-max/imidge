# Imidge Headless (Medusa 2 + Next.js)

Новый интернет-магазин Imidge на headless-архитектуре.

## Структура

- `apps/medusa` — backend (каталог, цены, корзины, заказы, админ)
- `apps/storefront` — Next.js storefront (SSR/SEO/UX)
- `packages/ui` — общая дизайн-система и UI-компоненты
- `docs` — архитектура, модель данных, roadmap

## Быстрый старт dev

- Из корня проекта: `npm run dev`
- Скрипт поднимет отдельно backend (`9000`) и storefront (`3002`) в новых PowerShell окнах.
- Проверка без запуска процессов: `npm run dev:dry-run`
- Устойчивый режим (с watchdog): `npm run dev:resilient`
- One-click запуск: `Start-Imidge.cmd`
- One-click остановка: `Stop-Imidge.cmd`

## Импорт реальных товаров (подготовка)

- Шаблон файла: `apps/medusa/src/scripts/import-products-template.json`
- Dry-run импорта: `cd apps/medusa && npm run import:products`
- Указать свой файл: `npm run import:products -- path=./src/scripts/my-products.json`
- Применить импорт: `npm run import:products -- apply path=./src/scripts/my-products.json`
- В режиме `apply` обновляются только верхнеуровневые поля существующих товаров (`title`, `description`, `metadata`), без изменения существующих variants.

### Полезные документы

- `docs/product-metadata-seo.md` — формат `product.metadata` для вывода `aggregateRating` и `review` в JSON-LD
- `docs/runbook-quality-gate.md` — диагностика падений quality-gate и add-to-cart
- `docs/plan-51-progress.md` — текущий статус выполнения плана из 51 пункта
- `docs/runbook-checkout-incidents.md` — диагностика инцидентов checkout/payment/shipping
- `docs/release-checklist-v2.md` — обновлённый release-gate перед выкладкой
- `docs/weekly-regression-report-template.md` — шаблон еженедельного regression-отчёта
- `docs/release-dry-run-2026-03-05.md` — результат последнего dry-run релиза
- `docs/release-dry-run-2026-03-06-v3.md` — протокол dry-run v3 с go/no-go критериями
- `docs/release-go-no-go-latest.md` — короткий итоговый релизный свод (авто-генерация из logs)
- `docs/runbook-seo-migration-rollback.md` — rollback-плейбук для SEO-миграции

## Ближайшие этапы

1. Зафиксировать архитектуру и контракты данных
2. Инициализировать Medusa backend
3. Инициализировать Next.js storefront
4. Перенести дизайн из `new_site_imidge/dark`
5. Подключить каталог, корзину, checkout

## Pre-release чеклист

1. **Preflight health-check**
	- `npm run check:preflight`
	- Проверяет доступность backend (`/health`) и storefront (`/`).
	- При недоступности любого сервиса завершается с ошибкой.

2. **Backend health**
	- `cd apps/medusa`
	- `npm run dev`
	- Проверить `http://127.0.0.1:9000/health` (ожидается `200`).

3. **Storefront build**
	- `cd apps/storefront`
	- `npm run build`

4. **SEO metadata наполнены**
	- `cd apps/medusa`
	- `npm run seed:seo-metadata -- dry-run`
	- Ожидается `Products to update: 0` (или выполнить `npm run seed:seo-metadata`, если есть обновления).

5. **JSON-LD smoke-check**
	- `npm run check:jsonld`
	- Ожидается `HAS_PRODUCT: true`, `HAS_OFFERS: true`, `HAS_AGGREGATE_RATING: true`, `HAS_REVIEW: true`.

6. **Критичные маршруты**
	- Проверить открытие: `/`, `/catalog`, `/product/shorts`, `/cart`, `/checkout`, `/blog`, `/account`, `/search`.
	- Автопроверка маршрутов с отчётом: `npm run check:smoke`.
	- Артефакт проверки: `logs/smoke_status.txt`.

7. **Скорость каталога**
	- `npm run check:catalog-speed`
	- Скрипт проверяет `/catalog`, пагинацию и RU/EN поисковые запросы.
	- Если маршрут медленнее 1500ms, проверка считается проблемной.

8. **Кодировка текстов каталога (крокозябры)**
	- `npm run audit:catalog-text`
	- Скрипт проверяет `title/handle/description/collection/type` во всех товарах через Store API.
	- При нахождении проблем выводит список handle/id и полей с подозрительной кодировкой.

9. **Эквивалентность RU/EN/translit поиска**
	- `npm run check:search-equivalence`
	- Скрипт сверяет выдачу для пар запросов (`bmw` ↔ `бмв`, `bmw x5` ↔ `бмв х5`).
	- Если количество найденных товаров отличается, проверка завершается с ошибкой.

10. **E2E flow check (маршруты ecommerce)**
	- `npm run check:e2e-flow`
	- Проверяет маршрутную связку `catalog → product → cart → checkout`.
	- Для каждой страницы валидирует `200` и наличие базового контент-маркера.

11. **Add-to-cart API check**
	- `npm run check:add-to-cart`
	- Проверяет 3 кейса: успешное добавление валидного `variant_id`, повторное добавление (рост quantity) и ожидаемая ошибка для невалидного `variant_id`.
	- Если любой кейс не соответствует ожиданию, скрипт завершается с ошибкой.

12. **Проверка операций quantity/remove в корзине**
	- `npm run check:cart-quantity`
	- Проверяет API сценарий: добавить item → обновить quantity до `3` → удалить item.
	- Любое отклонение статуса/состояния корзины завершает скрипт с ошибкой.

13. **Проверка guard пустой корзины на checkout**
	- `npm run check:checkout-empty-guard`
	- Проверяет API-пустую корзину и наличие guard-условия в клиентском checkout.
	- Если guard отсутствует, проверка завершается с ошибкой.

14. **Payment session smoke-check**
	- `npm run check:payment-session-smoke`
	- Проверяет цепочку: cart with item → payment collection → payment session.
	- Ошибка на любом этапе завершает скрипт с ошибкой.

15. **Shipping options fallback smoke-check**
	- `npm run check:shipping-options-fallback`
	- Проверяет получение shipping options по регионам и fallback на совместимый регион.
	- Если ни в одном регионе нет options, скрипт завершится с ошибкой.

16. **Order complete smoke-check**
	- `npm run check:order-complete-smoke`
	- Проверяет полный checkout pipeline: line-item → адреса → shipping method → payment collection/session → `cart complete`.
	- Дополнительно проверяет открытие страницы подтверждения `/checkout/success` по созданному заказу.

17. **Store API guards check (timeout + checkout country fallback)**
	- `npm run check:store-api-guards`
	- Проверяет наличие timeout guard в Store API клиенте и fallback `country_code` по региону корзины при checkout.
	- Подтверждает наличие debug-события fallback и корректной подстановки `country_code`.

18. **Проверка guard для несоответствия валют региону**
	- `npm run check:region-price-guard`
	- Ищет товар с валидной ценой, но без валютной совместимости с доступными регионами.
	- Проверяет, что на PDP показано сообщение о недоступности и кнопка `Добавить в корзину` отключена.

19. **SEO policy check**
	- `npm run check:seo-pages`
	- Проверяет `canonical` и robots-политику (`index/noindex`) по ключевым страницам.
	- Если политика расходится с ожиданиями, скрипт завершается с ошибкой.

20. **Проверка битых внутренних ссылок**
	- `npm run check:internal-links`
	- Скрипт собирает внутренние ссылки с ключевых страниц и проверяет, что они отдают `2xx/3xx`.
	- Любой `4xx/5xx` считается ошибкой регрессии.

21. **Проверка SEO redirect-map (legacy URL migration)**
	- `npm run check:seo-redirect-map`
	- Валидирует `apps/storefront/config/seo-redirects.json` (структура, дубликаты, циклы `source=destination`).
	- Проверяет live-редиректы на storefront и ожидаемые `location` для каждого legacy URL.

22. **Полный quality gate одной командой**
	- `npm run check:all`
	- Последовательно запускает: preflight, smoke, скорость каталога, аудит крокозябр, эквивалентность поиска, add-to-cart, cart-quantity, checkout-empty-guard, payment-session-smoke, shipping-options-fallback, store-api-guards, order-complete-smoke, region-price-guard, e2e-flow, jsonld, internal-links, seo-redirect-map, SEO migration manifest, SEO migration policy-check, SEO policy.
	- Артефакты запуска: `logs/check-all-latest.log`, `logs/check-all-latest.json`, `logs/check-all-latest.md`, `logs/check-all-latest.junit.xml`.

23. **Weekly KPI report generator**
	- `npm run report:weekly-kpi`
	- Строит автоотчёт из `logs/check-all-latest.json` и `logs/check-all-latest.log`.
	- Артефакты: `logs/weekly-kpi-latest.json`, `docs/weekly-regression-report-latest.md`.

24. **SEO migration manifest report**
	- `npm run report:seo-migration-manifest`
	- Строит migration-таблицу legacy URL → new URL из `apps/storefront/config/seo-redirects.json` с метаданными (`owner/priority/status/sourceType/targetType`).
	- Артефакты: `logs/seo-migration-manifest-latest.json`, `logs/seo-migration-manifest-latest.csv`, `docs/seo-migration-manifest-latest.md`, `docs/seo-migration-checklist-latest.md`.

25. **SEO migration policy check (blocking)**
	- `npm run check:seo-migration-policy`
	- Фейлит проверку при условии `status=ready` и `runtime_ok != true`.
	- Также фейлит, если в manifest отсутствуют обязательные поля `status` или `runtimeOk`.
	- Артефакты: `logs/seo-migration-policy-latest.json`, `docs/seo-migration-policy-latest.md`.

26. **SEO audit fields check (blocking)**
	- `npm run check:seo-audit-fields`
	- Фейлит проверку, если для `status=ready` отсутствуют или невалидны поля `owner`, `ticket`, `approvedAt`.
	- Артефакты: `logs/seo-audit-fields-latest.json`, `docs/seo-audit-fields-latest.md`.

27. **Weekly KPI trends generator**
	- `npm run report:weekly-trends`
	- Строит тренд по последним прогонам из `logs/check-all-history.jsonl` и `logs/weekly-kpi-history.jsonl`.
	- Артефакты: `logs/weekly-kpi-trends.json`, `docs/weekly-regression-trends.md`.

28. **Regression thresholds check**
	- `npm run check:regression-thresholds`
	- Проверяет SLA-гейты: общее время quality gate, минимальный pass-rate, лимит времени для одиночных проверок и `ready_entries_without_runtime_ok`.
	- Пороговые env: `MAX_GATE_MS` (default `60000`), `MAX_SINGLE_CHECK_MS` (default `20000`), `MIN_PASS_RATE` (default `100`), `MAX_READY_RUNTIME_VIOLATIONS` (default `0`).
	- Для профиля `ci`: `MAX_GATE_MS` (default `75000`), `MAX_SINGLE_CHECK_MS` (default `25000`), `MIN_PASS_RATE` (default `100`), `MAX_READY_RUNTIME_VIOLATIONS` (default `0`).
	- Versioned-конфиг порогов: `config/quality-gate-thresholds.json` с профилями `local` / `ci`.
	- Выбор профиля: env `QUALITY_GATE_PROFILE` (по умолчанию `local`, в CI — `ci`).

29. **Release evidence check (blocking)**
	- `npm run check:release-evidence`
	- Проверяет наличие и валидность обязательных release-артефактов (json/md/log/junit).
	- Артефакты: `logs/release-evidence-latest.json`, `docs/release-evidence-latest.md`.

30. **Artifact freshness check (blocking)**
	- `npm run check:artifact-freshness`
	- Проверяет возраст ключевых release-артефактов по SLA (`ARTIFACT_MAX_AGE_MINUTES`, default `180`).
	- Артефакты: `logs/artifact-freshness-latest.json`, `docs/artifact-freshness-latest.md`.

31. **Pre-merge mini gate (lightweight)**
	- `npm run check:mini-gate`
	- Последовательно запускает: `check:preflight`, `report:seo-migration-manifest`, `check:seo-migration-policy`, `check:smoke`, `check:regression-thresholds:light`.
	- Строгий режим: `npm run check:mini-gate:strict` (дополнительно включает `check:docs-threshold-drift` и `probe:ready-runtime`).
	- Предназначен для быстрого блокирующего pre-merge контроля.

32. **Docs drift check (threshold defaults)**
	- `npm run check:docs-threshold-drift`
	- Проверяет синхронизацию дефолтов порогов между кодом и документацией (`README.md`, `docs/runbook-quality-gate.md`).

33. **Synthetic runtime probes (ready URLs)**
	- `npm run probe:ready-runtime`
	- Проверяет runtime-доступность и задержки для `status=ready` URL из SEO manifest.
	- Артефакты: `logs/ready-runtime-probes-latest.json`, `docs/ready-runtime-probes-latest.md`.

34. **Weekly rollup (KPI + trends + policy)**
	- `npm run report:weekly-rollup`
	- Собирает единый weekly rollup из последних артефактов KPI/trends/policy.
	- Артефакты: `logs/weekly-rollup-latest.json`, `docs/weekly-regression-rollup-latest.md`, архив `docs/weekly-regression-rollup/YYYY-MM-DD.md`.

35. **Release go/no-go summary (short)**
	- `npm run report:release-go-no-go`
	- Строит короткий go/no-go свод по последним артефактам quality-gate/policy/probes.
	- Артефакты: `logs/release-go-no-go-latest.json`, `docs/release-go-no-go-latest.md`, архив `docs/release-go-no-go/YYYY-MM-DD.md`.

36. **Release risk register**
	- `npm run report:release-risk-register`
	- Строит risk register релиза по данным quality/policy/probes/trends с severity/status/owner/action.
	- Артефакты: `logs/release-risk-register-latest.json`, `docs/release-risk-register-latest.md`.

37. **Release handoff summary**
	- `npm run report:release-handoff`
	- Формирует handoff для owner'ов SEO/Checkout/Performance/Release на основе последних артефактов.
	- Артефакты: `logs/release-handoff-latest.json`, `docs/release-handoff-latest.md`.

38. **Release decision ledger**
	- `npm run report:release-decision-ledger`
	- Формирует ledger решения релиза с матрицей подписантов и рисками.
	- Артефакты: `logs/release-decision-ledger-latest.json`, `docs/release-decision-ledger-latest.md`, архив `docs/release-decisions/YYYY-MM-DD.md`.

39. **Weekly artifact cleanup rotation**
	- `npm run cleanup:artifacts`
	- Ротирует `logs/*-history.jsonl` по удержанию N запусков и архивирует weekly snapshots.
	- Пороговые env: `CLEANUP_KEEP_HISTORY_RUNS` (default `30`), `CLEANUP_KEEP_ARCHIVE_WEEKS` (default `8`).
	- Артефакты: `logs/cleanup-artifacts-latest.json`, `docs/cleanup-artifacts-latest.md`, `logs/archive/**`.

40. **Failure alerts (Slack/Telegram)**
	- `npm run alert:send`
	- Отправляет уведомления в Slack (`SLACK_WEBHOOK_URL`) и/или Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`).

41. **CI summary writer**
	- `npm run ci:write-summary`
	- Публикует краткий summary nightly quality-gate в `GITHUB_STEP_SUMMARY`.

42. **CI release summary writer**
	- `npm run ci:write-release-summary`
	- Публикует release decision summary (go/no-go + риски + handoff) в `GITHUB_STEP_SUMMARY`.

43. **Manual release workflow (GitHub Actions)**
	- Workflow: `.github/workflows/release-go-no-go.yml`
	- Trigger: `workflow_dispatch` с inputs `quality_gate_profile` и `artifact_max_age_minutes`.
	- Выполняет release-пайплайн и публикует полный пакет release артефактов.

44. **Weekly cleanup workflow (GitHub Actions)**
	- Workflow: `.github/workflows/weekly-artifact-cleanup.yml`
	- Trigger: еженедельно по cron + `workflow_dispatch`.
	- Выполняет cleanup/rotation артефактов и публикует cleanup-report.

45. **Smoke flow ecommerce**
	- Каталог: фильтры (`cat/brand/price`), сортировка, пагинация, поиск `q`.
	- PDP: открытие карточки + блок похожих товаров.
	- Корзина: изменение количества/удаление позиции.
	- Checkout: валидация формы и создание заказа.

## Новые процессы автоматизации чек-листа

- Очистка старых чек-листов интегрирована в release workflow
- Генерация архивных checklist файлов для каждого релиза
- CI-step проверки валидности всех checklist файлов
- Проверка обязательных пунктов в чек-листе
- Логирование изменений чек-листа с release ledger
- Автоматическая подпись чек-листа (approval workflow)
- Мониторинг успешности выполнения чек-листа

## Принципы

- Старый Bitrix используется как источник данных и контента, не как основа нового ядра.
- Все новые экраны реализуются в Next.js с серверным рендером для SEO.
- Бизнес-логика ecommerce концентрируется в Medusa.

## Автоматизация pre-prod-checklist

Скрипт scripts/generate-pre-prod-checklist-latest.mjs автоматически создает и обновляет файл pre-prod-checklist-latest.md с текущей датой.

Запуск:
```bash
node scripts/generate-pre-prod-checklist-latest.mjs
```

Файл будет перезаписан в корне проекта.
Интеграция с release workflow и очистка старых чек-листов реализуется в следующих шагах.
