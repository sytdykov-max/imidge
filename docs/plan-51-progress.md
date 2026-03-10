# План 51: прогресс реализации

## Выполнено

- [x] 1. Автотест check:add-to-cart (валидный variant)
- [x] 2. Подключение check:add-to-cart в check:all
- [x] 3. Проверка ошибки на невалидный variant_id
- [x] 4. Базовый timeout-guard Store API клиента
- [x] 5. Проверка повторного add-to-cart (рост quantity)
- [x] 6. Бейдж количества товаров в хедере
- [x] 7. Обновление бейджа без полного refresh
- [x] 8. Optimistic update на add-to-cart
- [x] 9. Защита от двойного клика на add-to-cart
- [x] 11. Guard на submit checkout при пустой корзине
- [x] 12. Единый cart state store
- [x] 14. Сценарий очистки корзины
- [x] 15. E2E/API quantity regression check
- [x] 16. Guard timeout/error format для Store API запросов
- [x] 17. Fallback country_code checkout по региону корзины
- [x] 18. Debug-события fallback при checkout country resolve
- [x] 19. check:store-api-guards в quality gate
- [x] 20. Guard для add-to-cart при валютной несовместимости региона
- [x] 10. Единый toast/alert слой для действий корзины
- [x] 13. Восстановление корзины после протухшего cart_id
- [x] 21. Soft-migration корзины между регионами при валютной несовместимости
- [x] 22. Сохранение совместимых позиций при миграции корзины
- [x] 23. Предупреждение пользователю о смене региона/валюты корзины
- [x] 24. Debug-лог причин пересоздания/миграции корзины
- [x] 21. Fallback для отсутствующих shipping options на checkout
- [x] 22. Диагностика payment-session ошибок в чекауте
- [x] 23. Серверная валидация checkout полей
- [x] 24. Маска/валидация телефона
- [x] 25. Страница подтверждения заказа
- [x] 26. JSON-LD check включен в общий quality gate
- [x] 27. Автопроверка битых внутренних ссылок
- [x] 28. Автотест region-price-guard в общем quality gate
- [x] 29. Вынесение checkout side-effects в отдельный service слой
- [x] 30. check:checkout-empty-guard в quality gate
- [x] 31. check:payment-session-smoke
- [x] 32. check:shipping-options-fallback
- [x] 40. Экспорт результатов quality gate в JSON и LOG
- [x] 43. Артефакты quality-gate в CI workflow
- [x] 44. Nightly regression workflow
- [x] 45. Post-deploy smoke workflow
- [x] 46. Release checklist v2
- [x] 47. Runbook checkout incidents
- [x] 49. Weekly regression report template
- [x] 50. Dry-run release report
- [x] 41. Единый формат ошибок Store API на клиенте
- [x] 42. Correlation id (x-request-id) для Store API запросов
- [x] 44. Единый preflight health-check (backend + storefront)
- [x] 48. Runbook по quality gate и add-to-cart инцидентам

## В работе (следующий пакет)

- [x] 33. check:order-complete-smoke
- [x] 34. CI merge-block policy hardening
- [x] 35. Weekly KPI generator from logs
- [x] 36. История прогонов quality gate (jsonl + latest)
- [x] 37. Генератор weekly KPI trends
- [x] 38. Threshold-check регрессий (SLA)
- [x] 39. Ночная автоматизация KPI/trends/threshold reports
- [x] 51. SEO redirect-map migration check + legacy redirects in storefront
- [x] 52. SEO migration manifest report (CSV/JSON/MD) + nightly artifacts
- [x] 53. SEO migration metadata schema + launch checklist report
- [x] 54. Blocking policy-check for `status=ready` and `runtime_ok!=true` in CI
