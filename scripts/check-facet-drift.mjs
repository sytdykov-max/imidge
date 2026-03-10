import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fetchAllStoreProducts, getMetadataString, toPct } from "./facet-utils.mjs";

function loadLegacySnapshot(root) {
  const filePath = path.resolve(root, "apps/medusa/src/scripts/legacy-filters.json");
  if (!existsSync(filePath)) {
    return { filePath, index: new Map() };
  }

  const parsed = JSON.parse(readFileSync(filePath, "utf8"));
  const rows = Array.isArray(parsed?.filters) ? parsed.filters : [];
  const index = new Map(rows.map((row) => [String(row.handle ?? "").trim().toLowerCase(), row]));

  return { filePath, index };
}

function norm(value) {
  return String(value ?? "").trim();
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const maxDriftPct = Number(process.env.FACET_DRIFT_MAX_PCT ?? 3);
  const minMatched = Number(process.env.FACET_DRIFT_MIN_MATCHED_PRODUCTS ?? 100);
  const requireSnapshot = String(process.env.FACET_DRIFT_REQUIRE_SNAPSHOT ?? "false").toLowerCase() === "true";

  const { medusaUrl, products } = await fetchAllStoreProducts();
  const { filePath: snapshotPath, index: snapshot } = loadLegacySnapshot(root);

  if (snapshot.size === 0 && !requireSnapshot) {
    const payload = {
      generatedAt: new Date().toISOString(),
      medusaUrl,
      snapshotPath,
      skipped: true,
      reason: "snapshot_missing",
      ok: true,
      violations: [],
    };

    mkdirSync(logsDir, { recursive: true });
    mkdirSync(docsDir, { recursive: true });

    writeFileSync(path.resolve(logsDir, "facet-drift-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    writeFileSync(
      path.resolve(docsDir, "facet-drift-latest.md"),
      `# Facet Drift Check\n\n- Result: SKIPPED\n- Reason: snapshot_missing\n- Snapshot path: ${snapshotPath}\n`,
      "utf8"
    );

    console.log("facet_drift: status=SKIPPED, reason=snapshot_missing");
    return;
  }

  let matchedProducts = 0;
  let brandDrift = 0;
  let categoryDrift = 0;
  let priceRangeDrift = 0;
  let availabilityDrift = 0;
  const driftSamples = [];

  for (const product of products) {
    const handle = String(product?.handle ?? "").trim().toLowerCase();
    if (!handle) continue;

    const expected = snapshot.get(handle);
    if (!expected) continue;

    matchedProducts += 1;

    const current = {
      brand: getMetadataString(product?.metadata, ["filter_brand", "brand", "legacy_brand"]),
      category: getMetadataString(product?.metadata, ["filter_category", "legacy_category", "category"]),
      priceRange: getMetadataString(product?.metadata, ["filter_price_range"]),
      availability: getMetadataString(product?.metadata, ["filter_availability"]),
    };

    const expectedValues = {
      brand: norm(expected.brand),
      category: norm(expected.category),
      priceRange: norm(expected.price_range),
      availability: norm(expected.availability),
    };

    const isBrandDrift = norm(current.brand) !== expectedValues.brand;
    const isCategoryDrift = norm(current.category) !== expectedValues.category;
    const isPriceRangeDrift = norm(current.priceRange) !== expectedValues.priceRange;
    const isAvailabilityDrift = norm(current.availability) !== expectedValues.availability;

    if (isBrandDrift) brandDrift += 1;
    if (isCategoryDrift) categoryDrift += 1;
    if (isPriceRangeDrift) priceRangeDrift += 1;
    if (isAvailabilityDrift) availabilityDrift += 1;

    if ((isBrandDrift || isCategoryDrift || isPriceRangeDrift || isAvailabilityDrift) && driftSamples.length < 150) {
      driftSamples.push({
        id: product?.id ?? "",
        handle,
        drift: {
          brand: isBrandDrift,
          category: isCategoryDrift,
          priceRange: isPriceRangeDrift,
          availability: isAvailabilityDrift,
        },
        current,
        expected: expectedValues,
      });
    }
  }

  const brandDriftPct = toPct(brandDrift, matchedProducts);
  const categoryDriftPct = toPct(categoryDrift, matchedProducts);
  const priceRangeDriftPct = toPct(priceRangeDrift, matchedProducts);
  const availabilityDriftPct = toPct(availabilityDrift, matchedProducts);

  const violations = [];

  if (matchedProducts < minMatched) {
    violations.push(`matched_products_below_min: ${matchedProducts} < ${minMatched}`);
  }
  if (brandDriftPct > maxDriftPct) {
    violations.push(`brand_drift_above_threshold: ${brandDriftPct}% > ${maxDriftPct}%`);
  }
  if (categoryDriftPct > maxDriftPct) {
    violations.push(`category_drift_above_threshold: ${categoryDriftPct}% > ${maxDriftPct}%`);
  }
  if (priceRangeDriftPct > maxDriftPct) {
    violations.push(`price_range_drift_above_threshold: ${priceRangeDriftPct}% > ${maxDriftPct}%`);
  }
  if (availabilityDriftPct > maxDriftPct) {
    violations.push(`availability_drift_above_threshold: ${availabilityDriftPct}% > ${maxDriftPct}%`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    medusaUrl,
    snapshotPath,
    maxDriftPct,
    minMatched,
    productsTotal: products.length,
    matchedProducts,
    drift: {
      brand: { count: brandDrift, pct: brandDriftPct },
      category: { count: categoryDrift, pct: categoryDriftPct },
      priceRange: { count: priceRangeDrift, pct: priceRangeDriftPct },
      availability: { count: availabilityDrift, pct: availabilityDriftPct },
    },
    violations,
    ok: violations.length === 0,
    samples: driftSamples,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "facet-drift-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Facet Drift Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Snapshot path: ${payload.snapshotPath}`,
    `- Matched products: ${payload.matchedProducts}`,
    `- Drift threshold: ${payload.maxDriftPct}%`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Drift metrics",
    "",
    `- Brand drift: ${payload.drift.brand.pct}% (${payload.drift.brand.count})`,
    `- Category drift: ${payload.drift.category.pct}% (${payload.drift.category.count})`,
    `- Price range drift: ${payload.drift.priceRange.pct}% (${payload.drift.priceRange.count})`,
    `- Availability drift: ${payload.drift.availability.pct}% (${payload.drift.availability.count})`,
    "",
    "## Violations",
    "",
    ...(payload.violations.length ? payload.violations.map((item) => `- ${item}`) : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "facet-drift-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`facet_drift: status=FAIL, violations=${payload.violations.length}`);
    process.exitCode = 1;
    return;
  }

  console.log(`facet_drift: status=OK, matched=${matchedProducts}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
