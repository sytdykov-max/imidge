import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const logsDir = path.resolve(root, "logs");
const docsDir = path.resolve(root, "docs");
const redirectsPath = path.resolve(root, "apps/storefront/config/seo-redirects.json");
const baseUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";
const allowedPriority = new Set(["p0", "p1", "p2", "p3"]);
const allowedStatus = new Set(["ready", "planned", "blocked", "deprecated"]);
const allowedSourceType = new Set(["legacy_path", "legacy_script", "legacy_translit", "campaign", "other"]);
const allowedTargetType = new Set(["listing", "product", "content", "service", "other"]);

function inferRouteGroup(destination) {
  if (destination.startsWith("/catalog") || destination.startsWith("/product")) return "catalog";
  if (destination.startsWith("/checkout") || destination.startsWith("/cart")) return "checkout";
  if (destination.startsWith("/blog")) return "content";
  if (destination.startsWith("/account")) return "account";
  if (destination.startsWith("/search")) return "search";
  return "other";
}

function normalizeEntry(entry) {
  const routeGroup = typeof entry.routeGroup === "string" && entry.routeGroup.trim() ? entry.routeGroup.trim() : inferRouteGroup(entry.destination);
  const owner = typeof entry.owner === "string" && entry.owner.trim() ? entry.owner.trim() : "unassigned";
  const ticket = typeof entry.ticket === "string" && entry.ticket.trim() ? entry.ticket.trim() : "n/a";
  const approvedAt = typeof entry.approvedAt === "string" && entry.approvedAt.trim() ? entry.approvedAt.trim() : "";
  const priority = typeof entry.priority === "string" && allowedPriority.has(entry.priority) ? entry.priority : "p2";
  const status = typeof entry.status === "string" && allowedStatus.has(entry.status) ? entry.status : "planned";
  const sourceType = typeof entry.sourceType === "string" && allowedSourceType.has(entry.sourceType) ? entry.sourceType : "other";
  const targetType = typeof entry.targetType === "string" && allowedTargetType.has(entry.targetType) ? entry.targetType : "other";
  const notes = typeof entry.notes === "string" ? entry.notes : "";

  return {
    source: entry.source,
    destination: entry.destination,
    permanent: entry.permanent ?? true,
    routeGroup,
    owner,
    ticket,
    approvedAt,
    priority,
    status,
    sourceType,
    targetType,
    notes,
  };
}

function csvEscape(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  const escaped = raw.replaceAll('"', '""');
  return `"${escaped}"`;
}

function normalizeLocation(value) {
  try {
    return new URL(value, baseUrl).pathname;
  } catch {
    return "";
  }
}

async function probeRedirect(entry) {
  const sourceUrl = new URL(entry.source, baseUrl).toString();
  const destinationUrl = new URL(entry.destination, baseUrl).toString();

  const sourceResponse = await fetch(sourceUrl, {
    redirect: "manual",
    cache: "no-store",
  });

  const sourceLocation = sourceResponse.headers.get("location") ?? "";
  const sourceLocationPath = normalizeLocation(sourceLocation);
  const expectedStatus = entry.permanent ? 308 : 307;

  const redirectStatusOk = sourceResponse.status === expectedStatus || sourceResponse.status === 301 || sourceResponse.status === 302;
  const redirectTargetOk = sourceLocationPath === entry.destination;

  const destinationResponse = await fetch(destinationUrl, {
    redirect: "manual",
    cache: "no-store",
  });

  const destinationOk = destinationResponse.status >= 200 && destinationResponse.status < 400;

  return {
    sourceStatus: sourceResponse.status,
    sourceLocation,
    sourceLocationPath,
    expectedStatus,
    redirectStatusOk,
    redirectTargetOk,
    destinationStatus: destinationResponse.status,
    destinationOk,
  };
}

