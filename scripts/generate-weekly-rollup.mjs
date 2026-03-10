import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function safeReadJson(filePath) {
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
  const archiveDir = path.resolve(docsDir, "weekly-regression-rollup");

  const kpi = safeReadJson(path.resolve(logsDir, "weekly-kpi-latest.json"));
  const trends = safeReadJson(path.resolve(logsDir, "weekly-kpi-trends.json"));
  const policy = safeReadJson(path.resolve(logsDir, "seo-migration-policy-latest.json"));

  const today = new Date();
  const dateLabel = today.toISOString().slice(0, 10);

  const payload = {
    generatedAt: today.toISOString(),
    kpi,
    trends,
    policy,
    summary: {
      overallStatus: kpi?.overallStatus ?? "n/a",
      passRate: kpi?.passRate ?? null,
      gateTotalMs: kpi?.totalDurationMs ?? null,
      trendPassRate: trends?.passRate ?? null,
      readyRuntimeViolations: policy?.violationsTotal ?? null,
    },
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  mkdirSync(archiveDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "weekly-rollup-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Weekly Regression Rollup",
    "",
    `- Generated: ${payload.generatedAt}`,
    `- Overall status: ${payload.summary.overallStatus}`,
    `- Pass rate: ${payload.summary.passRate ?? "n/a"}`,
    `- Gate total (ms): ${payload.summary.gateTotalMs ?? "n/a"}`,
    `- Trend pass rate: ${payload.summary.trendPassRate ?? "n/a"}`,
    `- Ready runtime violations: ${payload.summary.readyRuntimeViolations ?? "n/a"}`,
    "",
    "## Inputs",
    "",
    `- weekly-kpi-latest.json: ${kpi ? "present" : "missing"}`,
    `- weekly-kpi-trends.json: ${trends ? "present" : "missing"}`,
    `- seo-migration-policy-latest.json: ${policy ? "present" : "missing"}`,
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "weekly-regression-rollup-latest.md"), `${markdown}\n`, "utf8");
  writeFileSync(path.resolve(archiveDir, `${dateLabel}.md`), `${markdown}\n`, "utf8");

  console.log(`weekly_rollup: status=OK, archive=${dateLabel}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
