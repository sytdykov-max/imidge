import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const budgetKb = Number(process.env.STOREFRONT_BUNDLE_BUDGET_KB ?? 1500);
const buildManifestPath = path.resolve(root, "apps", "storefront", ".next", "build-manifest.json");

if (!existsSync(buildManifestPath)) {
  console.log("storefront_bundle_budget: status=SKIP, reason=build_manifest_missing");
  process.exit(0);
}

const manifest = JSON.parse(readFileSync(buildManifestPath, "utf8"));
const allFiles = Object.values(manifest.pages ?? {}).flat();
const unique = new Set(allFiles.filter((item) => typeof item === "string"));

let totalBytes = 0;
for (const file of unique) {
  const absolute = path.resolve(root, "apps", "storefront", ".next", file);
  if (existsSync(absolute)) {
    totalBytes += readFileSync(absolute).byteLength;
  }
}

const totalKb = Math.round(totalBytes / 1024);
if (totalKb > budgetKb) {
  console.error(`storefront_bundle_budget: status=FAIL, totalKb=${totalKb}, budgetKb=${budgetKb}`);
  process.exit(1);
}

console.log(`storefront_bundle_budget: status=OK, totalKb=${totalKb}, budgetKb=${budgetKb}`);
