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

const checkAll = safeJson(path.resolve(logsDir, "check-all-latest.json"));
const probes = safeJson(path.resolve(logsDir, "ready-runtime-probes-latest.json"));
const seoPolicy = safeJson(path.resolve(logsDir, "seo-migration-policy-latest.json"));

const payload = {
  generatedAt: new Date().toISOString(),
  qualityStatus: checkAll?.overallStatus ?? "n/a",
  passRate: checkAll?.passRate ?? null,
  readyProbeFailures: probes?.failedCount ?? probes?.failures ?? 0,
  seoViolations: seoPolicy?.violationsTotal ?? 0,
};

mkdirSync(logsDir, { recursive: true });
mkdirSync(docsDir, { recursive: true });
writeFileSync(path.resolve(logsDir, "release-health-dashboard-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
writeFileSync(path.resolve(docsDir, "release-health-dashboard-latest.md"), `# Release Health Dashboard\n\n- Generated: ${payload.generatedAt}\n- Quality status: ${payload.qualityStatus}\n- Pass rate: ${payload.passRate ?? "n/a"}\n- Ready probe failures: ${payload.readyProbeFailures}\n- SEO violations: ${payload.seoViolations}\n`, "utf8");

console.log("release_health_dashboard: status=OK");
