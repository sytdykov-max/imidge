import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function toJunitXml(summary) {
  const testCases = summary.checks
    .map((check) => {
      const name = check.command.replaceAll("&", "&amp;").replaceAll("\"", "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
      const time = (check.elapsedMs / 1000).toFixed(3);

      if (check.status === 0) {
        return `    <testcase classname="quality-gate" name="${name}" time="${time}" />`;
      }

      return `    <testcase classname="quality-gate" name="${name}" time="${time}">\n      <failure message="exit code ${check.status}">Command failed</failure>\n    </testcase>`;
    })
    .join("\n");

  const failures = summary.checks.filter((check) => check.status !== 0).length;
  const time = (summary.totalElapsedMs / 1000).toFixed(3);

  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="imidge-quality-gate" tests="${summary.checks.length}" failures="${failures}" time="${time}">\n${testCases}\n</testsuite>\n`;
}

function toMarkdownSummary(summary) {
  const rows = summary.checks
    .map(
      (check) =>
        `| ${check.command} | ${check.status === 0 ? "OK" : "FAIL"} | ${check.elapsedMs} |`
    )
    .join("\n");

  return [
    `# Quality Gate Report`,
    "",
    `- Started: ${summary.startedAt}`,
    `- Finished: ${summary.finishedAt}`,
    `- Total: ${summary.totalElapsedMs} ms`,
    `- Result: ${summary.ok ? "OK" : "FAIL"}`,
    "",
    "| Check | Status | Duration (ms) |",
    "| --- | --- | ---: |",
    rows,
    "",
  ].join("\n");
}

const commands = [
  ["npm", ["run", "check:preflight"]],
  ["npm", ["run", "check:smoke"]],
  ["npm", ["run", "check:catalog-speed"]],
  ["npm", ["run", "audit:catalog-text"]],
  ["npm", ["run", "check:search-equivalence"]],
  ["npm", ["run", "check:add-to-cart"]],
  ["npm", ["run", "check:cart-quantity"]],
  ["npm", ["run", "check:checkout-empty-guard"]],
  ["npm", ["run", "check:payment-session-smoke"]],
  ["npm", ["run", "check:shipping-options-fallback"]],
  ["npm", ["run", "check:store-api-guards"]],
  ["npm", ["run", "check:order-complete-smoke"]],
  ["npm", ["run", "check:region-price-guard"]],
  ["npm", ["run", "check:e2e-flow"]],
  ["npm", ["run", "check:jsonld"]],
  ["npm", ["run", "check:internal-links"]],
  ["npm", ["run", "check:seo-redirect-map"]],
  ["npm", ["run", "report:seo-migration-manifest"]],
  ["npm", ["run", "check:seo-migration-policy"]],
  ["npm", ["run", "check:seo-pages"]],
  ["npm", ["run", "check:filter-metadata-coverage"]],
  ["npm", ["run", "report:facet-coverage"]],
  ["npm", ["run", "report:facet-diagnostics"]],
  ["npm", ["run", "check:critical-facets-by-category"]],
  ["npm", ["run", "check:facet-consistency"]],
  ["npm", ["run", "report:filter-migration-diff"]],
  ["npm", ["run", "check:facet-drift"]],
  ["npm", ["run", "check:catalog-filters-e2e"]],
  ["npm", ["run", "check:catalog-filters-performance"]],
  ["npm", ["run", "check:catalog-filters-seo"]],
  ["npm", ["run", "report:filters-rollout-v2"]],
  ["npm", ["run", "report:filters-staging-go-no-go"]],
];

let hasFailure = false;
const startedAt = Date.now();
const runEntries = [];
let fullLog = `check:all started at ${new Date(startedAt).toISOString()}\n`;

const logsDir = path.resolve(process.cwd(), "logs");
mkdirSync(logsDir, { recursive: true });

for (const [command, args] of commands) {
  const preview = process.platform === "win32" ? `cmd.exe /c ${command} ${args.join(" ")}` : `${command} ${args.join(" ")}`;
  console.log(`\n>>> ${preview}`);
  fullLog += `\n>>> ${preview}\n`;

  const commandStartedAt = Date.now();

  const result =
    process.platform === "win32"
      ? spawnSync("cmd.exe", ["/d", "/s", "/c", `${command} ${args.join(" ")}`], {
          stdio: "pipe",
          shell: false,
          encoding: "utf8",
        })
      : spawnSync(command, args, {
          stdio: "pipe",
          shell: false,
          encoding: "utf8",
        });

  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  const elapsedMs = Date.now() - commandStartedAt;
  const status = result.status ?? 1;

  if (stdout) {
    process.stdout.write(stdout);
    fullLog += stdout.endsWith("\n") ? stdout : `${stdout}\n`;
  }

  if (stderr) {
    process.stderr.write(stderr);
    fullLog += stderr.endsWith("\n") ? stderr : `${stderr}\n`;
  }

  runEntries.push({
    command: `${command} ${args.join(" ")}`,
    preview,
    status,
    elapsedMs,
  });

  if (status !== 0) {
    hasFailure = true;
    break;
  }
}

const finishedAt = Date.now();
const summary = {
  startedAt: new Date(startedAt).toISOString(),
  finishedAt: new Date(finishedAt).toISOString(),
  totalElapsedMs: finishedAt - startedAt,
  ok: !hasFailure,
  checks: runEntries,
};

fullLog += `\ncheck:all finished at ${summary.finishedAt}; ok=${summary.ok}; totalElapsedMs=${summary.totalElapsedMs}\n`;

writeFileSync(path.resolve(logsDir, "check-all-latest.log"), fullLog, "utf8");
writeFileSync(path.resolve(logsDir, "check-all-latest.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
writeFileSync(path.resolve(logsDir, "check-all-latest.junit.xml"), toJunitXml(summary), "utf8");
writeFileSync(path.resolve(logsDir, "check-all-latest.md"), toMarkdownSummary(summary), "utf8");

const historyRecord = {
  startedAt: summary.startedAt,
  finishedAt: summary.finishedAt,
  totalElapsedMs: summary.totalElapsedMs,
  ok: summary.ok,
  checksTotal: summary.checks.length,
  checksFailed: summary.checks.filter((check) => check.status !== 0).length,
  slowestCheck:
    summary.checks.length > 0
      ? [...summary.checks].sort((left, right) => (right.elapsedMs ?? 0) - (left.elapsedMs ?? 0))[0]
      : null,
};

const historyPath = path.resolve(logsDir, "check-all-history.jsonl");
appendFileSync(historyPath, `${JSON.stringify(historyRecord)}\n`, "utf8");

try {
  const historyRows = readFileSync(historyPath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  writeFileSync(path.resolve(logsDir, "check-all-history-latest.json"), `${JSON.stringify(historyRows.slice(-50), null, 2)}\n`, "utf8");
} catch {
  // no-op
}

if (hasFailure) {
  process.exitCode = 1;
}
