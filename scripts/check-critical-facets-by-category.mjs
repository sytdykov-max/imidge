import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAllStoreProducts, getMetadataString, toPct } from "./facet-utils.mjs";

function loadThresholds(root) {
  const filePath = path.resolve(root, "config/critical-facet-thresholds.json");
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function hasFacet(metadata, facet) {
  if (!metadata || typeof metadata !== "object") return false;
  const value = metadata[facet];
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "boolean") return true;
  return value !== null && value !== undefined;
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const thresholds = loadThresholds(root);
  const categories = Array.isArray(thresholds.categories) ? thresholds.categories : [];
  const requiredFacets = Array.isArray(thresholds.requiredFacets) ? thresholds.requiredFacets : [];
  const defaultMinCoveragePct = Number(thresholds.defaultThresholds?.minCoveragePct ?? 95);
  const defaultMinProducts = Number(thresholds.defaultThresholds?.minProducts ?? 100);

  const { medusaUrl, products } = await fetchAllStoreProducts();

  const categoryResults = categories.map((categoryRule) => {
    const categoryProducts = products.filter((product) => {
      const category = getMetadataString(product?.metadata, ["filter_category", "legacy_category", "category"]);
      return category === categoryRule.label;
    });

    const facetCoverage = requiredFacets.map((facet) => {
      const present = categoryProducts.filter((product) => hasFacet(product?.metadata, facet)).length;
      return {
        facet,
        present,
        missing: Math.max(categoryProducts.length - present, 0),
        coveragePct: toPct(present, categoryProducts.length),
      };
    });

    const minCoveragePct = Number(categoryRule.minCoveragePct ?? defaultMinCoveragePct);
    const minProducts = Number(categoryRule.minProducts ?? defaultMinProducts);

    const violations = [];
    if (categoryProducts.length < minProducts) {
      violations.push(`products_below_min: ${categoryProducts.length} < ${minProducts}`);
    }

    for (const row of facetCoverage) {
      if (row.coveragePct < minCoveragePct) {
        violations.push(`${row.facet}_below_threshold: ${row.coveragePct}% < ${minCoveragePct}%`);
      }
    }

    return {
      category: categoryRule.label,
      total: categoryProducts.length,
      minCoveragePct,
      minProducts,
      facetCoverage,
      ok: violations.length === 0,
      violations,
    };
  });

  const violations = categoryResults.flatMap((row) => row.violations.map((item) => `${row.category}: ${item}`));

  const payload = {
    generatedAt: new Date().toISOString(),
    medusaUrl,
    requiredFacets,
    defaultThresholds: {
      minCoveragePct: defaultMinCoveragePct,
      minProducts: defaultMinProducts,
    },
    categories: categoryResults,
    violations,
    ok: violations.length === 0,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "critical-facets-by-category-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Critical Facets by Category Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Categories",
    "",
    ...categoryResults.flatMap((row) => [
      `### ${row.category}`,
      `- Products: ${row.total}`,
      `- Min coverage threshold: ${row.minCoveragePct}%`,
      `- Min products threshold: ${row.minProducts}`,
      `- Result: ${row.ok ? "OK" : "FAIL"}`,
      "",
      "| Facet | Present | Missing | Coverage |",
      "| --- | ---: | ---: | ---: |",
      ...row.facetCoverage.map((facet) => `| ${facet.facet} | ${facet.present} | ${facet.missing} | ${facet.coveragePct}% |`),
      "",
      ...(
        row.violations.length
          ? ["Violations:", ...row.violations.map((item) => `- ${item}`), ""]
          : ["Violations: none", ""]
      ),
    ]),
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "critical-facets-by-category-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`critical_facets_by_category: status=FAIL, violations=${violations.length}`);
    process.exitCode = 1;
    return;
  }

  console.log(`critical_facets_by_category: status=OK, categories=${categoryResults.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
