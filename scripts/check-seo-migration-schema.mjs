import { readFileSync } from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`seo_migration_schema: status=FAIL, reason=${message}`);
  process.exit(1);
}

const root = process.cwd();
const manifestPath = path.resolve(root, "logs", "seo-migration-manifest-latest.json");
const schemaPath = path.resolve(root, "config", "seo-migration-manifest.schema.json");

let manifest;
let schema;

try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  fail("manifest_missing_or_invalid_json");
}

try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch {
  fail("schema_missing_or_invalid_json");
}

if (!manifest || typeof manifest !== "object") fail("manifest_not_object");
const entries = Array.isArray(manifest.entries)
  ? manifest.entries
  : Array.isArray(manifest.rows)
    ? manifest.rows
    : null;
if (!entries) fail("entries_or_rows_missing");

const requiredEntryFields = ["status", "owner", "ticket", "approvedAt"];
let invalidCount = 0;
for (const entry of entries) {
  const hasIdentity =
    (typeof entry?.slug === "string" && entry.slug.length > 0) ||
    (typeof entry?.source === "string" && entry.source.length > 0);
  if (!hasIdentity) {
    invalidCount += 1;
    continue;
  }

  for (const field of requiredEntryFields) {
    if (!entry?.[field] || typeof entry[field] !== "string") {
      invalidCount += 1;
      break;
    }
  }
}

if (invalidCount > 0) {
  fail(`invalid_entries=${invalidCount}`);
}

console.log(`seo_migration_schema: status=OK, entries=${entries.length}, schema=${schema.title ?? "loaded"}`);
