import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function safeJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const coverage = safeJson(path.resolve(logsDir, "filter-metadata-coverage-latest.json"));
  const critical = safeJson(path.resolve(logsDir, "critical-facets-by-category-latest.json"));
  const consistency = safeJson(path.resolve(logsDir, "facet-consistency-latest.json"));
  const e2e = safeJson(path.resolve(logsDir, "check-catalog-filters-e2e-latest.json"));
  const perf = safeJson(path.resolve(logsDir, "check-catalog-filters-performance-latest.json"));
  const seo = safeJson(path.resolve(logsDir, "check-catalog-filters-seo-latest.json"));
  const drift = safeJson(path.resolve(logsDir, "facet-drift-latest.json"));

  const blockers = [];
  const warnings = [];

  if (!coverage?.ok) blockers.push("filter metadata coverage is not OK");
  if (!critical?.ok) blockers.push("critical facets by category check failed");
  if (!consistency?.ok) blockers.push("facet consistency check failed");
  if (!e2e?.ok) blockers.push("catalog filters e2e check failed");
  if (!perf?.ok) blockers.push("catalog filters performance check failed");
  if (!seo?.ok) blockers.push("catalog filters seo check failed");

  if (drift && drift.ok === false) {
    warnings.push("facet drift check reports degradation");
  }

  const decision = blockers.length === 0 ? "GO" : "NO-GO";

  const payload = {
    generatedAt: new Date().toISOString(),
    decision,
    blockers,
    warnings,
    metrics: {
      brandCoveragePct: coverage?.totals?.brandCoveragePct ?? null,
      categoryCoveragePct: coverage?.totals?.categoryCoveragePct ?? null,
      consistencyViolations: consistency?.violationsTotal ?? null,
      perfP95Ms: perf?.metrics?.p95 ?? null,
      seoOk: seo?.ok ?? null,
      e2eOk: e2e?.ok ?? null,
      driftOk: drift?.ok ?? null,
    },
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "filters-staging-go-no-go-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Filters Staging Go/No-Go",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Decision: ${payload.decision}`,
    `- Brand coverage: ${payload.metrics.brandCoveragePct ?? "n/a"}%`,
    `- Category coverage: ${payload.metrics.categoryCoveragePct ?? "n/a"}%`,
    `- Consistency violations: ${payload.metrics.consistencyViolations ?? "n/a"}`,
    `- Performance p95: ${payload.metrics.perfP95Ms ?? "n/a"} ms`,
    "",
    "## Blockers",
    "",
    ...(payload.blockers.length ? payload.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Warnings",
    "",
    ...(payload.warnings.length ? payload.warnings.map((item) => `- ${item}`) : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "filters-staging-go-no-go-latest.md"), `${markdown}\n`, "utf8");

  console.log(`filters_staging_go_no_go: decision=${decision}, blockers=${blockers.length}`);

  if (decision !== "GO") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
