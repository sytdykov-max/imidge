import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fetchAllStoreProducts, getMetadataString, toPct } from "./facet-utils.mjs";

function loadLegacyFilters(root) {
  const filePath = path.resolve(root, "apps/medusa/src/scripts/legacy-filters.json");
  if (!existsSync(filePath)) {
    return { filePath, index: new Map() };
  }

  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  const rows = Array.isArray(parsed?.filters) ? parsed.filters : [];
  const index = new Map(rows.map((row) => [String(row.handle ?? "").trim().toLowerCase(), row]));

  return {
    filePath,
    index,
  };
}

function compareValue(current, expected) {
  const a = String(current ?? "").trim();
  const b = String(expected ?? "").trim();
  return a === b;
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const { medusaUrl, products } = await fetchAllStoreProducts();
  const { filePath: legacyFiltersPath, index: legacyIndex } = loadLegacyFilters(root);

  const rows = [];
  let matchedProducts = 0;

  for (const product of products) {
    const handle = String(product?.handle ?? "").trim().toLowerCase();
    if (!handle) continue;

    const legacy = legacyIndex.get(handle);
    if (!legacy) continue;

    matchedProducts += 1;

    const currentBrand = getMetadataString(product?.metadata, ["filter_brand", "brand", "legacy_brand"]);
    const currentCategory = getMetadataString(product?.metadata, ["filter_category", "legacy_category", "category"]);
    const currentPriceRange = getMetadataString(product?.metadata, ["filter_price_range"]);
    const currentAvailability = getMetadataString(product?.metadata, ["filter_availability"]);

    const row = {
      id: product?.id ?? "",
      handle,
      brandMatch: compareValue(currentBrand, legacy.brand),
      categoryMatch: compareValue(currentCategory, legacy.category),
      priceRangeMatch: compareValue(currentPriceRange, legacy.price_range),
      availabilityMatch: compareValue(currentAvailability, legacy.availability),
      current: {
        brand: currentBrand,
        category: currentCategory,
        priceRange: currentPriceRange,
        availability: currentAvailability,
      },
      expected: {
        brand: legacy.brand ?? "",
        category: legacy.category ?? "",
        priceRange: legacy.price_range ?? "",
        availability: legacy.availability ?? "",
      },
    };

    rows.push(row);
  }

  const brandMatched = rows.filter((row) => row.brandMatch).length;
  const categoryMatched = rows.filter((row) => row.categoryMatch).length;
  const priceRangeMatched = rows.filter((row) => row.priceRangeMatch).length;
  const availabilityMatched = rows.filter((row) => row.availabilityMatch).length;

  const payload = {
    generatedAt: new Date().toISOString(),
    medusaUrl,
    legacyFiltersPath,
    productsTotal: products.length,
    matchedProducts,
    diff: {
      brandMatchPct: toPct(brandMatched, matchedProducts),
      categoryMatchPct: toPct(categoryMatched, matchedProducts),
      priceRangeMatchPct: toPct(priceRangeMatched, matchedProducts),
      availabilityMatchPct: toPct(availabilityMatched, matchedProducts),
    },
    mismatchesSample: rows
      .filter((row) => !row.brandMatch || !row.categoryMatch || !row.priceRangeMatch || !row.availabilityMatch)
      .slice(0, 200),
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "filter-migration-diff-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Filter Migration Diff Report",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Legacy filters path: ${payload.legacyFiltersPath}`,
    `- Products total: ${payload.productsTotal}`,
    `- Matched products: ${payload.matchedProducts}`,
    `- Brand match: ${payload.diff.brandMatchPct}%`,
    `- Category match: ${payload.diff.categoryMatchPct}%`,
    `- Price range match: ${payload.diff.priceRangeMatchPct}%`,
    `- Availability match: ${payload.diff.availabilityMatchPct}%`,
    "",
    "## Mismatch sample",
    "",
    ...(payload.mismatchesSample.length
      ? payload.mismatchesSample.slice(0, 40).map((item) => `- ${item.handle} | brand=${item.brandMatch} | category=${item.categoryMatch} | price_range=${item.priceRangeMatch} | availability=${item.availabilityMatch}`)
      : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "filter-migration-diff-latest.md"), `${markdown}\n`, "utf8");

  console.log(`filter_migration_diff: matched=${matchedProducts}, brand_match=${payload.diff.brandMatchPct}%`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
