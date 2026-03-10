import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function readHistory(historyPath) {
  const raw = readFileSync(historyPath, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function average(values) {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => sum + value, 0);
  return Math.round((total / values.length) * 100) / 100;
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");
  const historyPath = path.resolve(logsDir, "check-all-history.jsonl");
  const kpiHistoryPath = path.resolve(logsDir, "weekly-kpi-history.jsonl");

  const history = readHistory(historyPath);
  const recentRuns = history.slice(-10);
  const passedRuns = recentRuns.filter((run) => run.ok).length;
  const passRate = recentRuns.length === 0 ? 0 : (passedRuns / recentRuns.length) * 100;

  const durations = recentRuns.map((run) => Number(run.totalElapsedMs) || 0);
  const avgDurationMs = average(durations);
  const minDurationMs = durations.length ? Math.min(...durations) : 0;
  const maxDurationMs = durations.length ? Math.max(...durations) : 0;

  const failuresByCheck = {};
  for (const run of recentRuns) {
    if (!run.ok && run.slowestCheck?.command) {
      const key = run.slowestCheck.command;
      failuresByCheck[key] = (failuresByCheck[key] ?? 0) + 1;
    }
  }

  const topFailureSources = Object.entries(failuresByCheck)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([command, count]) => ({ command, count }));

  const kpiHistory = existsSync(kpiHistoryPath) ? readHistory(kpiHistoryPath) : [];
  const recentKpiRuns = kpiHistory.slice(-10);
  const readyWithoutRuntimeSeries = recentKpiRuns.map((run) => Number(run.readyEntriesWithoutRuntimeOk ?? 0));
  const avgReadyWithoutRuntime = average(readyWithoutRuntimeSeries);
  const maxReadyWithoutRuntime = readyWithoutRuntimeSeries.length ? Math.max(...readyWithoutRuntimeSeries) : 0;

  const trend = {
    generatedAt: new Date().toISOString(),
    runsAnalyzed: recentRuns.length,
    passRate: Math.round(passRate * 100) / 100,
    avgDurationMs,
    minDurationMs,
    maxDurationMs,
    avgReadyWithoutRuntime,
    maxReadyWithoutRuntime,
    topFailureSources,
    latestRun: recentRuns[recentRuns.length - 1] ?? null,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "weekly-kpi-trends.json"), `${JSON.stringify(trend, null, 2)}\n`, "utf8");

  const markdown = [
    "# Weekly KPI Trends",
    "",
    `- Generated: ${trend.generatedAt}`,
    `- Runs analyzed: ${trend.runsAnalyzed}`,
    `- Pass rate: ${trend.passRate.toFixed(2)}%`,
    `- Avg duration: ${trend.avgDurationMs} ms`,
    `- Min/Max duration: ${trend.minDurationMs} / ${trend.maxDurationMs} ms`,
    `- Avg ready_entries_without_runtime_ok: ${trend.avgReadyWithoutRuntime}`,
    `- Max ready_entries_without_runtime_ok: ${trend.maxReadyWithoutRuntime}`,
    "",
    "## Top failure sources",
    "",
    ...(topFailureSources.length > 0
      ? topFailureSources.map((item, index) => `${index + 1}. ${item.command} — ${item.count}`)
      : ["1. none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "weekly-regression-trends.md"), `${markdown}\n`, "utf8");

  console.log(
    `weekly_kpi_trends: status=OK, runs=${trend.runsAnalyzed}, pass_rate=${trend.passRate.toFixed(2)}%`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}