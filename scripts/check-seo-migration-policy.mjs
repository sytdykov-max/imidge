import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const logsDir = path.resolve(root, "logs");
const docsDir = path.resolve(root, "docs");
const manifestPath = process.env.SEO_MIGRATION_MANIFEST_PATH
  ? path.resolve(root, process.env.SEO_MIGRATION_MANIFEST_PATH)
  : path.resolve(logsDir, "seo-migration-manifest-latest.json");
const policyJsonPath = process.env.SEO_MIGRATION_POLICY_JSON_PATH
  ? path.resolve(root, process.env.SEO_MIGRATION_POLICY_JSON_PATH)
  : path.resolve(logsDir, "seo-migration-policy-latest.json");
const policyMdPath = process.env.SEO_MIGRATION_POLICY_MD_PATH
  ? path.resolve(root, process.env.SEO_MIGRATION_POLICY_MD_PATH)
  : path.resolve(docsDir, "seo-migration-policy-latest.md");
const requireAuditFields = String(process.env.REQUIRE_SEO_AUDIT_FIELDS ?? "false").toLowerCase() === "true";

function main() {
  const startedAt = new Date().toISOString();
  const raw = readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  const rows = Array.isArray(manifest.rows) ? manifest.rows : [];

  if (rows.length === 0) {
    throw new Error("SEO migration manifest has no rows");
  }

  const missingFields = rows.filter(
    (row) =>
      typeof row.status !== "string" ||
      (typeof row.runtime_ok !== "boolean" && typeof row.runtimeOk !== "boolean")
  );

  const withRuntimeValue = rows.map((row) => ({
    ...row,
    runtime_ok: typeof row.runtime_ok === "boolean" ? row.runtime_ok : row.runtimeOk,
  }));

  const readyRows = withRuntimeValue.filter((row) => row.status === "ready");
  const violations = readyRows.filter((row) => row.runtime_ok !== true);
  const auditWarnings = readyRows.filter(
    (row) =>
      typeof row.owner !== "string" ||
      row.owner.trim() === "" ||
      row.owner === "unassigned" ||
      typeof row.ticket !== "string" ||
      row.ticket.trim() === "" ||
      row.ticket === "n/a" ||
      typeof row.approvedAt !== "string" ||
      row.approvedAt.trim() === ""
  );

  const summary = {
    startedAt,
    finishedAt: new Date().toISOString(),
    manifestPath,
    total: rows.length,
    readyTotal: readyRows.length,
    violationsTotal: violations.length,
    missingFieldsTotal: missingFields.length,
    auditWarningsTotal: auditWarnings.length,
    ok: violations.length === 0 && missingFields.length === 0 && (!requireAuditFields || auditWarnings.length === 0),
    violations: violations.map((row) => ({
      source: row.source,
      destination: row.destination,
      status: row.status,
      runtime_ok: row.runtime_ok,
      runtimeVerified: row.runtimeVerified,
      redirectOk: row.redirectOk,
      destinationOk: row.destinationOk,
      owner: row.owner,
      priority: row.priority,
      routeGroup: row.routeGroup,
      error: row.error || "",
    })),
    missingFields: missingFields.map((row) => ({
      source: row.source,
      destination: row.destination,
      hasStatus: typeof row.status === "string",
      hasRuntimeOk: typeof row.runtime_ok === "boolean" || typeof row.runtimeOk === "boolean",
    })),
    auditWarnings: auditWarnings.map((row) => ({
      source: row.source,
      destination: row.destination,
      owner: row.owner,
      ticket: row.ticket,
      approvedAt: row.approvedAt,
    })),
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  mkdirSync(path.dirname(policyJsonPath), { recursive: true });
  mkdirSync(path.dirname(policyMdPath), { recursive: true });
  writeFileSync(policyJsonPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  const markdown = [
    "# SEO Migration Policy Check",
    "",
    `- Manifest path: ${manifestPath}`,
    `- Entries total: ${summary.total}`,
    `- Ready entries: ${summary.readyTotal}`,
    `- Violations: ${summary.violationsTotal}`,
    `- Missing required fields: ${summary.missingFieldsTotal}`,
    `- Audit metadata warnings: ${summary.auditWarningsTotal}`,
    `- Audit fields required: ${requireAuditFields}`,
    `- Result: ${summary.ok ? "OK" : "FAIL"}`,
    "",
    "## Violations (status=ready and runtime_ok!=true)",
    "",
    ...(summary.violations.length
      ? summary.violations.map(
          (item) =>
            `- ${item.source} -> ${item.destination} | owner=${item.owner || "-"} | priority=${item.priority || "-"} | runtime_ok=${String(
              item.runtime_ok
            )} | error=${item.error || "-"}`
        )
      : ["- none"]),
    "",
    "## Missing required fields",
    "",
    ...(summary.missingFields.length
      ? summary.missingFields.map(
          (item) =>
            `- ${item.source} -> ${item.destination} | has_status=${item.hasStatus} | has_runtime_ok=${item.hasRuntimeOk}`
        )
      : ["- none"]),
    "",
    "## Audit metadata warnings (owner/ticket/approvedAt)",
    "",
    ...(summary.auditWarnings.length
      ? summary.auditWarnings.map(
          (item) =>
            `- ${item.source} -> ${item.destination} | owner=${item.owner || "-"} | ticket=${item.ticket || "-"} | approved_at=${item.approvedAt || "-"}`
        )
      : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(policyMdPath, `${markdown}\n`, "utf8");

  if (!summary.ok) {
    console.error(
      `seo_migration_policy: status=FAIL, total=${summary.total}, ready=${summary.readyTotal}, violations=${summary.violationsTotal}, missing_fields=${summary.missingFieldsTotal}, audit_warnings=${summary.auditWarningsTotal}, require_audit_fields=${requireAuditFields}`
    );
    process.exitCode = 1;
    return;
  }

  console.log(
    `seo_migration_policy: status=OK, total=${summary.total}, ready=${summary.readyTotal}, violations=${summary.violationsTotal}, audit_warnings=${summary.auditWarningsTotal}`
  );
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
