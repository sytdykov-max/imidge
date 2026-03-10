import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveQualityThresholds } from "./lib-quality-thresholds.mjs";

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const policyPath = path.resolve(logsDir, "seo-migration-policy-latest.json");
  const thresholds = resolveQualityThresholds(root);

  const policy = JSON.parse(readFileSync(policyPath, "utf8"));
  const violations = Number(policy.violationsTotal ?? 0);

  console.log(`light_threshold_profile: ${thresholds.profile}`);
  console.log(
    `light_threshold_ready_runtime_violations: actual=${violations}, limit=${thresholds.MAX_READY_RUNTIME_VIOLATIONS}`
  );

  if (violations > thresholds.MAX_READY_RUNTIME_VIOLATIONS) {
    console.error(
      `Light threshold violation: ready_entries_without_runtime_ok=${violations} > ${thresholds.MAX_READY_RUNTIME_VIOLATIONS}`
    );
    process.exitCode = 1;
    return;
  }

  console.log("regression_thresholds_light: status=OK");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
