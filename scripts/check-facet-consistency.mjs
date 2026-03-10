import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fetchAllStoreProducts } from "./facet-utils.mjs";

function loadSchema(root) {
  const filePath = path.resolve(root, "config/facets-schema-v2.json");
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function asBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return null;
}

async function main() {
  const root = process.cwd();
  const logsDir = path.resolve(root, "logs");
  const docsDir = path.resolve(root, "docs");

  const schema = loadSchema(root);
  const facets = schema.facets ?? {};
  const { medusaUrl, products } = await fetchAllStoreProducts();

  const violations = [];

  for (const product of products) {
    const metadata = product?.metadata ?? {};

    for (const [facetKey, facetConfig] of Object.entries(facets)) {
      const value = metadata[facetKey];

      if (facetConfig.required && (value === undefined || value === null || (typeof value === "string" && !value.trim()))) {
        violations.push({
          productId: product?.id ?? "",
          handle: product?.handle ?? "",
          facet: facetKey,
          issue: "missing_required",
          value,
        });
        continue;
      }

      if (facetConfig.type === "enum" && value !== undefined && value !== null) {
        const allowedValues = Array.isArray(facetConfig.allowedValues) ? facetConfig.allowedValues : [];
        const normalized = String(value).trim();
        if (normalized && !allowedValues.includes(normalized)) {
          violations.push({
            productId: product?.id ?? "",
            handle: product?.handle ?? "",
            facet: facetKey,
            issue: "invalid_enum",
            value: normalized,
            allowedValues,
          });
        }
      }

      if (facetConfig.type === "boolean" && value !== undefined && value !== null) {
        const parsed = asBoolean(value);
        if (parsed === null) {
          violations.push({
            productId: product?.id ?? "",
            handle: product?.handle ?? "",
            facet: facetKey,
            issue: "invalid_boolean",
            value,
          });
        }
      }
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    medusaUrl,
    productsTotal: products.length,
    violationsTotal: violations.length,
    ok: violations.length === 0,
    violations: violations.slice(0, 300),
  };

  mkdirSync(logsDir, { recursive: true });
  mkdirSync(docsDir, { recursive: true });

  writeFileSync(path.resolve(logsDir, "facet-consistency-latest.json"), `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const markdown = [
    "# Facet Consistency Check",
    "",
    `- Generated at: ${payload.generatedAt}`,
    `- Products total: ${payload.productsTotal}`,
    `- Violations: ${payload.violationsTotal}`,
    `- Result: ${payload.ok ? "OK" : "FAIL"}`,
    "",
    "## Violations (sample)",
    "",
    ...(payload.violations.length
      ? payload.violations.map((item) => `- ${item.handle || item.productId} | ${item.facet} | ${item.issue} | value=${JSON.stringify(item.value)}`)
      : ["- none"]),
    "",
  ].join("\n");

  writeFileSync(path.resolve(docsDir, "facet-consistency-latest.md"), `${markdown}\n`, "utf8");

  if (!payload.ok) {
    console.error(`facet_consistency: status=FAIL, violations=${payload.violationsTotal}`);
    process.exitCode = 1;
    return;
  }

  console.log(`facet_consistency: status=OK, products=${payload.productsTotal}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
