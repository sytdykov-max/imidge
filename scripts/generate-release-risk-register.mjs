import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function safeReadJson(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function addRisk(risks, input) {
  risks.push({
    id: input.id,
    title: input.title,
    severity: input.severity,
    owner: input.owner,
    status: input.status,
    evidence: input.evidence,
    value: input.value ?? null,
    threshold: input.threshold ?? null,
    action: input.action,
  });
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const checkAll = safeReadJson(path.resolve(logsDir, "check-all-latest.json"));
  const kpi = safeReadJson(path.resolve(logsDir, "weekly-kpi-latest.json"));
  const trends = safeReadJson(path.resolve(logsDir, "weekly-kpi-trends.json"));
  const policy = safeReadJson(path.resolve(logsDir, "seo-migration-policy-latest.json"));
  const probes = safeReadJson(path.resolve(logsDir, "ready-runtime-probes-latest.json"));

  const risks = [];

  addRisk(risks, {
    id: "RISK-001",
    title: "Quality gate overall status",
    severity: checkAll?.ok ? "low" : "high",
    owner: "release",
    status: checkAll?.ok ? "closed" : "open",
    evidence: "logs/check-all-latest.json",
    value: checkAll?.ok,
    threshold: true,
    action: "Run check:all and resolve failed checks before release",
  });

  const passRate = kpi?.passRate;
  addRisk(risks, {
    id: "RISK-002",
    title: "Pass rate degradation",
    severity: typeof passRate === "number" && passRate >= 100 ? "low" : "high",
    owner: "release",
    status: typeof passRate === "number" && passRate >= 100 ? "closed" : "open",
    evidence: "logs/weekly-kpi-latest.json",
    value: passRate ?? null,
    threshold: 100,
    action: "Investigate failed checks and recover pass rate to 100%",
  });

  const gateMs = checkAll?.totalElapsedMs;
  addRisk(risks, {
    id: "RISK-003",
    title: "Quality gate duration regression",
    severity: typeof gateMs === "number" && gateMs > 60000 ? "medium" : "low",
    owner: "perf",
    status: typeof gateMs === "number" && gateMs > 60000 ? "monitor" : "closed",
    evidence: "logs/check-all-latest.json",
    value: gateMs ?? null,
    threshold: 60000,
    action: "Profile slow checks and optimize top duration contributors",
  });

  const policyViolations = policy?.violationsTotal;
  addRisk(risks, {
    id: "RISK-004",
    title: "SEO migration policy violations",
    severity: typeof policyViolations === "number" && policyViolations === 0 ? "low" : "high",
    owner: "seo",
    status: typeof policyViolations === "number" && policyViolations === 0 ? "closed" : "open",
    evidence: "logs/seo-migration-policy-latest.json",
    value: policyViolations ?? null,
    threshold: 0,
    action: "Fix status=ready entries that are not runtime validated",
  });

  const auditWarnings = policy?.auditWarningsTotal;
  addRisk(risks, {
    id: "RISK-005",
    title: "SEO audit metadata quality",
    severity: typeof auditWarnings === "number" && auditWarnings === 0 ? "low" : "medium",
    owner: "seo",
    status: typeof auditWarnings === "number" && auditWarnings === 0 ? "closed" : "monitor",
    evidence: "logs/seo-migration-policy-latest.json",
    value: auditWarnings ?? null,
    threshold: 0,
    action: "Fill owner/ticket/approvedAt for all ready migration entries",
  });

  const failedProbes = probes?.failed;
  addRisk(risks, {
    id: "RISK-006",
    title: "Runtime probe failures",
    severity: typeof failedProbes === "number" && failedProbes === 0 ? "low" : "high",
    owner: "platform",
    status: typeof failedProbes === "number" && failedProbes === 0 ? "closed" : "open",
    evidence: "logs/ready-runtime-probes-latest.json",
    value: failedProbes ?? null,
    threshold: 0,
    action: "Restore availability for failing ready routes",
  });

  const slowProbes = probes?.slow;
  addRisk(risks, {
    id: "RISK-007",
    title: "Runtime probe latency budget",
    severity: typeof slowProbes === "number" && slowProbes === 0 ? "low" : "medium",
    owner: "perf",
    status: typeof slowProbes === "number" && slowProbes === 0 ? "closed" : "monitor",
    evidence: "logs/ready-runtime-probes-latest.json",
    value: slowProbes ?? null,
    threshold: 0,
    action: "Investigate latency spikes for ready URLs",
  });

  const trendReadyWithoutRuntime = trends?.avgReadyWithoutRuntime;
  addRisk(risks, {
    id: "RISK-008",
    title: "Historical runtime coverage drift",
    severity:
      typeof trendReadyWithoutRuntime === "number" && trendReadyWithoutRuntime > 0 ? "medium" : "low",
    owner: "seo",
    status: typeof trendReadyWithoutRuntime === "number" && trendReadyWithoutRuntime > 0 ? "monitor" : "closed",
    evidence: "logs/weekly-kpi-trends.json",
    value: trendReadyWithoutRuntime ?? null,
    threshold: 0,
    action: "Keep runtime_ok coverage at 100% for ready entries over time",
  });

  const severityRank = { high: 3, medium: 2, low: 1 };
  const sortedRisks = [...risks].sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || a.id.localeCompare(b.id));

  const payload = {
    generatedAt: new Date().toISOString(),
    total: sortedRisks.length,
    openTotal: sortedRisks.filter((item) => item.status === "open").length,
    monitorTotal: sortedRisks.filter((item) => item.status === "monitor").length,
    highTotal: sortedRisks.filter((item) => item.severity === "high").length,
    mediumTotal: sortedRisks.filter((item) => item.severity === "medium").length,
    lowTotal: sortedRisks.filter((item) => item.severity === "low").length,
    risks: sortedRisks,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "release-risk-register-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Release Risk Register",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Risks total: ${payload.total}`,
    `- Open: ${payload.openTotal}`,
    `- Monitor: ${payload.monitorTotal}`,
    `- High/Medium/Low: ${payload.highTotal}/${payload.mediumTotal}/${payload.lowTotal}`,
    "",
    "## Risks",
    "",
    "| ID | Severity | Status | Owner | Title | Value | Threshold | Evidence | Action |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    ...payload.risks.map(
      (item) =>
        `| ${item.id} | ${item.severity} | ${item.status} | ${item.owner} | ${item.title} | ${item.value ?? "-"} | ${item.threshold ?? "-"} | ${item.evidence} | ${item.action} |`
    ),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "release-risk-register-latest.md"), `${markdown}\n`, "utf8");

  console.log(`release_risk_register: status=OK, total=${payload.total}, open=${payload.openTotal}, monitor=${payload.monitorTotal}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
