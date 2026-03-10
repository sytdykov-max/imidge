import { readFileSync } from "node:fs";
import path from "node:path";

function fail(message) {
  console.error(`seo_redirect_schema: status=FAIL, reason=${message}`);
  process.exit(1);
}

const root = process.cwd();
const redirectsPath = path.resolve(root, "apps", "storefront", "config", "seo-redirects.json");
const schemaPath = path.resolve(root, "config", "seo-redirects.schema.json");

let redirects;
let schema;

try {
  redirects = JSON.parse(readFileSync(redirectsPath, "utf8"));
} catch {
  fail("redirects_missing_or_invalid_json");
}

try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch {
  fail("schema_missing_or_invalid_json");
}

if (!Array.isArray(redirects)) {
  fail("redirects_not_array");
}

let invalid = 0;
for (const row of redirects) {
  if (typeof row?.source !== "string" || !row.source.startsWith("/")) invalid += 1;
  if (typeof row?.destination !== "string" || !row.destination.startsWith("/")) invalid += 1;
  if (typeof row?.permanent !== "boolean") invalid += 1;
  if (typeof row?.status !== "string") invalid += 1;
  if (typeof row?.owner !== "string" || !row.owner.trim()) invalid += 1;
  if (typeof row?.ticket !== "string" || !row.ticket.trim()) invalid += 1;
  if (typeof row?.approvedAt !== "string" || !row.approvedAt.trim()) invalid += 1;
}

if (invalid > 0) {
  fail(`invalid_fields=${invalid}`);
}

console.log(`seo_redirect_schema: status=OK, rows=${redirects.length}, schema=${schema.title ?? "loaded"}`);
