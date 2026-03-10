import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAllStoreProducts, getMetadataString } from "./facet-utils.mjs";

function requiredFacetIssues(metadata) {
  const issues = [];

  const checks = [
    ["filter_brand", "missing_brand"],
    ["filter_category", "missing_category"],
    ["filter_price_range", "missing_price_range"],
    ["filter_availability", "missing_availability"],
  ];

  for (const [facet, issue] of checks) {
    const value = metadata?.[facet];
    const ok = typeof value === "string" ? value.trim().length > 0 : value !== null && value !== undefined;
    if (!ok) {
      issues.push(issue);
    }
  }

  return issues;
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const { medusaUrl, products } = await fetchAllStoreProducts();

  const byCategory = new Map();

  for (const product of products) {
    const metadata = product?.metadata ?? {};
    const category = getMetadataString(metadata, ["filter_category", "legacy_category", "category"]) || "(missing)";

    if (!byCategory.has(category)) {
      byCategory.set(category, {
        total: 0,
        problematic: 0,
        issues: new Map(),
        samples: [],
      });
    }

    const row = byCategory.get(category);
    row.total += 1;

    const issues = requiredFacetIssues(metadata);
    if (issues.length > 0) {
      row.problematic += 1;

      for (const issue of issues) {
        row.issues.set(issue, (row.issues.get(issue) ?? 0) + 1);
      }

      if (row.samples.length < 20) {
        row.samples.push({
          id: product?.id ?? "",
          handle: product?.handle ?? "",
          title: product?.title ?? "",
          issues,
        });
      }
    }
  }

  const categories = [...byCategory.entries()]
    .map(([label, row]) => ({
      label,
      total: row.total,
      problematic: row.problematic,
      problemRatePct: row.total ? Math.round((row.problematic / row.total) * 10000) / 100 : 0,
      issues: [...row.issues.entries()].map(([issue, count]) => ({ issue, count })),
      samples: row.samples,
    }))
    .sort((a, b) => {
      if (a.problemRatePct !== b.problemRatePct) return b.problemRatePct - a.problemRatePct;
      return b.problematic - a.problematic;
    });

  const payload = {
    generatedAt: new Date().toISOString(),
    medusaUrl,
    productsTotal: products.length,
    categories,
    topProblematicCategories: categories.filter((item) => item.problematic > 0).slice(0, 10),
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "facet-diagnostics-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Facet Diagnostics",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Products total: ${payload.productsTotal}`,
    "",
    "## Top problematic categories",
    "",
    ...(payload.topProblematicCategories.length
      ? payload.topProblematicCategories.flatMap((category) => [
          `### ${category.label}`,
          `- Products: ${category.total}`,
          `- Problematic products: ${category.problematic}`,
          `- Problem rate: ${category.problemRatePct}%`,
          "- Issues:",
          ...(category.issues.length
            ? category.issues.map((issue) => `  - ${issue.issue}: ${issue.count}`)
            : ["  - none"]),
          "- Samples:",
          ...(category.samples.length
            ? category.samples.slice(0, 10).map((sample) => `  - ${sample.handle} | ${sample.issues.join(", ")}`)
            : ["  - none"]),
          "",
        ])
      : ["- none", ""]),
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "facet-diagnostics-latest.md"), `${markdown}\n`, "utf8");

  console.log(`facet_diagnostics: categories=${categories.length}, problematic=${payload.topProblematicCategories.length}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
