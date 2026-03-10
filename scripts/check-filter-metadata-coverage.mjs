import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readEnvLocal() {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(currentDir, "../apps/storefront/.env.local");
    const raw = readFileSync(envPath, "utf8");
    const map = new Map();

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      map.set(key, value);
    }

    return map;
  } catch {
    return new Map();
  }
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getMetadataString(metadata, keys) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

async function fetchProductsPage({ medusaUrl, publishableKey, limit, offset }) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
    fields: "id,handle,title,metadata",
  });

  const response = await fetch(`${medusaUrl}/store/products?${params.toString()}`, {
    headers: publishableKey ? { "x-publishable-api-key": publishableKey } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Medusa API error: ${response.status}`);
  }

  return response.json();
}

function pct(covered, total) {
  if (!total) return 0;
  return Math.round((covered / total) * 10000) / 100;
}

function normalizeCategoryKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parsePriorityCategories(rawValue) {
  const raw = String(rawValue ?? "").trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");
  const envLocal = readEnvLocal();

  const medusaUrl =
    process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
    process.env.MEDUSA_URL ??
    envLocal.get("NEXT_PUBLIC_MEDUSA_BACKEND_URL") ??
    "http://127.0.0.1:9000";
  const publishableKey =
    process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
    process.env.MEDUSA_PUBLISHABLE_KEY ??
    envLocal.get("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY") ??
    "";

  const minBrandCoveragePct = toNumber(process.env.FILTER_BRAND_MIN_COVERAGE_PCT, 95);
  const minCategoryCoveragePct = toNumber(process.env.FILTER_CATEGORY_MIN_COVERAGE_PCT, 95);
  const minProductsForGate = toNumber(process.env.FILTER_METADATA_MIN_PRODUCTS, 1);
  const priorityCategoryMinCoveragePct = toNumber(process.env.FILTER_PRIORITY_CATEGORY_MIN_COVERAGE_PCT, 92);
  const priorityCategoryMinProducts = toNumber(process.env.FILTER_PRIORITY_CATEGORY_MIN_PRODUCTS, 20);
  const priorityCategoryLabels = parsePriorityCategories(process.env.FILTER_PRIORITY_CATEGORIES ?? "Часы,Сумки");
  const pageLimit = toNumber(process.env.FILTER_METADATA_PAGE_LIMIT, 250);
  const maxPages = toNumber(process.env.FILTER_METADATA_MAX_PAGES, 200);

  const priorityCategoriesMap = new Map(
    priorityCategoryLabels.map((label) => [
      normalizeCategoryKey(label),
      {
        label,
        scannedProducts: 0,
        coveredBrand: 0,
      },
    ])
  );

  let offset = 0;
  let page = 0;
  let totalCount = Infinity;
  let scannedProducts = 0;
  let coveredBrand = 0;
  let coveredCategory = 0;

  const missingBrandSamples = [];
  const missingCategorySamples = [];

  while (page < maxPages && offset < totalCount) {
    const payload = await fetchProductsPage({
      medusaUrl,
      publishableKey,
      limit: pageLimit,
      offset,
    });

    const products = Array.isArray(payload?.products) ? payload.products : [];
    totalCount = typeof payload?.count === "number" ? payload.count : products.length;

    if (products.length === 0) {
      break;
    }

    for (const product of products) {
      const metadata = product?.metadata;
      const brand = getMetadataString(metadata, ["filter_brand", "brand", "legacy_brand"]);
      const category = getMetadataString(metadata, ["filter_category", "legacy_category", "category"]);

      if (brand) {
        coveredBrand += 1;
      } else if (missingBrandSamples.length < 50) {
        missingBrandSamples.push({
          id: product?.id ?? "",
          handle: product?.handle ?? "",
          title: product?.title ?? "",
        });
      }

      if (category) {
        coveredCategory += 1;
      } else if (missingCategorySamples.length < 50) {
        missingCategorySamples.push({
          id: product?.id ?? "",
          handle: product?.handle ?? "",
          title: product?.title ?? "",
        });
      }

      if (category) {
        const categoryKey = normalizeCategoryKey(category);
        const priorityCategory = priorityCategoriesMap.get(categoryKey);

        if (priorityCategory) {
          priorityCategory.scannedProducts += 1;
          if (brand) {
            priorityCategory.coveredBrand += 1;
          }
        }
      }
    }

    scannedProducts += products.length;
    offset += products.length;
    page += 1;

    if (products.length < pageLimit) {
      break;
    }
  }

  const missingBrand = Math.max(scannedProducts - coveredBrand, 0);
  const missingCategory = Math.max(scannedProducts - coveredCategory, 0);
  const brandCoveragePct = pct(coveredBrand, scannedProducts);
  const categoryCoveragePct = pct(coveredCategory, scannedProducts);

  const violations = [];
  if (scannedProducts < minProductsForGate) {
    violations.push(`products_below_min: ${scannedProducts} < ${minProductsForGate}`);
  }
  if (brandCoveragePct < minBrandCoveragePct) {
    violations.push(`brand_coverage_below_threshold: ${brandCoveragePct}% < ${minBrandCoveragePct}%`);
  }
  if (categoryCoveragePct < minCategoryCoveragePct) {
    violations.push(`category_coverage_below_threshold: ${categoryCoveragePct}% < ${minCategoryCoveragePct}%`);
  }

  const priorityCategories = [...priorityCategoriesMap.values()].map((item) => {
    const brandCoveragePct = pct(item.coveredBrand, item.scannedProducts);
    const violations = [];

    if (item.scannedProducts < priorityCategoryMinProducts) {
      violations.push(`products_below_min: ${item.scannedProducts} < ${priorityCategoryMinProducts}`);
    }
    if (brandCoveragePct < priorityCategoryMinCoveragePct) {
      violations.push(`brand_coverage_below_threshold: ${brandCoveragePct}% < ${priorityCategoryMinCoveragePct}%`);
    }

    return {
      label: item.label,
      scannedProducts: item.scannedProducts,
      coveredBrand: item.coveredBrand,
      missingBrand: Math.max(item.scannedProducts - item.coveredBrand, 0),
      brandCoveragePct,
      ok: violations.length === 0,
      violations,
    };
  });

  for (const item of priorityCategories) {
    for (const reason of item.violations) {
      violations.push(`priority_category_${item.label}: ${reason}`);
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    medusaUrl,
    thresholds: {
      minBrandCoveragePct,
      minCategoryCoveragePct,
      minProductsForGate,
      priorityCategoryMinCoveragePct,
      priorityCategoryMinProducts,
      priorityCategoryLabels,
    },
    totals: {
      scannedProducts,
      coveredBrand,
      missingBrand,
      coveredCategory,
      missingCategory,
      brandCoveragePct,
      categoryCoveragePct,
    },
    ok: violations.length === 0,
    violations,
    samples: {
      missingBrand: missingBrandSamples,
      missingCategory: missingCategorySamples,
    },
    priorityCategories,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "filter-metadata-coverage-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Filter Metadata Coverage Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Scanned products: ${payload.totals.scannedProducts}`,
    `- Brand coverage: ${payload.totals.brandCoveragePct}% (threshold ${payload.thresholds.minBrandCoveragePct}%)`,
    `- Category coverage: ${payload.totals.categoryCoveragePct}% (threshold ${payload.thresholds.minCategoryCoveragePct}%)`,
    `- Priority categories: ${payload.thresholds.priorityCategoryLabels.join(", ") || "none"}`,
    `- Priority category min brand coverage: ${payload.thresholds.priorityCategoryMinCoveragePct}%`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Violations",
    "",
    ...(payload.violations.length ? payload.violations.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Missing metadata samples",
    "",
    `- Missing brand sample size: ${payload.samples.missingBrand.length}`,
    `- Missing category sample size: ${payload.samples.missingCategory.length}`,
    "",
    "## Priority categories",
    "",
    "| Category | Products | Brand coverage | Missing brand | Result |",
    "| --- | ---: | ---: | ---: | --- |",
    ...payload.priorityCategories.map(
      (item) =>
        `| ${item.label} | ${item.scannedProducts} | ${item.brandCoveragePct}% | ${item.missingBrand} | ${item.ok ? "OK" : `FAIL (${item.violations.join("; ")})`} |`
    ),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "filter-metadata-coverage-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(
      `filter_metadata_coverage: status=FAIL, products=${scannedProducts}, brand=${brandCoveragePct}%, category=${categoryCoveragePct}%`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `filter_metadata_coverage: status=OK, products=${scannedProducts}, brand=${brandCoveragePct}%, category=${categoryCoveragePct}%`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});