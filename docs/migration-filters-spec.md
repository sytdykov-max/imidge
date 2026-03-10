# Migration Filters Spec (Legacy → Headless)

## 1) Целевая схема фильтров

Базовая схема фильтров для каталога:

- `brand`: строка, нормализованная метка бренда
- `category`: строка, нормализованная метка категории
- `price_range`: enum (`lt_100`, `100_300`, `300_600`, `600_1000`, `gte_1000`, `unknown`)
- `availability`: enum (`in_stock`, `out_of_stock`)
- `attributes`: объект с дополнительными фасетами (MVP: пустой объект/минимальный набор)

Сервисные поля для трассируемости:

- `legacy_id`: ID товара в legacy
- `handle`: нормализованный slug
- `currency`: код валюты (`uah`, `usd`, `eur`)
- `min_price`: минимальная цена по товару

## 2) Mapping legacy полей в новую схему

| Legacy source | New field | Правило |
|---|---|---|
| `b_iblock_element.ID` | `legacy_id` | как есть |
| `b_iblock_element.CODE` | `handle` | нормализация slug, fallback `legacy-{id}` |
| `b_iblock_element.NAME` (+ `CODE`) | `brand` | извлечение бренда по паттернам из title/handle |
| `b_iblock_section.NAME` | `category` | нормализованная категория, fallback `Без категории` |
| `b_catalog_price.MIN(PRICE)` | `min_price` | минимум среди доступных цен |
| `b_catalog_price.CURRENCY` | `currency` | lowercase + whitelist |
| `b_catalog_product.QUANTITY` | `availability` | `>0 => in_stock`, иначе `out_of_stock` |
| (MVP) нет стабильных props | `attributes` | пустой объект `{}` с поэтапным расширением |

## 3) Обязательные поля и fallback-правила

Обязательные для импорта:

- `legacy_id`
- `handle`
- `brand`
- `category`
- `price_range`
- `availability`

Fallback:

- `handle`: `legacy-{legacy_id}`
- `brand`: `Без бренда`
- `category`: `Без категории`
- `price_range`: `unknown`, если цена отсутствует/некорректна
- `availability`: `out_of_stock`, если нет валидного количества
- `attributes`: `{}`

## 4) Список «грязных» данных (контроль)

Контролируем отдельным JSON-отчётом:

- дубли `handle`
- пустые исходные `CODE`
- невалидные валюты (не входят в whitelist)
- невалидные/неположительные цены
- отсутствующий/пустой `brand`
- отсутствующая/пустая `category`

Артефакт: `apps/medusa/src/scripts/legacy-filters-dirty-report.json`.

## 5) Extractor фильтров

Скрипт: `apps/medusa/src/scripts/extract-legacy-filters.ts`.

Выходные артефакты:

- `apps/medusa/src/scripts/legacy-filters.json`
- `apps/medusa/src/scripts/legacy-filters-dirty-report.json`

Запуск:

```bash
cd apps/medusa
npm run extract:legacy-filters
```
