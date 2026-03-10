import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

function minutesBetween(nowMs, targetMs) {
  return Math.round(((nowMs - targetMs) / 1000 / 60) * 100) / 100;
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const maxAgeMinutes = Number(process.env.ARTIFACT_MAX_AGE_MINUTES ?? "180");
  if (!Number.isFinite(maxAgeMinutes) || maxAgeMinutes <= 0) {
    throw new Error("ARTIFACT_MAX_AGE_MINUTES must be a positive number");
  }

  const requiredArtifacts = [
    "logs/check-all-latest.json",
    "logs/check-all-latest.junit.xml",
    "logs/weekly-kpi-latest.json",
    "logs/weekly-rollup-latest.json",
    "logs/seo-migration-policy-latest.json",
    "logs/ready-runtime-probes-latest.json",
    "logs/release-go-no-go-latest.json",
  ];

  const now = Date.now();

  const rows = requiredArtifacts.map((artifact) => {
    const filePath = path.resolve(root, artifact);

    if (!existsSync(filePath)) {
      return {
        artifact,
        exists: false,
        modifiedAt: "",
        ageMinutes: null,
        maxAgeMinutes,
        ok: false,
        reason: "missing",
      };
    }

    const stats = statSync(filePath);
    const modifiedAt = stats.mtime.toISOString();
    const ageMinutes = minutesBetween(now, stats.mtimeMs);
    const ok = ageMinutes <= maxAgeMinutes;

    return {
      artifact,
      exists: true,
      modifiedAt,
      ageMinutes,
      maxAgeMinutes,
      ok,
      reason: ok ? "ok" : "stale",
    };
  });

  const failed = rows.filter((row) => !row.ok);
  const payload = {
    generatedAt: new Date().toISOString(),
    maxAgeMinutes,
    total: rows.length,
    failed: failed.length,
    ok: failed.length === 0,
    rows,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "artifact-freshness-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Artifact Freshness Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Max age (minutes): ${payload.maxAgeMinutes}`,
    `- Total: ${payload.total}`,
    `- Failed: ${payload.failed}`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Details",
    "",
    "| Artifact | Exists | Modified at | Age (minutes) | SLA max | Result |",
    "| --- | --- | --- | ---: | ---: | --- |",
    ...rows.map(
      (row) =>
        `| ${row.artifact} | ${row.exists} | ${row.modifiedAt || "-"} | ${row.ageMinutes ?? "-"} | ${row.maxAgeMinutes} | ${row.ok ? "OK" : `FAIL (${row.reason})`} |`
    ),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "artifact-freshness-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`artifact_freshness: status=FAIL, failed=${payload.failed}, max_age_min=${maxAgeMinutes}`);
    process.exitCode = 1;
    return;
  }

  console.log(`artifact_freshness: status=OK, total=${payload.total}, max_age_min=${maxAgeMinutes}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
