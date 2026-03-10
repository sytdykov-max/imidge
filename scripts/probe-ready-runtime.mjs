import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { resolveQualityThresholds } from "./lib-quality-thresholds.mjs";

function normalizeLocation(value, baseUrl) {
  try {
    return new URL(value, baseUrl).pathname;
  } catch {
    return "";
  }
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");
  const manifestPath = path.resolve(logsDir, "seo-migration-manifest-latest.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const rows = Array.isArray(manifest.rows) ? manifest.rows : [];
  const thresholds = resolveQualityThresholds(root);
  const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

  const readyRows = rows.filter((row) => row.status === "ready");
  const probes = [];

  for (const row of readyRows) {
    const sourceUrl = new URL(row.source, baseUrl).toString();
    const destinationUrl = new URL(row.destination, baseUrl).toString();

    const startedAt = Date.now();
    let sourceStatus = 0;
    let destinationStatus = 0;
    let location = "";
    let ok = false;
    let error = "";

    try {
      const sourceResponse = await fetch(sourceUrl, { redirect: "manual", cache: "no-store" });
      sourceStatus = sourceResponse.status;
      location = sourceResponse.headers.get("location") ?? "";
      const locationPath = normalizeLocation(location, baseUrl);

      const destinationResponse = await fetch(destinationUrl, { redirect: "manual", cache: "no-store" });
      destinationStatus = destinationResponse.status;

      const statusOk = sourceStatus === 308 || sourceStatus === 307 || sourceStatus === 301 || sourceStatus === 302;
      const targetOk = locationPath === row.destination;
      const destinationOk = destinationStatus >= 200 && destinationStatus < 400;
      ok = statusOk && targetOk && destinationOk;
    } catch (probeError) {
      error = probeError instanceof Error ? probeError.message : String(probeError);
    }

    const elapsedMs = Date.now() - startedAt;
    probes.push({
      source: row.source,
      destination: row.destination,
      sourceStatus,
      destinationStatus,
      location,
      elapsedMs,
      ok,
      error,
    });
  }

  const slow = probes.filter((item) => item.elapsedMs > thresholds.READY_RUNTIME_MAX_MS);
  const failed = probes.filter((item) => !item.ok);
  const hardFailures = failed.length + slow.length;

  const payload = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    profile: thresholds.profile,
    total: probes.length,
    failed: failed.length,
    slow: slow.length,
    maxAllowedLatencyMs: thresholds.READY_RUNTIME_MAX_MS,
    maxAllowedFailures: thresholds.READY_RUNTIME_MAX_FAILS,
    probes,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "ready-runtime-probes-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Ready Runtime Probes",
    "",
    `- Generated: ${payload.generatedAt}`,
    `- Base URL: ${baseUrl}`,
    `- Profile: ${thresholds.profile}`,
    `- Probed ready URLs: ${payload.total}`,
    `- Failed probes: ${payload.failed}`,
    `- Slow probes: ${payload.slow} (>${thresholds.READY_RUNTIME_MAX_MS} ms)`,
    "",
    "## Probe details",
    "",
    "| Source | Destination | Source status | Destination status | Elapsed (ms) | Result |",
    "| --- | --- | ---: | ---: | ---: | --- |",
    ...probes.map(
      (item) =>
        `| ${item.source} | ${item.destination} | ${item.sourceStatus || "-"} | ${item.destinationStatus || "-"} | ${
          item.elapsedMs
        } | ${item.ok ? "OK" : `FAIL (${item.error || "invalid redirect"})`} |`
    ),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "ready-runtime-probes-latest.md"), `${markdown}\n`, "utf8");

  console.log(
    `ready_runtime_probes: total=${payload.total}, failed=${payload.failed}, slow=${payload.slow}, profile=${thresholds.profile}`
  );

  if (hardFailures > thresholds.READY_RUNTIME_MAX_FAILS) {
    console.error(`ready_runtime_probes: FAIL, hard_failures=${hardFailures}, limit=${thresholds.READY_RUNTIME_MAX_FAILS}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
