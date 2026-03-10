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
const docsDir = path.resolve(root, "docs");
const logsDir = path.resolve(root, "logs");
const date = new Date().toISOString().slice(0, 10);

const quality = safeJson(path.resolve(logsDir, "check-all-latest.json"));
const probes = safeJson(path.resolve(logsDir, "ready-runtime-probes-latest.json"));
const seoPolicy = safeJson(path.resolve(logsDir, "seo-migration-policy-latest.json"));

const lines = [
  "# Wave 3 Closeout",
  "",
  `- Date: ${date}`,
  `- Quality status: ${quality?.overallStatus ?? "n/a"}`,
  `- Pass rate: ${quality?.passRate ?? "n/a"}`,
  `- Runtime probe failures: ${probes?.failedCount ?? probes?.failures ?? 0}`,
  `- SEO violations: ${seoPolicy?.violationsTotal ?? 0}`,
  "",
  "## Decision",
  "- Go / No-Go: TBD",
  "- Approvers: TBD",
  ""
];

mkdirSync(docsDir, { recursive: true });
writeFileSync(path.resolve(docsDir, "wave-3-closeout-latest.md"), `${lines.join("\n")}\n`, "utf8");
console.log("wave3_closeout: status=OK, target=docs/wave-3-closeout-latest.md");
