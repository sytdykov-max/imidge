# Filter Model V2 Contract

## Purpose
This document fixes the final filter model and attribute mapping for migration of catalog products to the new storefront.

## Source of truth
- `config/facets-schema-v2.json` — canonical facet schema and required facets.
- `config/facet-normalization-dictionary.json` — alias normalization dictionary.
- `config/filter-attribute-map.v2.json` — final mapping contract between legacy fields, store metadata keys, and canonical filter facets.

## Required canonical facets
- `filter_brand`
- `filter_category`
- `filter_price_range`
- `filter_availability`

## Mapping rules
- Canonical facet values are read from `metadata` using `metadataKeys` priority in `config/filter-attribute-map.v2.json`.
- Legacy parity is validated using `legacyKeys` from `apps/medusa/src/scripts/legacy-filters.json`.
- Normalization references (`brandAliases`, `categoryAliases`, etc.) must exist in `config/facet-normalization-dictionary.json`.

## Dynamic attribute namespace
- Legacy dynamic attributes namespace: `attributes`
- Store dynamic attribute prefixes: `attr_`, `attribute_`

## Contract check
Run:

- `npm run check:filter-model-contract`

Outputs:
- `logs/filter-model-contract-latest.json`
- `docs/filter-model-contract-latest.md`

The check fails when:
- Required facets from schema are not mapped.
- Mapped facet references unknown schema facet.
- Mapping references unknown normalization group.
- Required facet coverage is below thresholds from `config/filter-attribute-map.v2.json`.