function toMarkdownReport(rows, generatedAt) {
  const verified = rows.filter((row) => row.runtimeVerified).length;
  const redirectOk = rows.filter((row) => row.redirectOk).length;
  const destinationOk = rows.filter((row) => row.destinationOk).length;
  const checkedBase = verified === 0 ? 0 : verified;
  const statusSummary = Object.fromEntries([...allowedStatus].map((item) => [item, rows.filter((row) => row.status === item).length]));
  const prioritySummary = Object.fromEntries([...allowedPriority].map((item) => [item, rows.filter((row) => row.priority === item).length]));

  const tableHeader = [
    "| Legacy URL | New URL | Group | Owner | Ticket | Approved at | Priority | Status | Runtime | Runtime OK | Source status | Source location | Destination status | Result |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | ---: | --- |",
  ];

  const tableRows = rows.map((row) => {
    const result = row.redirectOk && row.destinationOk ? "OK" : row.runtimeVerified ? "WARN" : "N/A";

    return `| ${row.source} | ${row.destination} | ${row.routeGroup} | ${row.owner} | ${row.ticket} | ${row.approvedAt || "-"} | ${row.priority} | ${row.status} | ${
      row.runtimeVerified ? "verified" : "not checked"
    } | ${row.runtimeOk ? "true" : row.runtimeVerified ? "false" : "n/a"} | ${row.sourceStatus ?? "-"} | ${
      row.sourceLocationPath || row.sourceLocation || "-"
    } | ${row.destinationStatus ?? "-"} | ${result} |`;
  });

  return [
    "# SEO Migration Manifest (Auto)",
    "",
    `- Generated at: ${generatedAt}`,
    `- Base URL: ${baseUrl}`,
    `- Entries total: ${rows.length}`,
    `- Runtime verified: ${verified}/${rows.length}`,
    `- Redirect checks OK: ${redirectOk}/${checkedBase}`,
    `- Destination checks OK: ${destinationOk}/${checkedBase}`,
    `- Runtime OK: ${rows.filter((row) => row.runtimeOk).length}/${checkedBase}`,
    `- Status summary: ready=${statusSummary.ready}, planned=${statusSummary.planned}, blocked=${statusSummary.blocked}, deprecated=${statusSummary.deprecated}`,
    `- Priority summary: p0=${prioritySummary.p0}, p1=${prioritySummary.p1}, p2=${prioritySummary.p2}, p3=${prioritySummary.p3}`,
    "",
    "## URL migration table",
    "",
    ...tableHeader,
    ...tableRows,
    "",
  ].join("\n");
}

function toChecklistReport(rows, generatedAt) {
  const launchCandidates = rows
    .filter((row) => row.status === "ready")
    .sort((a, b) => a.priority.localeCompare(b.priority) || a.routeGroup.localeCompare(b.routeGroup) || a.source.localeCompare(b.source));

  const blocked = rows.filter((row) => row.status === "blocked");

  const checklistItems = launchCandidates.map((row) => {
    const runtimeState = row.runtimeVerified ? (row.redirectOk && row.destinationOk ? "runtime-ok" : "runtime-warn") : "runtime-n/a";
    return `- [ ] ${row.priority.toUpperCase()} | ${row.routeGroup} | ${row.source} -> ${row.destination} | owner=${row.owner} | ticket=${row.ticket} | approved_at=${row.approvedAt || "-"} | ${runtimeState}`;
  });

  const blockedItems = blocked.length
    ? blocked.map((row) => `- ${row.source} -> ${row.destination} | owner=${row.owner} | ticket=${row.ticket} | notes=${row.notes || "-"}`)
    : ["- none"];

  return [
    "# SEO Migration Launch Checklist (Auto)",
    "",
    `- Generated at: ${generatedAt}`,
    `- Base URL: ${baseUrl}`,
    `- Ready entries: ${launchCandidates.length}`,
    `- Blocked entries: ${blocked.length}`,
    "",
    "## Launch queue (ready)",
    "",
    ...(checklistItems.length ? checklistItems : ["- none"]),
    "",
    "## Blocked entries",
    "",
    ...blockedItems,
    "",
  ].join("\n");
}

