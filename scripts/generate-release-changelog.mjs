import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function safeJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

const root = process.cwd();
const logsDir = path.resolve(root, "logs");
const docsDir = path.resolve(root, "docs");
const dateLabel = new Date().toISOString().slice(0, 10);

const checkAll = safeJson(path.resolve(logsDir, "check-all-latest.json"));
const releaseLedger = safeJson(path.resolve(logsDir, "release-decision-ledger-latest.json"));

const lines = [
  "# Release Changelog",
  "",
  `- Date: ${dateLabel}`,
  `- Quality status: ${checkAll?.overallStatus ?? "n/a"}`,
  `- Passed checks: ${checkAll?.passedChecks ?? "n/a"}`,
  `- Failed checks: ${checkAll?.failedChecks ?? "n/a"}`,
  `- Decision: ${releaseLedger?.decision ?? "n/a"}`,
  "",
  "## Notes",
  "- Auto-generated from latest quality and release artifacts.",
  ""
];

mkdirSync(docsDir, { recursive: true });
writeFileSync(path.resolve(docsDir, "release-changelog-latest.md"), `${lines.join("\n")}\n`, "utf8");
console.log("release_changelog: status=OK, target=docs/release-changelog-latest.md");
