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

function decisionFromGoNoGo(goNoGo) {
  if (!goNoGo || goNoGo.decision !== "GO") {
    return "NO-GO";
  }
  return "GO";
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");
  const ledgerDir = path.resolve(docsDir, "release-decisions");

  const today = new Date();
  const dateLabel = today.toISOString().slice(0, 10);

  const checkAll = safeReadJson(path.resolve(logsDir, "check-all-latest.json"));
  const kpi = safeReadJson(path.resolve(logsDir, "weekly-kpi-latest.json"));
  const policy = safeReadJson(path.resolve(logsDir, "seo-migration-policy-latest.json"));
  const probes = safeReadJson(path.resolve(logsDir, "ready-runtime-probes-latest.json"));
  const goNoGo = safeReadJson(path.resolve(logsDir, "release-go-no-go-latest.json"));
  const risks = safeReadJson(path.resolve(logsDir, "release-risk-register-latest.json"));
  const handoff = safeReadJson(path.resolve(logsDir, "release-handoff-latest.json"));

  const decision = decisionFromGoNoGo(goNoGo);
  const blockers = Array.isArray(goNoGo?.blockers) ? goNoGo.blockers : [];
  const warnings = Array.isArray(goNoGo?.warnings) ? goNoGo.warnings : [];
  const openRisks = risks?.openTotal ?? null;
  const monitorRisks = risks?.monitorTotal ?? null;

  const payload = {
    generatedAt: today.toISOString(),
    decision,
    goNoGoDecision: goNoGo?.decision ?? "NO-GO",
    blockersTotal: blockers.length,
    warningsTotal: warnings.length,
    openRisks,
    monitorRisks,
    metrics: {
      checkAllOk: checkAll?.ok ?? null,
      checkAllTotalMs: checkAll?.totalElapsedMs ?? null,
      passRate: kpi?.passRate ?? null,
      policyViolations: policy?.violationsTotal ?? null,
      policyAuditWarnings: policy?.auditWarningsTotal ?? null,
      runtimeProbeFailed: probes?.failed ?? null,
      runtimeProbeSlow: probes?.slow ?? null,
    },
    owners: Array.isArray(handoff?.owners) ? handoff.owners : [],
    blockers,
    warnings,
    evidence: {
      goNoGo: "logs/release-go-no-go-latest.json",
      riskRegister: "logs/release-risk-register-latest.json",
      handoff: "logs/release-handoff-latest.json",
      checkAll: "logs/check-all-latest.json",
      weeklyKpi: "logs/weekly-kpi-latest.json",
      seoPolicy: "logs/seo-migration-policy-latest.json",
      probes: "logs/ready-runtime-probes-latest.json",
    },
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });
  mkdirSync(ledgerDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "release-decision-ledger-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const ownerLines = payload.owners.length
    ? payload.owners.map((item) => `- ${item.owner}: [ ] Approved | Status=${item.status} | Signature: __________ | Timestamp: __________`)
    : [
        "- SEO: [ ] Approved | Signature: __________ | Timestamp: __________",
        "- Checkout: [ ] Approved | Signature: __________ | Timestamp: __________",
        "- Performance: [ ] Approved | Signature: __________ | Timestamp: __________",
        "- Release: [ ] Approved | Signature: __________ | Timestamp: __________",
      ];

  const markdown = [
    `# Release Decision Ledger — ${dateLabel}`,
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Decision: ${payload.decision}`,
    `- Source go/no-go decision: ${payload.goNoGoDecision}`,
    `- Blockers: ${payload.blockersTotal}`,
    `- Warnings: ${payload.warningsTotal}`,
    `- Open risks: ${payload.openRisks ?? "n/a"}`,
    `- Monitor risks: ${payload.monitorRisks ?? "n/a"}`,
    "",
    "## Sign-off matrix",
    "",
    ...ownerLines,
    "",
    "## Decision basis",
    "",
    `- check:all OK: ${payload.metrics.checkAllOk}`,
    `- check:all total elapsed (ms): ${payload.metrics.checkAllTotalMs ?? "n/a"}`,
    `- Pass rate: ${payload.metrics.passRate ?? "n/a"}%`,
    `- Policy violations: ${payload.metrics.policyViolations ?? "n/a"}`,
    `- Policy audit warnings: ${payload.metrics.policyAuditWarnings ?? "n/a"}`,
    `- Runtime probe failures: ${payload.metrics.runtimeProbeFailed ?? "n/a"}`,
    `- Runtime probe slow: ${payload.metrics.runtimeProbeSlow ?? "n/a"}`,
    "",
    "## Blockers",
    "",
    ...(payload.blockers.length ? payload.blockers.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Warnings",
    "",
    ...(payload.warnings.length ? payload.warnings.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Evidence",
    "",
    "- logs/release-go-no-go-latest.json",
    "- logs/release-risk-register-latest.json",
    "- logs/release-handoff-latest.json",
    "- logs/check-all-latest.json",
    "- logs/weekly-kpi-latest.json",
    "- logs/seo-migration-policy-latest.json",
    "- logs/ready-runtime-probes-latest.json",
    "",
    "## Notes",
    "",
    "- Release manager notes:",
    "- Rollback triggers:",
    "- Incident watch window:",
    "",
  ].join("\n");

  const latestMdPath = path.resolve(docsDir, "release-decision-ledger-latest.md");
  const datedMdPath = path.resolve(ledgerDir, `${dateLabel}.md`);

  writeFileSync(latestMdPath, `${markdown}\n`, "utf8");
  writeFileSync(datedMdPath, `${markdown}\n`, "utf8");

  console.log(`release_decision_ledger: status=OK, decision=${payload.decision}, blockers=${payload.blockersTotal}, warnings=${payload.warningsTotal}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