async function main() {
  const generatedAt = new Date().toISOString();
  const raw = readFileSync(redirectsPath, "utf8");
  const redirects = JSON.parse(raw);

  if (!Array.isArray(redirects) || redirects.length === 0) {
    throw new Error("Redirect map must be a non-empty array");
  }

  const normalizedRedirects = redirects.map(normalizeEntry);

  const rows = [];

  for (const entry of normalizedRedirects) {
    const row = {
      source: entry.source,
      destination: entry.destination,
      permanent: entry.permanent ?? true,
      routeGroup: entry.routeGroup,
      owner: entry.owner,
      ticket: entry.ticket,
      approvedAt: entry.approvedAt,
      priority: entry.priority,
      status: entry.status,
      sourceType: entry.sourceType,
      targetType: entry.targetType,
      notes: entry.notes,
      runtimeVerified: false,
      runtime_ok: false,
      sourceStatus: null,
      sourceLocation: "",
      sourceLocationPath: "",
      destinationStatus: null,
      redirectOk: false,
      destinationOk: false,
      runtimeOk: false,
      expectedStatus: (entry.permanent ?? true) ? 308 : 307,
      error: "",
    };

    try {
      const probe = await probeRedirect({
        source: row.source,
        destination: row.destination,
        permanent: row.permanent,
      });

      row.runtimeVerified = true;
      row.sourceStatus = probe.sourceStatus;
      row.sourceLocation = probe.sourceLocation;
      row.sourceLocationPath = probe.sourceLocationPath;
      row.destinationStatus = probe.destinationStatus;
      row.redirectOk = probe.redirectStatusOk && probe.redirectTargetOk;
      row.destinationOk = probe.destinationOk;
      row.runtimeOk = row.redirectOk && row.destinationOk;
      row.runtime_ok = row.runtimeOk;
      row.expectedStatus = probe.expectedStatus;
    } catch (error) {
      row.error = error instanceof Error ? error.message : String(error);
    }

    rows.push(row);
  }

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  const jsonPayload = {
    generatedAt,
    baseUrl,
    total: rows.length,
    rows,
  };

  const csvHeader = [
    "source",
    "destination",
    "type",
    "route_group",
    "owner",
    "ticket",
    "approved_at",
    "priority",
    "status",
    "source_type",
    "target_type",
    "notes",
    "runtime_verified",
    "runtime_ok",
    "expected_status",
    "source_status",
    "source_location",
    "destination_status",
    "redirect_ok",
    "destination_ok",
    "error",
  ];

  const csvRows = rows.map((row) =>
    [
      row.source,
      row.destination,
      row.permanent ? "permanent" : "temporary",
      row.routeGroup,
      row.owner,
      row.ticket,
      row.approvedAt,
      row.priority,
      row.status,
      row.sourceType,
      row.targetType,
      row.notes,
      row.runtimeVerified,
      row.runtimeOk,
      row.expectedStatus,
      row.sourceStatus ?? "",
      row.sourceLocationPath || row.sourceLocation || "",
      row.destinationStatus ?? "",
      row.redirectOk,
      row.destinationOk,
      row.error,
    ]
      .map(csvEscape)
      .join(",")
  );

  writeFileSync(path.resolve(logsDir, "seo-migration-manifest-latest.json"), `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
  writeFileSync(path.resolve(logsDir, "seo-migration-manifest-latest.csv"), `${csvHeader.join(",")}\n${csvRows.join("\n")}\n`, "utf8");
  writeFileSync(path.resolve(docsDir, "seo-migration-manifest-latest.md"), `${toMarkdownReport(rows, generatedAt)}\n`, "utf8");
  writeFileSync(path.resolve(docsDir, "seo-migration-checklist-latest.md"), `${toChecklistReport(rows, generatedAt)}\n`, "utf8");

  const runtimeVerified = rows.filter((row) => row.runtimeVerified).length;
  const redirectOk = rows.filter((row) => row.redirectOk).length;
  const destinationOk = rows.filter((row) => row.destinationOk).length;
  const runtimeOk = rows.filter((row) => row.runtimeOk).length;

  console.log(
    `seo_migration_manifest: status=OK, entries=${rows.length}, verified=${runtimeVerified}, redirect_ok=${redirectOk}, destination_ok=${destinationOk}, runtime_ok=${runtimeOk}`
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
