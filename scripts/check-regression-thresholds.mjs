import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveQualityThresholds } from "./lib-quality-thresholds.mjs";

function main() {
  const root = process.cwd();
  const summaryPath = path.resolve(root, "logs", "check-all-latest.json");
  const weeklyKpiPath = path.resolve(root, "logs", "weekly-kpi-latest.json");
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  const weeklyKpi = JSON.parse(readFileSync(weeklyKpiPath, "utf8"));
  const thresholds = resolveQualityThresholds(root);

  const checks = Array.isArray(summary.checks) ? summary.checks : [];
  const passed = checks.filter((check) => check.status === 0).length;
  const passRate = checks.length === 0 ? 0 : (passed / checks.length) * 100;
  const slowChecks = checks.filter((check) => (check.elapsedMs ?? 0) > thresholds.MAX_SINGLE_CHECK_MS);

  console.log(`threshold_profile: ${thresholds.profile}`);

  console.log(`threshold_gate_total: total_ms=${summary.totalElapsedMs}, limit_ms=${thresholds.MAX_GATE_MS}`);
  console.log(
    `threshold_pass_rate: pass_rate=${passRate.toFixed(2)}%, min_required=${thresholds.MIN_PASS_RATE.toFixed(2)}%`
  );
  console.log(
    `threshold_slowest_checks: count=${slowChecks.length}, limit_ms=${thresholds.MAX_SINGLE_CHECK_MS}, offenders=${
      slowChecks.map((item) => `${item.command}:${item.elapsedMs}`).join(";") || "none"
    }`
  );
  console.log(
    `threshold_ready_runtime_violations: actual=${weeklyKpi.readyEntriesWithoutRuntimeOk ?? "n/a"}, limit=${thresholds.MAX_READY_RUNTIME_VIOLATIONS}`
  );

  if ((summary.totalElapsedMs ?? 0) > thresholds.MAX_GATE_MS) {
    console.error(`Gate duration threshold exceeded: ${summary.totalElapsedMs} > ${thresholds.MAX_GATE_MS}`);
    process.exitCode = 1;
    return;
  }

  if (passRate < thresholds.MIN_PASS_RATE) {
    console.error(`Pass rate threshold violated: ${passRate.toFixed(2)} < ${thresholds.MIN_PASS_RATE.toFixed(2)}`);
    process.exitCode = 1;
    return;
  }

  if (slowChecks.length > 0) {
    console.error(`Found ${slowChecks.length} checks slower than ${thresholds.MAX_SINGLE_CHECK_MS} ms`);
    process.exitCode = 1;
    return;
  }

  const readyViolations = Number(weeklyKpi.readyEntriesWithoutRuntimeOk ?? 0);
  if (readyViolations > thresholds.MAX_READY_RUNTIME_VIOLATIONS) {
    console.error(
      `Policy threshold violated: ready_entries_without_runtime_ok=${readyViolations} > ${thresholds.MAX_READY_RUNTIME_VIOLATIONS}`
    );
    process.exitCode = 1;
    return;
  }

  console.log("regression_thresholds: status=OK");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}