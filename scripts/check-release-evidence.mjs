import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

function safeJson(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function checkJson(filePath) {
  if (!existsSync(filePath)) {
    return { ok: false, reason: "missing" };
  }

  const payload = safeJson(filePath);
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "invalid_json" };
  }

  return { ok: true, reason: "ok" };
}

function checkText(filePath) {
  if (!existsSync(filePath)) {
    return { ok: false, reason: "missing" };
  }

  const content = readFileSync(filePath, "utf8").trim();
  if (!content) {
    return { ok: false, reason: "empty" };
  }

  return { ok: true, reason: "ok" };
}

function checkJunitXml(filePath) {
  if (!existsSync(filePath)) {
    return { ok: false, reason: "missing" };
  }

  const content = readFileSync(filePath, "utf8");
  if (!content.includes("<testsuite") || !content.includes("<testcase")) {
    return { ok: false, reason: "invalid_junit" };
  }

  return { ok: true, reason: "ok" };
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const requiredArtifacts = [
    { rel: "logs/check-all-latest.json", type: "json" },
  { rel: "logs/filter-metadata-coverage-latest.json", type: "json" },
    { rel: "logs/check-all-latest.md", type: "text" },
    { rel: "logs/check-all-latest.log", type: "text" },
    { rel: "logs/check-all-latest.junit.xml", type: "junit" },
    { rel: "logs/weekly-kpi-latest.json", type: "json" },
    { rel: "logs/weekly-rollup-latest.json", type: "json" },
    { rel: "docs/weekly-regression-rollup-latest.md", type: "text" },
    { rel: "logs/seo-migration-policy-latest.json", type: "json" },
    { rel: "docs/seo-migration-policy-latest.md", type: "text" },
    { rel: "logs/ready-runtime-probes-latest.json", type: "json" },
    { rel: "docs/ready-runtime-probes-latest.md", type: "text" },
  ];

  const rows = requiredArtifacts.map((artifact) => {
    const filePath = path.resolve(root, artifact.rel);
    let checkResult;

    if (artifact.type === "json") {
      checkResult = checkJson(filePath);
    } else if (artifact.type === "junit") {
      checkResult = checkJunitXml(filePath);
    } else {
      checkResult = checkText(filePath);
    }

    const size = existsSync(filePath) ? statSync(filePath).size : 0;

    return {
      artifact: artifact.rel,
      type: artifact.type,
      ok: checkResult.ok,
      reason: checkResult.reason,
      bytes: size,
    };
  });

  const failed = rows.filter((row) => !row.ok);
  const summary = {
    startedAt: new Date().toISOString(),
    total: rows.length,
    passed: rows.length - failed.length,
    failed: failed.length,
    ok: failed.length === 0,
    rows,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "release-evidence-latest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const markdown = [
    "# Release Evidence Check",
    "",
    `- Total artifacts: ${summary.total}`,
    `- Passed: ${summary.passed}`,
    `- Failed: ${summary.failed}`,
    `- Result: ${summary.ok ? "OK" : "FAIL"}`,
    "",
    "## Details",
    "",
    "| Artifact | Type | Result | Reason | Size (bytes) |",
    "| --- | --- | --- | --- | ---: |",
    ...rows.map((row) => `| ${row.artifact} | ${row.type} | ${row.ok ? "OK" : "FAIL"} | ${row.reason} | ${row.bytes} |`),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "release-evidence-latest.md"), `${markdown}\n`, "utf8");

  if (!summary.ok) {
    console.error(`release_evidence: status=FAIL, failed=${summary.failed}`);
    process.exitCode = 1;
    return;
  }

  console.log(`release_evidence: status=OK, total=${summary.total}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
