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

function loadConfig(root) {
  return safeJson(path.resolve(root, "config/filters-rollout-v2.json")) ?? {
    version: "2.0.0",
    stages: [10, 50, 100],
    defaultStage: 10,
    rollbackRules: {
      minBrandCoveragePct: 95,
      minCategoryCoveragePct: 95,
      maxPerformanceP95Ms: 2000,
      requireSeoCheckOk: true,
      requireE2ECheckOk: true,
    },
  };
}

function nextStage(stages, current) {
  const sorted = [...stages].sort((a, b) => a - b);
  const next = sorted.find((value) => value > current);
  return next ?? current;
}

function previousStage(stages, current) {
  const sorted = [...stages].sort((a, b) => a - b);
  const lower = sorted.filter((value) => value < current);
  return lower.length ? lower[lower.length - 1] : current;
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const config = loadConfig(root);
  const rules = config.rollbackRules ?? {};

  const currentStage = Number(process.env.FILTERS_ROLLOUT_STAGE ?? config.defaultStage ?? 10);

  const coverage = safeJson(path.resolve(logsDir, "filter-metadata-coverage-latest.json"));
  const perf = safeJson(path.resolve(logsDir, "check-catalog-filters-performance-latest.json"));
  const seo = safeJson(path.resolve(logsDir, "check-catalog-filters-seo-latest.json"));
  const e2e = safeJson(path.resolve(logsDir, "check-catalog-filters-e2e-latest.json"));

  const violations = [];

  const brandCoverage = Number(coverage?.totals?.brandCoveragePct ?? 0);
  const categoryCoverage = Number(coverage?.totals?.categoryCoveragePct ?? 0);
  const perfP95 = Number(perf?.metrics?.p95 ?? Number.POSITIVE_INFINITY);

  if (brandCoverage < Number(rules.minBrandCoveragePct ?? 95)) {
    violations.push(`brand_coverage_below_threshold: ${brandCoverage}% < ${rules.minBrandCoveragePct}%`);
  }
  if (categoryCoverage < Number(rules.minCategoryCoveragePct ?? 95)) {
    violations.push(`category_coverage_below_threshold: ${categoryCoverage}% < ${rules.minCategoryCoveragePct}%`);
  }
  if (perfP95 > Number(rules.maxPerformanceP95Ms ?? 2000)) {
    violations.push(`performance_p95_above_threshold: ${perfP95}ms > ${rules.maxPerformanceP95Ms}ms`);
  }
  if (Boolean(rules.requireSeoCheckOk) && !Boolean(seo?.ok)) {
    violations.push("seo_check_failed");
  }
  if (Boolean(rules.requireE2ECheckOk) && !Boolean(e2e?.ok)) {
    violations.push("e2e_check_failed");
  }

  const shouldRollback = violations.length > 0;
  const decision = shouldRollback ? "rollback" : "proceed";
  const targetStage = shouldRollback
    ? previousStage(config.stages ?? [10, 50, 100], currentStage)
    : nextStage(config.stages ?? [10, 50, 100], currentStage);

  const payload = {
    generatedAt: new Date().toISOString(),
    configVersion: config.version,
    currentStage,
    targetStage,
    decision,
    shouldRollback,
    metrics: {
      brandCoverage,
      categoryCoverage,
      performanceP95Ms: perfP95,
      seoOk: Boolean(seo?.ok),
      e2eOk: Boolean(e2e?.ok),
    },
    violations,
    ok: !shouldRollback,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "filters-rollout-v2-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Filters Rollout V2 Decision",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Current stage: ${payload.currentStage}%`,
    `- Target stage: ${payload.targetStage}%`,
    `- Decision: ${payload.decision.toUpperCase()}`,
    "",
    "## Metrics",
    "",
    `- Brand coverage: ${payload.metrics.brandCoverage}%`,
    `- Category coverage: ${payload.metrics.categoryCoverage}%`,
    `- Performance p95: ${payload.metrics.performanceP95Ms} ms`,
    `- SEO check: ${payload.metrics.seoOk ? "OK" : "FAIL"}`,
    `- E2E check: ${payload.metrics.e2eOk ? "OK" : "FAIL"}`,
    "",
    "## Violations",
    "",
    ...(payload.violations.length ? payload.violations.map((item) => `- ${item}`) : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "filters-rollout-v2-latest.md"), `${markdown}\n`, "utf8");

  if (shouldRollback) {
    console.error(`filters_rollout_v2: decision=ROLLBACK, target_stage=${targetStage}`);
    process.exitCode = 1;
    return;
  }

  console.log(`filters_rollout_v2: decision=PROCEED, target_stage=${targetStage}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
