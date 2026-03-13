# Facet Gap Audit (Latest)

- Date: 2026-03-12
- Data source: apps/medusa/src/scripts/legacy-filters.json
- Products analyzed: 13475

## Coverage vs old sidebar groups

- filter_gender: 9293 products (68.97%), 3 values
- filter_style: 1765 products (13.10%), 4 values
- filter_brand: 13475 products (100%), 689 values
- filter_size: 12 products (0.09%), 4 values
- filter_mechanism: 3348 products (24.85%), 3 values
- filter_mechanism_origin: 3540 products (26.27%), 3 values
- filter_case_size_mm: 12 products (0.09%), 10 values
- filter_case_shape: 1647 products (12.22%), 4 values
- filter_case_color: 4055 products (30.09%), 7 values
- filter_case_material: 2897 products (21.50%), 5 values
- filter_extra_functions: 2204 products (16.36%), 20 values
- filter_glass: 4452 products (33.04%), 2 values
- filter_water_resistance: 11 products (0.08%), 5 values
- filter_assembly_country: 3602 products (26.73%), 4 values

## Key finding

Fallback extraction now recovers a substantial part of old-site technical facet groups from title, handle and description text.

## Implication

UI now renders many old-site groups with meaningful coverage even without Bitrix DB access. Full parity still requires direct legacy DB export for the weakest groups (water resistance, exact case size and generic size).
