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

function ownerStatus(metrics, owner) {
  if (owner === "seo") {
    return metrics.policyViolations === 0 && metrics.auditWarnings === 0 && metrics.runtimeFailed === 0 ? "ready" : "attention";
  }

  if (owner === "checkout") {
    return metrics.checkoutChecksFailed === 0 ? "ready" : "attention";
  }

  if (owner === "perf") {
    return metrics.gateTotalMs <= 60000 && metrics.runtimeSlow === 0 ? "ready" : "attention";
  }

  return metrics.releaseDecision === "GO" ? "ready" : "attention";
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const checkAll = safeReadJson(path.resolve(logsDir, "check-all-latest.json"));
  const goNoGo = safeReadJson(path.resolve(logsDir, "release-go-no-go-latest.json"));
  const policy = safeReadJson(path.resolve(logsDir, "seo-migration-policy-latest.json"));
  const probes = safeReadJson(path.resolve(logsDir, "ready-runtime-probes-latest.json"));
  const riskRegister = safeReadJson(path.resolve(logsDir, "release-risk-register-latest.json"));

  const checkoutCommands = new Set([
    "npm run check:add-to-cart",
    "npm run check:cart-quantity",
    "npm run check:checkout-empty-guard",
    "npm run check:payment-session-smoke",
    "npm run check:shipping-options-fallback",
    "npm run check:order-complete-smoke",
  ]);

  const failedChecks = Array.isArray(checkAll?.checks) ? checkAll.checks.filter((item) => item.status !== 0) : [];
  const checkoutChecksFailed = failedChecks.filter((item) => checkoutCommands.has(item.command)).length;

  const metrics = {
    releaseDecision: goNoGo?.decision ?? "NO-GO",
    blockers: Array.isArray(goNoGo?.blockers) ? goNoGo.blockers.length : 0,
    warnings: Array.isArray(goNoGo?.warnings) ? goNoGo.warnings.length : 0,
    policyViolations: policy?.violationsTotal ?? null,
    auditWarnings: policy?.auditWarningsTotal ?? null,
    runtimeFailed: probes?.failed ?? null,
    runtimeSlow: probes?.slow ?? null,
    gateTotalMs: checkAll?.totalElapsedMs ?? null,
    checkoutChecksFailed,
    openRisks: riskRegister?.openTotal ?? null,
    monitorRisks: riskRegister?.monitorTotal ?? null,
  };

  const owners = [
    {
      owner: "SEO",
      status: ownerStatus(metrics, "seo"),
      notes: [
        `Policy violations: ${metrics.policyViolations ?? "n/a"}`,
        `Audit warnings: ${metrics.auditWarnings ?? "n/a"}`,
        `Runtime failed: ${metrics.runtimeFailed ?? "n/a"}`,
      ],
      actions: ["Confirm final redirect map owners", "Confirm SEO sign-off in release decision ledger"],
    },
    {
      owner: "Checkout",
      status: ownerStatus(metrics, "checkout"),
      notes: [`Checkout checks failed: ${metrics.checkoutChecksFailed}`],
      actions: ["Re-run checkout smoke suite after deploy", "Validate /checkout success page"],
    },
    {
      owner: "Performance",
      status: ownerStatus(metrics, "perf"),
      notes: [`Gate total ms: ${metrics.gateTotalMs ?? "n/a"}`, `Runtime slow probes: ${metrics.runtimeSlow ?? "n/a"}`],
      actions: ["Track top 3 slow checks trend", "Monitor probe latency during release window"],
    },
    {
      owner: "Release",
      status: ownerStatus(metrics, "release"),
      notes: [
        `Decision: ${metrics.releaseDecision}`,
        `Blockers: ${metrics.blockers}`,
        `Warnings: ${metrics.warnings}`,
        `Open risks: ${metrics.openRisks ?? "n/a"}`,
      ],
      actions: ["Publish go/no-go summary", "Trigger post-deploy smoke and incident watch"],
    },
  ];

  const payload = {
    generatedAt: new Date().toISOString(),
    releaseDecision: metrics.releaseDecision,
    metrics,
    owners,
    evidence: {
      goNoGo: "logs/release-go-no-go-latest.json",
      riskRegister: "logs/release-risk-register-latest.json",
      checkAll: "logs/check-all-latest.json",
      seoPolicy: "logs/seo-migration-policy-latest.json",
      probes: "logs/ready-runtime-probes-latest.json",
    },
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "release-handoff-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Release Handoff",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Release decision: ${payload.releaseDecision}`,
    `- Open risks: ${payload.metrics.openRisks ?? "n/a"}`,
    `- Monitor risks: ${payload.metrics.monitorRisks ?? "n/a"}`,
    "",
    "## Owner handoff",
    "",
    ...payload.owners.flatMap((item) => [
      `### ${item.owner}`,
      "",
      `- Status: ${item.status}`,
      ...item.notes.map((note) => `- ${note}`),
      ...item.actions.map((action) => `- Action: ${action}`),
      "",
    ]),
    "## Evidence",
    "",
    "- logs/release-go-no-go-latest.json",
    "- logs/release-risk-register-latest.json",
    "- logs/check-all-latest.json",
    "- logs/seo-migration-policy-latest.json",
    "- logs/ready-runtime-probes-latest.json",
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "release-handoff-latest.md"), `${markdown}\n`, "utf8");

  console.log(`release_handoff: status=OK, decision=${payload.releaseDecision}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
