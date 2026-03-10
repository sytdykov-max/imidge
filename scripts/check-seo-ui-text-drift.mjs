import { readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.resolve(root, "logs", "seo-migration-manifest-latest.json");
const uiPath = path.resolve(root, "apps", "storefront", "src", "app", "catalog", "page.tsx");

try {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const uiSource = readFileSync(uiPath, "utf8");

  const hasCatalogWordInUi = /Каталог|catalog/i.test(uiSource);
  const hasEntries = Array.isArray(manifest.entries) && manifest.entries.length > 0;

  if (!hasCatalogWordInUi || !hasEntries) {
    console.error("seo_ui_text_drift: status=FAIL, reason=ui_or_manifest_missing_core_tokens");
    process.exit(1);
  }

  console.log(`seo_ui_text_drift: status=OK, entries=${manifest.entries.length}`);
} catch {
  console.log("seo_ui_text_drift: status=SKIP, reason=missing_inputs");
}
