# Roadmap запуска (MVP)

## Week 1
- Архитектура и модель данных
- Инициализация Medusa + Next
- Подключение базовой темы и layout

## Week 2
- Категории и карточка товара
- Корзина
- Базовый checkout

## Week 3
- SEO: sitemap/canonical/schema
- Миграция каталога (пилот)
- QA и исправления

## Week 4
- Миграция полного каталога
- E2E smoke тесты
- Подготовка staging и релиза

## Next 10 (реализация)
1. Вынести пороги quality-gate в отдельный versioned config (`config/quality-gate-thresholds.json`) с поддержкой профилей `local/ci`.
2. Добавить автоматический nightly запуск `check:all` в CI с публикацией артефактов и статуса в summary.
3. Подключить уведомления о падениях policy/threshold checks в Telegram/Slack канал команды.
4. Добавить проверку дрейфа документации: CI-step, который валидирует, что дефолты в коде и runbook синхронизированы.
5. Расширить `seo-migration-manifest` полями `owner`, `ticket`, `approvedAt` для аудита и трассируемости.
6. Внедрить pre-merge lightweight gate: `check:preflight` + `check:seo-migration-policy` + `check:regression-thresholds`.
7. Добавить synthetic runtime probes для `ready` URL (cron каждые 15 мин) с отчётом по деградациям.
8. Сделать weekly auto-rollup: объединённый markdown-отчёт KPI + trends + policy violations с автоархивацией по дате.
9. Подготовить rollback-плейбук для SEO-миграции (критерии отката, шаги, владельцы, SLA реакции).
10. Провести release dry-run v3 на staging с чек-листом sign-off (SEO, checkout, perf, policy) и финальным go/no-go протоколом.

## Next 10 (подготовлено к реализации, wave 2)
1. Добавить blocking-check `check:release-evidence` для валидации обязательных release-артефактов (JSON/MD/JUnit) перед go/no-go. ✅
2. Добавить `check:artifact-freshness` (SLA возраста артефактов), чтобы релиз не опирался на устаревшие прогоны. ✅
3. Ввести `check:seo-audit-fields` как отдельный blocking-check для `owner/ticket/approvedAt` в SEO manifest. ✅
4. Добавить `report:release-risk-register` (топ-риски релиза из check-all/policy/probes) в JSON+MD формате. ✅
5. Добавить `report:release-handoff` (короткий handoff для owner'ов SEO/Checkout/Perf/Release). ✅
6. Подключить `ci:write-release-summary` для отдельного release summary в `GITHUB_STEP_SUMMARY`. ✅
7. Добавить manual workflow `release-go-no-go.yml` (workflow_dispatch) с выбором профиля (`local/ci`) и автоартефактами. ✅
8. Расширить `check:mini-gate` опцией `--strict` (добавляет runtime probes и docs drift в pre-merge поток). ✅
9. Добавить weekly cleanup ротацию history/log-артефактов (удержание N запусков + архив) для стабильного CI. ✅
10. Внедрить release decision ledger (`docs/release-decisions/YYYY-MM-DD.md`) с обязательными approver-подписями и рисками. ✅

## Новые процессы автоматизации чек-листа

- Очистка старых чек-листов интегрирована в release workflow
- Генерация архивных checklist файлов для каждого релиза
- CI-step проверки валидности всех checklist файлов
- Проверка обязательных пунктов в чек-листе
- Логирование изменений чек-листа с release ledger
- Автоматическая подпись чек-листа (approval workflow)
- Мониторинг успешности выполнения чек-листа

Статус wave 2: **10/10 выполнено**.

## Next 20 (реализация, wave 3)
1. Инициализировать Git в текущем проекте: `git init`, добавить `.gitignore`, выполнить первый коммит с сообщением `release: finalize next-10 launch gate`.
2. Настроить базовую Git-конфигурацию репозитория: дефолтная ветка `main`, шаблон commit message, политики merge.
3. Добавить `CODEOWNERS` для критичных зон (`apps/storefront`, `apps/medusa`, `scripts`, `docs`).
4. Включить branch protection policy для `main` (обязательные checks, запрет force-push, required reviews).
5. Добавить workflow `ci-smoke.yml` для быстрых smoke-проверок на каждый PR.
6. Разделить quality gates по уровням: `quick`, `standard`, `strict` с единым profile-resolver.
7. Вынести конфиг SEO/redirect policy в versioned schema и добавить JSON-schema валидацию в CI.
8. Реализовать авто-генерацию changelog релиза из артефактов `check:all` и release ledger.
9. Добавить guard на размер bundle storefront (budget + fail при превышении порога).
10. Добавить Lighthouse CI для ключевых страниц (`/`, `/catalog`, `/product/[handle]`, `/checkout`).
11. Добавить synthetic checkout probe (sandbox) с периодическим e2e прогоном и SLA-метриками.
12. Внедрить единый формат инцидент-логов (JSONL) для storefront/medusa с correlation-id.
13. Добавить дашборд release health (pass-rate, latency, probe-fails, SEO violations) на основе `logs/*.json`.
14. Автоматизировать валидацию контента карточки товара (обязательные поля, варианты, изображения, цены).
15. Добавить anti-drift проверку между storefront UI-текстами и SEO-манифестом.
16. Внедрить pre-release freeze режим: блок merge без специального release label/approval.
17. Добавить canary rollout чеклист с процентным расширением трафика (10% → 25% → 50% → 100%).
18. Автоматизировать rollback drill: сценарий учебного отката и проверка времени восстановления.
19. Внедрить post-release 24h monitoring protocol с обязательным отчётом и владельцами.
20. Подготовить `wave-3 closeout` пакет: финальный отчёт, риски, остаточный backlog, решение go/no-go следующей волны.
