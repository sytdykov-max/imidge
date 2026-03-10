import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fetchAllStoreProducts, getMetadataString, toPct } from "./facet-utils.mjs";

function loadSchema(root) {
  const schemaPath = path.resolve(root, "config/facets-schema-v2.json");
  return JSON.parse(readFileSync(schemaPath, "utf8"));
}

function facetValue(metadata, facetKey) {
  if (!metadata || typeof metadata !== "object") return undefined;
  return metadata[facetKey];
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const schema = loadSchema(root);
  const requiredFacets = Array.isArray(schema.requiredFacets) ? schema.requiredFacets : [];
  const { medusaUrl, products } = await fetchAllStoreProducts();

  const perFacet = requiredFacets.map((facetKey) => {
    const present = products.filter((product) => {
      const value = facetValue(product?.metadata, facetKey);
      if (typeof value === "string") {
        return value.trim().length > 0;
      }
      if (typeof value === "boolean") {
        return true;
      }
      return value !== null && value !== undefined;
    }).length;

    return {
      facet: facetKey,
      present,
      missing: Math.max(products.length - present, 0),
      coveragePct: toPct(present, products.length),
    };
  });

  const categoryMap = new Map();
  for (const product of products) {
    const category = getMetadataString(product?.metadata, ["filter_category", "legacy_category", "category"]) || "(missing)";
    if (!categoryMap.has(category)) {
      categoryMap.set(category, { total: 0, withBrand: 0, requiredFacetPresent: new Map(requiredFacets.map((facet) => [facet, 0])) });
    }
    const row = categoryMap.get(category);
    row.total += 1;
    const brand = getMetadataString(product?.metadata, ["filter_brand", "brand", "legacy_brand"]);
    if (brand) {
      row.withBrand += 1;
    }

    for (const facet of requiredFacets) {
      const value = product?.metadata?.[facet];
      const isPresent = typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
      if (isPresent) {
        row.requiredFacetPresent.set(facet, (row.requiredFacetPresent.get(facet) ?? 0) + 1);
      }
    }
  }

  const topCategoryCoverage = [...categoryMap.entries()]
    .map(([label, row]) => ({
      label,
      products: row.total,
      brandCoveragePct: toPct(row.withBrand, row.total),
      requiredFacetCoveragePct: requiredFacets.length
        ? Math.round(
            (requiredFacets.reduce((sum, facet) => sum + toPct(row.requiredFacetPresent.get(facet) ?? 0, row.total), 0) /
              requiredFacets.length) *
              100
          ) / 100
        : 0,
    }))
    .sort((a, b) => b.products - a.products)
    .slice(0, 20);

  const degradationThresholdPct = Number(process.env.FACET_DEGRADATION_THRESHOLD_PCT ?? 97);
  const minCategoryProductsForDegradation = Number(process.env.FACET_DEGRADATION_MIN_PRODUCTS ?? 10);

  const problematicCategories = [...categoryMap.entries()]
    .map(([label, row]) => {
      const requiredFacetCoveragePct = requiredFacets.length
        ? requiredFacets.reduce((sum, facet) => sum + toPct(row.requiredFacetPresent.get(facet) ?? 0, row.total), 0) /
          requiredFacets.length
        : 0;

      return {
        label,
        products: row.total,
        brandCoveragePct: toPct(row.withBrand, row.total),
        requiredFacetCoveragePct: Math.round(requiredFacetCoveragePct * 100) / 100,
      };
    })
    .filter((row) => row.products >= minCategoryProductsForDegradation)
    .filter(
      (row) =>
        row.requiredFacetCoveragePct < degradationThresholdPct || row.brandCoveragePct < degradationThresholdPct
    )
    .sort((a, b) => {
      if (a.requiredFacetCoveragePct !== b.requiredFacetCoveragePct) {
        return a.requiredFacetCoveragePct - b.requiredFacetCoveragePct;
      }
      return b.products - a.products;
    });

  const topProblematicCategories = problematicCategories.slice(0, 3);

  const payload = {
    generatedAt: new Date().toISOString(),
    medusaUrl,
    schemaVersion: schema.schemaVersion,
    productsTotal: products.length,
    requiredFacets,
    perFacet,
    topCategoryCoverage,
    degradation: {
      thresholdPct: degradationThresholdPct,
      minProducts: minCategoryProductsForDegradation,
      problematicCategories,
      topProblematicCategories,
    },
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "facet-coverage-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Facet Coverage Report",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Products total: ${payload.productsTotal}`,
    `- Schema version: ${payload.schemaVersion}`,
    "",
    "## Required facets",
    "",
    "| Facet | Present | Missing | Coverage |",
    "| --- | ---: | ---: | ---: |",
    ...perFacet.map((row) => `| ${row.facet} | ${row.present} | ${row.missing} | ${row.coveragePct}% |`),
    "",
    "## Top categories by volume",
    "",
    "| Category | Products | Brand coverage |",
    "| --- | ---: | ---: |",
    ...topCategoryCoverage.map((row) => `| ${row.label} | ${row.products} | ${row.brandCoveragePct}% |`),
    "",
    "## Top-3 problematic categories",
    "",
    ...(topProblematicCategories.length
      ? [
          "| Category | Products | Brand coverage | Required facets coverage |",
          "| --- | ---: | ---: | ---: |",
          ...topProblematicCategories.map(
            (row) =>
              `| ${row.label} | ${row.products} | ${row.brandCoveragePct}% | ${row.requiredFacetCoveragePct}% |`
          ),
        ]
      : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "facet-coverage-latest.md"), `${markdown}\n`, "utf8");

  console.log(`facet_coverage: products=${products.length}, required_facets=${requiredFacets.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
