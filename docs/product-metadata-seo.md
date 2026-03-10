# Product metadata для SEO schema (Medusa)

Этот формат используется storefront-логикой в `apps/storefront/src/app/product/[handle]/page.tsx` для условного вывода `aggregateRating` и `review` в JSON-LD.

## Поддерживаемые ключи

### Рейтинг
- `rating_value` (number или string-число)
- `rating_count` (number или string-число)
- `review_count` (number или string-число, опционально)

Дополнительно поддерживаются camelCase-синонимы:
- `ratingValue`
- `ratingCount`
- `reviewCount`

### Отзыв (один featured review)
- `review_author` (string)
- `review_body` (string)
- `review_rating` (number или string-число)

Дополнительно поддерживаются camelCase-синонимы:
- `reviewAuthor`
- `reviewBody`
- `reviewRating`

## Условия вывода в JSON-LD

`aggregateRating` будет добавлен только если:
- есть валидный `rating_value`,
- есть валидный `rating_count`,
- `rating_count > 0`.

`review` будет добавлен только если одновременно есть:
- `review_author`,
- `review_body`,
- `review_rating`.

Если полей нет, storefront НЕ выводит фиктивные данные.

## Рекомендуемый минимальный JSON в `product.metadata`

```json
{
  "rating_value": 4.8,
  "rating_count": 37,
  "review_count": 21,
  "review_author": "Ольга",
  "review_body": "Ткань приятная, размер соответствует. Буду заказывать еще.",
  "review_rating": 5
}
```

## Пример обновления через Admin API

```bash
curl -X POST "http://127.0.0.1:9000/admin/products/{product_id}" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {admin_token}" \
  -d '{
    "metadata": {
      "rating_value": 4.8,
      "rating_count": 37,
      "review_count": 21,
      "review_author": "Ольга",
      "review_body": "Ткань приятная, размер соответствует. Буду заказывать еще.",
      "review_rating": 5
    }
  }'
```

## Валидационные рекомендации

- `rating_value` держать в диапазоне `1..5`.
- `rating_count` и `review_count` должны быть целыми числами `>= 0`.
- `review_body` лучше ограничить до 300-500 символов.
- Использовать один стиль ключей (snake_case предпочтительно).

## Seed-скрипт для тестового заполнения

В проекте добавлен скрипт массового заполнения SEO metadata для товаров:

```bash
cd apps/medusa
npm run seed:seo-metadata -- dry-run
npm run seed:seo-metadata
```

Опции:
- `dry-run` — только показать, сколько товаров будет обновлено.
- `force` — перезаписать даже уже заполненные ключи (`npm run seed:seo-metadata -- force`).

## Проверка JSON-LD на storefront

После заполнения metadata можно быстро проверить наличие `Product` schema на странице товара:

```bash
cd apps/storefront
npm run check:jsonld
```

По умолчанию проверяется URL `http://127.0.0.1:3002/product/shorts`.

## Категории каталога (migration-ready)

Правила маппинга категорий для страницы каталога вынесены в отдельный файл:

- `apps/storefront/src/lib/catalog-category-rules.json`

Это позволяет обновлять ключевые слова и названия категорий без изменения TypeScript-логики.
