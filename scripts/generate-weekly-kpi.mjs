import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function median(values) {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  return sorted[middle];
}

function getIsoWeek(date) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utcDate - yearStart) / 86400000 + 1) / 7);
  return { year: utcDate.getUTCFullYear(), week: weekNo };
}

function parseCheckAllLog(logText) {
  const catalogSpeedMatch = logText.match(/Summary:\s*avg=([\d.]+)\s*ms,\s*max=([\d.]+)\s*ms/i);
  const mojibakeMatch = logText.match(/Suspected mojibake products:\s*(\d+)/i);

  return {
    catalogAvgMs: catalogSpeedMatch ? Number(catalogSpeedMatch[1]) : null,
    catalogMaxMs: catalogSpeedMatch ? Number(catalogSpeedMatch[2]) : null,
    mojibakeSuspects: mojibakeMatch ? Number(mojibakeMatch[1]) : null,
    searchEquivalenceOk: /BMW vs БМВ:.*-> OK/i.test(logText) && /BMW X5 vs БМВ Х5:.*-> OK/i.test(logText),
    addToCartOk:
      /valid_variant:\s*status=200.*item=OK/i.test(logText) &&
      /repeat_variant:.*expected_ge_2=OK/i.test(logText) &&
      /invalid_variant:.*expected_error=OK/i.test(logText),
    checkoutSmokeOk: /order_complete:.*order=OK/i.test(logText) && /success_page:.*ok=OK/i.test(logText),
  };
}

function formatPercent(value) {
  return `${value.toFixed(2)}%`;
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");
  const summaryPath = path.resolve(logsDir, "check-all-latest.json");
  const logPath = path.resolve(logsDir, "check-all-latest.log");
  const policyPath = path.resolve(logsDir, "seo-migration-policy-latest.json");

  const summaryRaw = readFileSync(summaryPath, "utf8");
  const summary = JSON.parse(summaryRaw);
  const logText = readFileSync(logPath, "utf8");

  const checks = Array.isArray(summary.checks) ? summary.checks : [];
  const totalChecks = checks.length;
  const passedChecks = checks.filter((check) => check.status === 0).length;
  const failedChecks = checks.filter((check) => check.status !== 0);
  const passRate = totalChecks === 0 ? 0 : (passedChecks / totalChecks) * 100;
  const durations = checks.map((check) => Number(check.elapsedMs) || 0);
  const medianDurationMs = median(durations);
  const slowestChecks = [...checks]
    .sort((left, right) => (right.elapsedMs ?? 0) - (left.elapsedMs ?? 0))
    .slice(0, 3)
    .map((check) => ({
      command: check.command,
      elapsedMs: check.elapsedMs,
    }));

  const parsedLog = parseCheckAllLog(logText);
  const policySummary = existsSync(policyPath) ? JSON.parse(readFileSync(policyPath, "utf8")) : null;
  const now = new Date();
  const isoWeek = getIsoWeek(now);
  const weekLabel = `${isoWeek.year}-W${String(isoWeek.week).padStart(2, "0")}`;

  const overallStatus = summary.ok ? "OK" : "FAIL";
  const kpi = {
    generatedAt: now.toISOString(),
    week: weekLabel,
    overallStatus,
    totalChecks,
    passedChecks,
    failedChecks: failedChecks.map((check) => check.command),
    passRate,
    totalDurationMs: summary.totalElapsedMs ?? 0,
    medianDurationMs,
    slowestChecks,
    catalogAvgMs: parsedLog.catalogAvgMs,
    catalogMaxMs: parsedLog.catalogMaxMs,
    mojibakeSuspects: parsedLog.mojibakeSuspects,
    searchEquivalenceOk: parsedLog.searchEquivalenceOk,
    addToCartOk: parsedLog.addToCartOk,
    checkoutSmokeOk: parsedLog.checkoutSmokeOk,
    readyEntriesWithoutRuntimeOk: policySummary ? Number(policySummary.violationsTotal ?? 0) : null,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  const markdown = [
    "# Weekly Regression Report (Auto)",
    "",
    `- Week: ${weekLabel}`,
    "- Environment: local/CI (check-all latest)",
    "- Owner: QA Automation",
    "",
    "## Summary",
    "",
    `- Overall status (\`OK\` / \`WARN\` / \`FAIL\`): ${overallStatus}`,
    `- Pass rate: ${formatPercent(passRate)} (${passedChecks}/${totalChecks})`,
    `- Median gate duration: ${medianDurationMs} ms`,
    `- Failed checks: ${failedChecks.length === 0 ? "none" : failedChecks.map((check) => check.command).join(", ")}`,
    "",
    "## Key metrics",
    "",
    `- \`check:all\` total duration (ms): ${summary.totalElapsedMs ?? 0}`,
    `- Catalog speed avg/max (ms): ${
      parsedLog.catalogAvgMs === null || parsedLog.catalogMaxMs === null
        ? "n/a"
        : `${parsedLog.catalogAvgMs} / ${parsedLog.catalogMaxMs}`
    }`,
    `- Mojibake suspects count: ${parsedLog.mojibakeSuspects ?? "n/a"}`,
    `- Search equivalence pass/fail: ${parsedLog.searchEquivalenceOk ? "pass" : "fail"}`,
    `- Add-to-cart pass/fail: ${parsedLog.addToCartOk ? "pass" : "fail"}`,
    `- Checkout smoke pass/fail: ${parsedLog.checkoutSmokeOk ? "pass" : "fail"}`,
    `- Ready entries without runtime_ok=true: ${kpi.readyEntriesWithoutRuntimeOk ?? "n/a"}`,
    "",
    "## Slowest checks (top 3)",
    "",
    ...slowestChecks.map((check, index) => `${index + 1}. ${check.command} — ${check.elapsedMs} ms`),
    "",
  ].join("\n");

  writeFileSync(path.resolve(logsDir, "weekly-kpi-latest.json"), `${JSON.stringify(kpi, null, 2)}\n`, "utf8");
  appendFileSync(path.resolve(logsDir, "weekly-kpi-history.jsonl"), `${JSON.stringify(kpi)}\n`, "utf8");
  writeFileSync(path.resolve(docsDir, "weekly-regression-report-latest.md"), `${markdown}\n`, "utf8");

  console.log(`weekly_kpi: status=OK, week=${weekLabel}, pass_rate=${formatPercent(passRate)}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}