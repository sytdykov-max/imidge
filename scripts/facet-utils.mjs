import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function readEnvLocal() {
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

export function resolveStoreConnection() {
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

  return {
    medusaUrl,
    publishableKey,
  };
}

export async function fetchAllStoreProducts(options = {}) {
  const { medusaUrl, publishableKey } = resolveStoreConnection();
  const pageLimit = Number(options.pageLimit ?? process.env.FACET_PAGE_LIMIT ?? 250);
  const maxPages = Number(options.maxPages ?? process.env.FACET_MAX_PAGES ?? 200);

  let offset = 0;
  let page = 0;
  let totalCount = Infinity;
  const products = [];

  while (page < maxPages && offset < totalCount) {
    const params = new URLSearchParams({
      limit: String(pageLimit),
      offset: String(offset),
      fields: "id,handle,title,metadata",
    });

    const response = await fetch(`${medusaUrl}/store/products?${params.toString()}`, {
      headers: publishableKey ? { "x-publishable-api-key": publishableKey } : {},
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Medusa API error: ${response.status}`);
    }

    const payload = await response.json();
    const rows = Array.isArray(payload?.products) ? payload.products : [];
    totalCount = typeof payload?.count === "number" ? payload.count : rows.length;

    if (rows.length === 0) {
      break;
    }

    products.push(...rows);

    offset += rows.length;
    page += 1;

    if (rows.length < pageLimit) {
      break;
    }
  }

  return {
    medusaUrl,
    products,
  };
}

export function getMetadataString(metadata, keys) {
  if (!metadata || typeof metadata !== "object") {
    return "";
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

export function toPct(covered, total) {
  if (!total) return 0;
  return Math.round((covered / total) * 10000) / 100;
}
