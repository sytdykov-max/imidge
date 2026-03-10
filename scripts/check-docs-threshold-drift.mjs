import { readFileSync } from "node:fs";
import path from "node:path";
import { resolveQualityThresholds } from "./lib-quality-thresholds.mjs";

function assertIncludes(content, needle, fileLabel) {
  if (!content.includes(needle)) {
    throw new Error(`Docs drift: missing \"${needle}\" in ${fileLabel}`);
  }
}

function assertAnyIncludes(content, needles, fileLabel) {
  if (!needles.some((needle) => content.includes(needle))) {
    throw new Error(`Docs drift: none of expected patterns found in ${fileLabel}: ${needles.join(" | ")}`);
  }
}

function main() {
  const root = process.cwd();
  const thresholds = resolveQualityThresholds(root);

  const readmePath = path.resolve(root, "README.md");
  const runbookPath = path.resolve(root, "docs", "runbook-quality-gate.md");
  const readme = readFileSync(readmePath, "utf8");
  const runbook = readFileSync(runbookPath, "utf8");

  const readmeDefaults = [
    `MAX_GATE_MS\` (default \`${thresholds.MAX_GATE_MS}\`)`,
    `MAX_SINGLE_CHECK_MS\` (default \`${thresholds.MAX_SINGLE_CHECK_MS}\`)`,
    `MIN_PASS_RATE\` (default \`${thresholds.MIN_PASS_RATE}\`)`,
    `MAX_READY_RUNTIME_VIOLATIONS\` (default \`${thresholds.MAX_READY_RUNTIME_VIOLATIONS}\`)`,
  ];

  const runbookDefaults = [
    [`MAX_GATE_MS\` (default \`${thresholds.MAX_GATE_MS}\`)`, `MAX_GATE_MS\` (по умолчанию \`${thresholds.MAX_GATE_MS}\`)`],
    [
      `MAX_SINGLE_CHECK_MS\` (default \`${thresholds.MAX_SINGLE_CHECK_MS}\`)`,
      `MAX_SINGLE_CHECK_MS\` (по умолчанию \`${thresholds.MAX_SINGLE_CHECK_MS}\`)`,
    ],
    [`MIN_PASS_RATE\` (default \`${thresholds.MIN_PASS_RATE}\`)`, `MIN_PASS_RATE\` (по умолчанию \`${thresholds.MIN_PASS_RATE}\`)`],
    [
      `MAX_READY_RUNTIME_VIOLATIONS\` (default \`${thresholds.MAX_READY_RUNTIME_VIOLATIONS}\`)`,
      `MAX_READY_RUNTIME_VIOLATIONS\` (по умолчанию \`${thresholds.MAX_READY_RUNTIME_VIOLATIONS}\`)`,
    ],
  ];

  for (const item of readmeDefaults) {
    assertIncludes(readme, item, "README.md");
  }

  for (const options of runbookDefaults) {
    assertAnyIncludes(runbook, options, "docs/runbook-quality-gate.md");
  }

  console.log(`docs_threshold_drift: status=OK, profile=${thresholds.profile}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
