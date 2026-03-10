import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readEnvLocal() {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(currentDir, "../apps/storefront/.env.local");
    const raw = readFileSync(envPath, "utf8");
    const map = new Map();

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }

      const idx = trimmed.indexOf("=");
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      map.set(key, value);
    }

    return map;
  } catch {
    return new Map();
  }
}

const envLocal = readEnvLocal();
const medusaUrl =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ??
  process.env.MEDUSA_URL ??
  envLocal.get("NEXT_PUBLIC_MEDUSA_BACKEND_URL") ??
  "http://127.0.0.1:9000";
const publishableKey =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
  process.env.MEDUSA_PUBLISHABLE_KEY ??
  envLocal.get("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY") ??
  "";

function hasMojibake(text) {
  if (!text) return false;
  const value = String(text);
  const patterns = [
    /�/u,
    /Ð[\x80-\xBF]/u,
    /Ñ[\x80-\xBF]/u,
    /Ã[\x80-\xBF]/u,
    /Â[\x80-\xBF]/u,
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/u,
  ];
  return patterns.some((pattern) => pattern.test(value));
}

function collectFields(product) {
  return [
    ["title", product.title],
    ["handle", product.handle],
    ["description", product.description],
    ["collection.title", product.collection?.title],
    ["type.value", product.type?.value],
  ];
}

async function fetchProducts(limit = 100, offset = 0) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });

  const response = await fetch(`${medusaUrl}/store/products?${params.toString()}`, {
    headers: publishableKey ? { "x-publishable-api-key": publishableKey } : {},
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Medusa API error: ${response.status}`);
  }

  return response.json();
}

async function main() {
  const limit = 100;
  const maxPages = 50;
  let offset = 0;
  let page = 0;
  let total = Infinity;
  const suspects = [];

  while (page < maxPages && offset < total) {
    const payload = await fetchProducts(limit, offset);
    const products = payload.products ?? [];
    total = typeof payload.count === "number" ? payload.count : products.length;

    if (products.length === 0) break;

    for (const product of products) {
      const broken = collectFields(product)
        .filter(([, value]) => hasMojibake(value))
        .map(([name]) => name);

      if (broken.length > 0) {
        suspects.push({
          id: product.id,
          handle: product.handle,
          title: product.title,
          fields: broken,
        });
      }
    }

    offset += products.length;
    page += 1;
    if (products.length < limit) break;
  }

  console.log(`Catalog text audit (${new Date().toISOString()})`);
  console.log(`Checked products: ${Math.min(offset, Number.isFinite(total) ? total : offset)}`);
  console.log(`Suspected mojibake products: ${suspects.length}`);

  if (suspects.length > 0) {
    for (const item of suspects.slice(0, 100)) {
      console.log(`- ${item.handle} (${item.id}) fields: ${item.fields.join(", ")}`);
    }
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
