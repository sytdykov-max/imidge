import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAllStoreProducts, toPct } from "./facet-utils.mjs";

function loadJson(root, relPath) {
  const filePath = path.resolve(root, relPath);
  return {
    filePath,
    data: JSON.parse(readFileSync(filePath, "utf8")),
  };
}

function getNestedValue(source, dottedKey) {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const parts = String(dottedKey ?? "").split(".").filter(Boolean);
  let cursor = source;

  for (const part of parts) {
    if (!cursor || typeof cursor !== "object" || !(part in cursor)) {
      return undefined;
    }
    cursor = cursor[part];
  }

  return cursor;
}

function hasMeaningfulValue(value) {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "boolean") {
    return true;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length > 0;
  }

  return false;
}

function firstNonEmptyFromMetadata(metadata, keys) {
  for (const key of keys) {
    const value = getNestedValue(metadata, key);
    if (hasMeaningfulValue(value)) {
      return { key, value };
    }
  }

  return null;
}

function firstNonEmptyFromLegacy(record, keys) {
  for (const key of keys) {
    const value = getNestedValue(record, key);
    if (hasMeaningfulValue(value)) {
      return { key, value };
    }
  }

  return null;
}

function collectStoreDynamicAttributes(products, prefixes) {
  const dynamicKeys = new Set();

  for (const product of products) {
    const metadata = product?.metadata;
    if (!metadata || typeof metadata !== "object") continue;

    for (const key of Object.keys(metadata)) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        dynamicKeys.add(key);
      }
    }
  }

  return [...dynamicKeys].sort((a, b) => a.localeCompare(b, "ru"));
}

