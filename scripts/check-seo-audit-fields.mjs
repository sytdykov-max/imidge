import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

function isValidIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");
  const manifestPath = process.env.SEO_MIGRATION_MANIFEST_PATH
    ? path.resolve(root, process.env.SEO_MIGRATION_MANIFEST_PATH)
    : path.resolve(logsDir, "seo-migration-manifest-latest.json");

  if (!existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const rows = Array.isArray(manifest.rows) ? manifest.rows : [];
  const readyRows = rows.filter((row) => row?.status === "ready");

  const violations = readyRows
    .map((row) => {
      const owner = typeof row.owner === "string" ? row.owner.trim() : "";
      const ticket = typeof row.ticket === "string" ? row.ticket.trim() : "";
      const approvedAt = typeof row.approvedAt === "string" ? row.approvedAt.trim() : "";

      const issues = [];
      if (!owner || owner === "unassigned") issues.push("owner");
      if (!ticket || ticket === "n/a") issues.push("ticket");
      if (!approvedAt || !isValidIsoDate(approvedAt)) issues.push("approvedAt");

      if (issues.length === 0) {
        return null;
      }

      return {
        source: row.source,
        destination: row.destination,
        owner,
        ticket,
        approvedAt,
        issues,
      };
    })
    .filter(Boolean);

  const payload = {
    generatedAt: new Date().toISOString(),
    manifestPath,
    total: rows.length,
    readyTotal: readyRows.length,
    violationsTotal: violations.length,
    ok: violations.length === 0,
    violations,
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "seo-audit-fields-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# SEO Audit Fields Check",
    "",
    `- Manifest path: ${payload.manifestPath}`,
    `- Entries total: ${payload.total}`,
    `- Ready entries: ${payload.readyTotal}`,
    `- Violations: ${payload.violationsTotal}`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Violations",
    "",
    ...(payload.violations.length
      ? payload.violations.map(
          (item) =>
            `- ${item.source} -> ${item.destination} | owner=${item.owner || "-"} | ticket=${item.ticket || "-"} | approvedAt=${
              item.approvedAt || "-"
            } | issues=${item.issues.join(",")}`
        )
      : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "seo-audit-fields-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`seo_audit_fields: status=FAIL, violations=${payload.violationsTotal}, ready=${payload.readyTotal}`);
    process.exitCode = 1;
    return;
  }

  console.log(`seo_audit_fields: status=OK, ready=${payload.readyTotal}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
