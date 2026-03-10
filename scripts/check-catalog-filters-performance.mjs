import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";
const maxResponseMs = Number(process.env.CATALOG_FILTERS_MAX_RESPONSE_MS ?? 2500);
const p95BudgetMs = Number(process.env.CATALOG_FILTERS_P95_BUDGET_MS ?? 2000);

const probes = [
  `${baseUrl}/catalog`,
  `${baseUrl}/catalog?cat=%D0%A7%D0%B0%D1%81%D1%8B`,
  `${baseUrl}/catalog?brand=Hublot`,
  `${baseUrl}/catalog?price=100_300`,
  `${baseUrl}/catalog?cat=%D0%A7%D0%B0%D1%81%D1%8B&brand=Hublot&price=100_300`,
  `${baseUrl}/catalog?page=2&cat=%D0%A7%D0%B0%D1%81%D1%8B`,
  `${baseUrl}/catalog?page=11&cat=%D0%A7%D0%B0%D1%81%D1%8B`,
];

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  const rows = [];

  for (const url of probes) {
    const startedAt = Date.now();
    const response = await fetch(url, { cache: "no-store" });
    await response.text();
    const elapsedMs = Date.now() - startedAt;

    rows.push({
      url,
      status: response.status,
      elapsedMs,
      ok: response.status === 200 && elapsedMs <= maxResponseMs,
    });
  }

  const elapsed = rows.map((row) => row.elapsedMs);
  const p95 = percentile(elapsed, 95);
  const p50 = percentile(elapsed, 50);

  const violations = [];
  for (const row of rows) {
    if (!row.ok) {
      violations.push(`${row.url} status=${row.status} elapsed=${row.elapsedMs}ms (limit ${maxResponseMs}ms)`);
    }
  }

  if (p95 > p95BudgetMs) {
    violations.push(`p95_above_budget: ${p95}ms > ${p95BudgetMs}ms`);
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    limits: {
      maxResponseMs,
      p95BudgetMs,
    },
    metrics: {
      p50,
      p95,
      max: elapsed.length ? Math.max(...elapsed) : 0,
      min: elapsed.length ? Math.min(...elapsed) : 0,
      avg: elapsed.length ? Math.round((elapsed.reduce((sum, value) => sum + value, 0) / elapsed.length) * 100) / 100 : 0,
    },
    total: rows.length,
    violations,
    ok: violations.length === 0,
    rows,
  };

  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "check-catalog-filters-performance-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Catalog Filters Performance Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Base URL: ${payload.baseUrl}`,
    `- p50: ${payload.metrics.p50} ms`,
    `- p95: ${payload.metrics.p95} ms (budget ${payload.limits.p95BudgetMs} ms)`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Violations",
    "",
    ...(payload.violations.length ? payload.violations.map((item) => `- ${item}`) : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "check-catalog-filters-performance-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`catalog_filters_performance: status=FAIL, violations=${payload.violations.length}`);
    process.exitCode = 1;
    return;
  }

  console.log(`catalog_filters_performance: status=OK, p95=${payload.metrics.p95}ms`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
