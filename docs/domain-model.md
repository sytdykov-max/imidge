# Модель данных (черновик v1)

## Каталог

### Brand
- id
- slug
- name
- description
- logo_url

### Category
- id
- parent_id
- slug
- name
- seo_title
- seo_description

### Product
- id
- slug
- title
- short_description
- full_description
- brand_id
- category_ids[]
- status (draft/active)
- seo_title
- seo_description

### Product Variant (SKU)
- id
- product_id
- sku
- option_values (size/color/material)
- price
- currency
- compare_at_price
- stock_quantity
- weight

### Media
- id
- product_id
- url
- alt
- sort_order

## Контент

### Blog Post
- id
- slug
- title
- excerpt
- body
- cover_image
- published_at
- seo_title
- seo_description

## Коммерция

### Customer
- id
- email
- phone
- first_name
- last_name

### Cart
- id
- customer_id?
- items[]
- subtotal
- discounts
- shipping
- total

### Order
- id
- customer_id
- status
- payment_status
- fulfillment_status
- totals
- line_items
- shipping_address
- billing_address

## Для миграции из Bitrix

Собираем обязательные поля:
- старый URL
- новый URL
- product external id
- SKU
- цены и валюта
- остаток
- изображения
- мета-теги
