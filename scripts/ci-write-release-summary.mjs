import { appendFileSync, existsSync, readFileSync } from "node:fs";
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
    console.log("ci_release_summary: skipped (GITHUB_STEP_SUMMARY is not set)");
    return;
  }

  const goNoGo = safeReadJson(path.resolve(logsDir, "release-go-no-go-latest.json"));
  const risks = safeReadJson(path.resolve(logsDir, "release-risk-register-latest.json"));
  const handoff = safeReadJson(path.resolve(logsDir, "release-handoff-latest.json"));

  const markdown = [
    "## Release Decision Summary",
    "",
    `- decision: ${goNoGo?.decision ?? "NO-GO"}`,
    `- blockers: ${Array.isArray(goNoGo?.blockers) ? goNoGo.blockers.length : "n/a"}`,
    `- warnings: ${Array.isArray(goNoGo?.warnings) ? goNoGo.warnings.length : "n/a"}`,
    `- open risks: ${risks?.openTotal ?? "n/a"}`,
    `- high risks: ${risks?.highTotal ?? "n/a"}`,
    `- owner handoff decision: ${handoff?.releaseDecision ?? "n/a"}`,
    "",
  ].join("\n");

  appendFileSync(summaryFile, `${markdown}\n`, "utf8");
  console.log("ci_release_summary: written");
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
