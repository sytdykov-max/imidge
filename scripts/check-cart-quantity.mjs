import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readStorefrontEnv() {
  try {
    const currentDir = path.dirname(fileURLToPath(import.meta.url));
    const envPath = path.resolve(currentDir, "../apps/storefront/.env.local");
    const envRaw = readFileSync(envPath, "utf8");
    const lines = envRaw.split(/\r?\n/);
    const env = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      env[trimmed.slice(0, separatorIndex).trim()] = trimmed.slice(separatorIndex + 1).trim();
    }

    return env;
  } catch {
    return {};
  }
}

const fileEnv = readStorefrontEnv();
const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? fileEnv.NEXT_PUBLIC_MEDUSA_BACKEND_URL;
const publishableKey =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? fileEnv.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY;

async function storeFetch(pathname, init = {}) {
  const response = await fetch(`${backendUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-publishable-api-key": publishableKey,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { response, json, text };
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  console.log(`Cart quantity check (${new Date().toISOString()})`);

  if (!backendUrl || !publishableKey) {
    fail("Missing NEXT_PUBLIC_MEDUSA_BACKEND_URL or NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY");
    return;
  }

  const regions = await storeFetch("/store/regions?limit=1");
  const regionId = regions.json?.regions?.[0]?.id;
  if (!regions.response.ok || !regionId) {
    fail(`Failed to get region: status=${regions.response.status}`);
    return;
  }

  const products = await storeFetch(
    "/store/products?limit=1&fields=variants.id,variants.manage_inventory,variants.inventory_quantity"
  );
  const product = products.json?.products?.[0];
  const variant =
    product?.variants?.find(
      (item) =>
        item.manage_inventory === false ||
        typeof item.inventory_quantity !== "number" ||
        item.inventory_quantity > 0
    ) ?? product?.variants?.[0];

  if (!products.response.ok || !variant?.id) {
    fail(`Failed to get variant: status=${products.response.status}`);
    return;
  }

  const createdCart = await storeFetch("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: regionId }),
  });
  const cartId = createdCart.json?.cart?.id;
  if (!createdCart.response.ok || !cartId) {
    fail(`Failed to create cart: status=${createdCart.response.status}`);
    return;
  }

  const added = await storeFetch(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: variant.id, quantity: 1 }),
  });
  const lineItemId = added.json?.cart?.items?.[0]?.id;
  if (!added.response.ok || !lineItemId) {
    fail(`Failed to add line item: status=${added.response.status}`);
    return;
  }

  const updated = await storeFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: "POST",
    body: JSON.stringify({ quantity: 3 }),
  });
  const updatedItem = (updated.json?.cart?.items ?? []).find((item) => item.id === lineItemId);
  const quantityOk = updated.response.ok && updatedItem?.quantity === 3;
  console.log(`update_quantity: status=${updated.response.status}, quantity=${updatedItem?.quantity ?? 0}, expected=3`);

  if (!quantityOk) {
    fail("Line item quantity update check failed");
  }

  const removed = await storeFetch(`/store/carts/${cartId}/line-items/${lineItemId}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
  const stillExists = (removed.json?.cart?.items ?? []).some((item) => item.id === lineItemId);
  console.log(`remove_item: status=${removed.response.status}, removed=${stillExists ? "MISS" : "OK"}`);

  if (!removed.response.ok || stillExists) {
    fail("Line item remove check failed");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