function collectLegacyDynamicAttributes(records, namespaceKey) {
  const dynamicKeys = new Set();

  for (const record of records) {
    const bucket = record?.[namespaceKey];
    if (!bucket || typeof bucket !== "object") continue;

    for (const key of Object.keys(bucket)) {
      if (hasMeaningfulValue(bucket[key])) {
        dynamicKeys.add(key);
      }
    }
  }

  return [...dynamicKeys].sort((a, b) => a.localeCompare(b, "ru"));
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const { data: facetSchema } = loadJson(root, "config/facets-schema-v2.json");
  const { data: normalizationDictionary } = loadJson(root, "config/facet-normalization-dictionary.json");
  const { data: filterMap } = loadJson(root, "config/filter-attribute-map.v2.json");
  const { data: legacyFiltersPayload, filePath: legacyFiltersPath } = loadJson(
    root,
    "apps/medusa/src/scripts/legacy-filters.json"
  );

  const schemaFacetKeys = new Set(Object.keys(facetSchema?.facets ?? {}));
  const requiredSchemaFacets = new Set(Array.isArray(facetSchema?.requiredFacets) ? facetSchema.requiredFacets : []);
  const mappings = Array.isArray(filterMap?.mappings) ? filterMap.mappings : [];
  const mappedFacets = new Set(mappings.map((item) => String(item.canonicalFacet ?? "").trim()).filter(Boolean));

  const violations = [];

  for (const requiredFacet of requiredSchemaFacets) {
    if (!mappedFacets.has(requiredFacet)) {
      violations.push(`required_facet_not_mapped:${requiredFacet}`);
    }
  }

  for (const mapping of mappings) {
    const canonicalFacet = String(mapping?.canonicalFacet ?? "").trim();
    if (!canonicalFacet) {
      violations.push("mapping_missing_canonicalFacet");
      continue;
    }

    if (!schemaFacetKeys.has(canonicalFacet)) {
      violations.push(`mapping_unknown_facet:${canonicalFacet}`);
    }

    const normalizationGroup = String(mapping?.normalization ?? "").trim();
    if (normalizationGroup && !(normalizationGroup in (normalizationDictionary ?? {}))) {
      violations.push(`mapping_unknown_normalization:${canonicalFacet}:${normalizationGroup}`);
    }
  }

  const { medusaUrl, products } = await fetchAllStoreProducts();
  const legacyFilters = Array.isArray(legacyFiltersPayload?.filters) ? legacyFiltersPayload.filters : [];

  const storeCoverageThreshold = Number(filterMap?.requiredCoveragePct?.storeMetadata ?? 95);
  const legacyCoverageThreshold = Number(filterMap?.requiredCoveragePct?.legacyFilters ?? 95);

  const coverage = [];

  for (const mapping of mappings) {
    const canonicalFacet = String(mapping?.canonicalFacet ?? "").trim();
    if (!canonicalFacet) continue;

    const metadataKeys = Array.isArray(mapping?.metadataKeys) ? mapping.metadataKeys.map(String) : [];
    const legacyKeys = Array.isArray(mapping?.legacyKeys) ? mapping.legacyKeys.map(String) : [];
    const required = Boolean(mapping?.required);

    let metadataCovered = 0;
    const metadataMissingSamples = [];

    for (const product of products) {
      const found = firstNonEmptyFromMetadata(product?.metadata, metadataKeys);
      if (found) {
        metadataCovered += 1;
      } else if (metadataMissingSamples.length < 20) {
        metadataMissingSamples.push({
          id: product?.id ?? "",
          handle: product?.handle ?? "",
          title: product?.title ?? "",
        });
      }
    }

    let legacyCovered = 0;
    const legacyMissingSamples = [];

    for (const row of legacyFilters) {
      const found = firstNonEmptyFromLegacy(row, legacyKeys);
      if (found) {
        legacyCovered += 1;
      } else if (legacyMissingSamples.length < 20) {
        legacyMissingSamples.push({
          legacy_id: row?.legacy_id ?? "",
          handle: row?.handle ?? "",
        });
      }
    }

    const metadataCoveragePct = toPct(metadataCovered, products.length);
    const legacyCoveragePct = toPct(legacyCovered, legacyFilters.length);

    if (required && metadataCoveragePct < storeCoverageThreshold) {
      violations.push(
        `store_coverage_below_threshold:${canonicalFacet}:${metadataCoveragePct}%<${storeCoverageThreshold}%`
      );
    }

    if (required && legacyCoveragePct < legacyCoverageThreshold) {
      violations.push(
        `legacy_coverage_below_threshold:${canonicalFacet}:${legacyCoveragePct}%<${legacyCoverageThreshold}%`
      );
    }

    coverage.push({
      canonicalFacet,
      required,
      metadataKeys,
      legacyKeys,
      metadata: {
        total: products.length,
        covered: metadataCovered,
        coveragePct: metadataCoveragePct,
        missingSample: metadataMissingSamples,
      },
      legacy: {
        total: legacyFilters.length,
        covered: legacyCovered,
        coveragePct: legacyCoveragePct,
        missingSample: legacyMissingSamples,
      },
    });
  }

  const legacyNamespace = String(filterMap?.attributeNamespaces?.legacy ?? "attributes");
  const storePrefixes = Array.isArray(filterMap?.attributeNamespaces?.storeMetadataPrefixes)
    ? filterMap.attributeNamespaces.storeMetadataPrefixes.map(String)
    : ["attr_", "attribute_"];

  const dynamicAttributes = {
    storeMetadataKeys: collectStoreDynamicAttributes(products, storePrefixes),
    legacyAttributeKeys: collectLegacyDynamicAttributes(legacyFilters, legacyNamespace),
  };

  const payload = {
    generatedAt: new Date().toISOString(),
    medusaUrl,
    contractVersion: String(filterMap?.version ?? ""),
    sources: {
      legacyFiltersPath,
      storeProductsTotal: products.length,
      legacyFiltersTotal: legacyFilters.length,
    },
    thresholds: {
      storeCoverageThreshold,
      legacyCoverageThreshold,
    },
    ok: violations.length === 0,
    violations,
    coverage,
    dynamicAttributes,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "filter-model-contract-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Filter Model Contract Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Contract version: ${payload.contractVersion}`,
    `- Store products total: ${payload.sources.storeProductsTotal}`,
    `- Legacy filters total: ${payload.sources.legacyFiltersTotal}`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Coverage",
    "",
    "| Facet | Required | Store coverage | Legacy coverage |",
    "| --- | --- | ---: | ---: |",
    ...coverage.map(
      (item) =>
        `| ${item.canonicalFacet} | ${item.required ? "yes" : "no"} | ${item.metadata.coveragePct}% | ${item.legacy.coveragePct}% |`
    ),
    "",
    "## Violations",
    "",
    ...(payload.violations.length ? payload.violations.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Dynamic attributes inventory",
    "",
    `- Store metadata dynamic keys (${dynamicAttributes.storeMetadataKeys.length}): ${dynamicAttributes.storeMetadataKeys.join(", ") || "none"}`,
    `- Legacy attribute keys (${dynamicAttributes.legacyAttributeKeys.length}): ${dynamicAttributes.legacyAttributeKeys.join(", ") || "none"}`,
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "filter-model-contract-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`filter_model_contract: status=FAIL, violations=${payload.violations.length}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `filter_model_contract: status=OK, facets=${coverage.length}, store_products=${products.length}, legacy_rows=${legacyFilters.length}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
