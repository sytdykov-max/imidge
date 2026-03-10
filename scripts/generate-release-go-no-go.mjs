import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function safeReadJson(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

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
  const archiveDir = path.resolve(docsDir, "release-go-no-go");
  const now = new Date();
  const dateLabel = now.toISOString().slice(0, 10);

  const checkAll = safeReadJson(path.resolve(logsDir, "check-all-latest.json"));
  const kpi = safeReadJson(path.resolve(logsDir, "weekly-kpi-latest.json"));
  const rollup = safeReadJson(path.resolve(logsDir, "weekly-rollup-latest.json"));
  const policy = safeReadJson(path.resolve(logsDir, "seo-migration-policy-latest.json"));
  const probes = safeReadJson(path.resolve(logsDir, "ready-runtime-probes-latest.json"));
  const filterCoverage = safeReadJson(path.resolve(logsDir, "filter-metadata-coverage-latest.json"));

  const blockers = [];
  const warnings = [];

  if (!checkAll?.ok) blockers.push("check:all status is not OK");
  if (typeof kpi?.passRate !== "number" || kpi.passRate < 100) blockers.push("weekly pass rate is below 100%");
  if (policy?.violationsTotal !== 0) blockers.push("seo migration policy violations detected");
  if (policy?.missingFieldsTotal !== 0) blockers.push("seo migration manifest has missing required fields");
  if ((probes?.failed ?? 0) > (probes?.maxAllowedFailures ?? 0)) blockers.push("ready runtime probes exceed failure budget");
  if (filterCoverage?.ok === false) blockers.push("filter metadata coverage check is below threshold");

  if ((policy?.auditWarningsTotal ?? 0) > 0) warnings.push(`audit metadata warnings: ${policy.auditWarningsTotal}`);
  if (typeof checkAll?.totalElapsedMs === "number" && checkAll.totalElapsedMs > 60000) {
    warnings.push(`quality gate duration above 60s: ${checkAll.totalElapsedMs}ms`);
  }

  const decision = blockers.length === 0 ? "GO" : "NO-GO";

  const report = {
    generatedAt: now.toISOString(),
    decision,
    blockers,
    warnings,
    metrics: {
      checkAllOk: Boolean(checkAll?.ok),
      checkAllTotalMs: checkAll?.totalElapsedMs ?? null,
      passRate: kpi?.passRate ?? null,
      readyEntriesWithoutRuntimeOk: kpi?.readyEntriesWithoutRuntimeOk ?? null,
      policyViolationsTotal: policy?.violationsTotal ?? null,
      policyMissingFieldsTotal: policy?.missingFieldsTotal ?? null,
      policyAuditWarningsTotal: policy?.auditWarningsTotal ?? null,
      probesFailed: probes?.failed ?? null,
      probesSlow: probes?.slow ?? null,
      probesTotal: probes?.total ?? null,
      filterMetadataCoverageOk: filterCoverage?.ok ?? null,
      filterBrandCoveragePct: filterCoverage?.totals?.brandCoveragePct ?? null,
      filterCategoryCoveragePct: filterCoverage?.totals?.categoryCoveragePct ?? null,
      rollupOverallStatus: rollup?.summary?.overallStatus ?? null,
    },
    evidence: {
      checkAll: "logs/check-all-latest.json",
      weeklyKpi: "logs/weekly-kpi-latest.json",
      weeklyRollup: "logs/weekly-rollup-latest.json",
      seoPolicy: "logs/seo-migration-policy-latest.json",
      readyRuntimeProbes: "logs/ready-runtime-probes-latest.json",
      filterMetadataCoverage: "logs/filter-metadata-coverage-latest.json",
    },
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  mkdirSync(archiveDir, { recursive: true });

  const jsonPath = path.resolve(logsDir, "release-go-no-go-latest.json");
  const mdPath = path.resolve(docsDir, "release-go-no-go-latest.md");
  const archivePath = path.resolve(archiveDir, `${dateLabel}.md`);

  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const markdown = [
    "# Release Go/No-Go Summary",
    "",
    `- Generated at: ${report.generatedAt}`,
    `- Decision: ${report.decision}`,
    `- check:all OK: ${report.metrics.checkAllOk}`,
    `- Pass rate: ${report.metrics.passRate ?? "n/a"}%`,
    `- Gate total (ms): ${report.metrics.checkAllTotalMs ?? "n/a"}`,
    `- Policy violations: ${report.metrics.policyViolationsTotal ?? "n/a"}`,
    `- Runtime probe failures: ${report.metrics.probesFailed ?? "n/a"}`,
    `- Filter brand coverage: ${report.metrics.filterBrandCoveragePct ?? "n/a"}%`,
    `- Filter category coverage: ${report.metrics.filterCategoryCoveragePct ?? "n/a"}%`,
    "",
    "## Blockers",
    "",
    ...(report.blockers.length ? report.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Warnings",
    "",
    ...(report.warnings.length ? report.warnings.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Evidence",
    "",
    "- logs/check-all-latest.json",
    "- logs/weekly-kpi-latest.json",
    "- logs/weekly-rollup-latest.json",
    "- logs/seo-migration-policy-latest.json",
    "- logs/ready-runtime-probes-latest.json",
    "- logs/filter-metadata-coverage-latest.json",
    "",
  ].join("\n");

  writeFileSync(mdPath, `${markdown}\n`, "utf8");
  writeFileSync(archivePath, `${markdown}\n`, "utf8");

  console.log(`release_go_no_go: decision=${report.decision}, blockers=${report.blockers.length}, warnings=${report.warnings.length}`);

  if (report.decision !== "GO") {
    process.exitCode = 1;
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
