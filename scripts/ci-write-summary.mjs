import { readFileSync, existsSync, appendFileSync } from "node:fs";
import path from "node:path";

function safeReadJson(filePath) {
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
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;

  if (!summaryFile) {
    console.log("ci_summary: skipped (GITHUB_STEP_SUMMARY is not set)");
    return;
  }

  const checkAll = safeReadJson(path.resolve(logsDir, "check-all-latest.json"));
  const kpi = safeReadJson(path.resolve(logsDir, "weekly-kpi-latest.json"));
  const trends = safeReadJson(path.resolve(logsDir, "weekly-kpi-trends.json"));
  const policy = safeReadJson(path.resolve(logsDir, "seo-migration-policy-latest.json"));
  const facetCoverage = safeReadJson(path.resolve(logsDir, "facet-coverage-latest.json"));

  const topProblematicCategories = Array.isArray(facetCoverage?.degradation?.topProblematicCategories)
    ? facetCoverage.degradation.topProblematicCategories
    : [];

  const markdown = [
    "## Nightly Quality Summary",
    "",
    `- check:all status: ${checkAll?.ok ? "OK" : "FAIL"}`,
    `- check:all total elapsed ms: ${checkAll?.totalElapsedMs ?? "n/a"}`,
    `- pass rate: ${kpi?.passRate ?? "n/a"}%`,
    `- trend pass rate (10 runs): ${trends?.passRate ?? "n/a"}%`,
    `- ready runtime violations: ${policy?.violationsTotal ?? "n/a"}`,
    "",
    "### Filter Degradation (Top-3)",
    "",
    ...(topProblematicCategories.length
      ? topProblematicCategories.map(
          (item, index) =>
            `${index + 1}. ${item.label} — products: ${item.products}, brand: ${item.brandCoveragePct}%, required facets: ${item.requiredFacetCoveragePct}%`
        )
      : ["- no degradation detected"]),
    "",
  ].join("\n");

  appendFileSync(summaryFile, `${markdown}\n`, "utf8");
  console.log("ci_summary: written");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
