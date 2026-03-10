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

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      env[key] = value;
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

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function storeFetch(pathname, init = {}) {
  if (!backendUrl || !publishableKey) {
    throw new Error("Missing NEXT_PUBLIC_MEDUSA_BACKEND_URL or NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY");
  }

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

async function getFirstVariantId() {
  const { response, json } = await storeFetch(
    "/store/products?limit=1&fields=handle,title,variants.id,variants.manage_inventory,variants.inventory_quantity"
  );

  if (!response.ok) {
    throw new Error(`Products request failed: ${response.status}`);
  }

  const product = json?.products?.[0];
  const variant =
    product?.variants?.find(
      (item) =>
        item.manage_inventory === false ||
        typeof item.inventory_quantity !== "number" ||
        item.inventory_quantity > 0
    ) ?? product?.variants?.[0];

  if (!variant?.id) {
    throw new Error("No product variant available for add-to-cart check");
  }

  return variant.id;
}

async function getFirstRegionId() {
  const { response, json } = await storeFetch("/store/regions?limit=1");
  if (!response.ok) {
    throw new Error(`Regions request failed: ${response.status}`);
  }

  const regionId = json?.regions?.[0]?.id;
  if (!regionId) {
    throw new Error("No region found");
  }

  return regionId;
}

async function createCart(regionId) {
  const { response, json } = await storeFetch("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: regionId }),
  });

  if (!response.ok || !json?.cart?.id) {
    throw new Error(`Cart creation failed: ${response.status}`);
  }

  return json.cart.id;
}

async function main() {
  console.log(`Add-to-cart check (${new Date().toISOString()})`);

  const [regionId, variantId] = await Promise.all([getFirstRegionId(), getFirstVariantId()]);
  const cartId = await createCart(regionId);

  const successCase = await storeFetch(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
  });

  const successItems = successCase.json?.cart?.items ?? [];
  const addedItem = successItems.find((item) => item.variant_id === variantId);
  const successOk = successCase.response.ok && Boolean(addedItem) && (addedItem.quantity ?? 0) >= 1;

  console.log(
    `valid_variant: status=${successCase.response.status}, item=${addedItem ? "OK" : "MISS"}, quantity=${addedItem?.quantity ?? 0}`
  );

  if (!successOk) {
    fail("Add-to-cart success case failed");
  }

  const repeatCase = await storeFetch(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
  });

  const repeatItems = repeatCase.json?.cart?.items ?? [];
  const repeatedItem = repeatItems.find((item) => item.variant_id === variantId);
  const repeatOk = repeatCase.response.ok && (repeatedItem?.quantity ?? 0) >= 2;

  console.log(
    `repeat_variant: status=${repeatCase.response.status}, quantity=${repeatedItem?.quantity ?? 0}, expected_ge_2=${repeatOk ? "OK" : "MISS"}`
  );

  if (!repeatOk) {
    fail("Add-to-cart repeat case failed");
  }

  const invalidCase = await storeFetch(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: "variant_invalid_for_test", quantity: 1 }),
  });

  const invalidExpectedError = !invalidCase.response.ok;
  console.log(`invalid_variant: status=${invalidCase.response.status}, expected_error=${invalidExpectedError ? "OK" : "MISS"}`);

  if (!invalidExpectedError) {
    fail("Invalid variant case did not fail as expected");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
