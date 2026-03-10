import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://127.0.0.1:9000";
const publishableKey =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
  "pk_9e839c44d0b8854ecc2d6ef74322c320b78e3fd33eb2cdacc0ffe55e4fdf375d";

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

async function main() {
  console.log(`Checkout empty-guard check (${new Date().toISOString()})`);

  const regions = await storeFetch("/store/regions?limit=1");
  const regionId = regions.json?.regions?.[0]?.id;
  if (!regions.response.ok || !regionId) {
    console.error(`Failed to resolve region: status=${regions.response.status}`);
    process.exitCode = 1;
    return;
  }

  const created = await storeFetch("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: regionId }),
  });
  const cartId = created.json?.cart?.id;
  if (!created.response.ok || !cartId) {
    console.error(`Failed to create cart: status=${created.response.status}`);
    process.exitCode = 1;
    return;
  }

  const cart = await storeFetch(`/store/carts/${cartId}`);
  const isApiCartEmpty = (cart.json?.cart?.items?.length ?? 0) === 0;

  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  const checkoutClientPath = path.resolve(
    currentDir,
    "../apps/storefront/src/components/checkout-page-client.tsx"
  );
  const checkoutClientCode = readFileSync(checkoutClientPath, "utf8");
  const hasClientGuard = checkoutClientCode.includes("if (items.length === 0)");

  console.log(`api_empty_cart=${isApiCartEmpty ? "OK" : "MISS"}`);
  console.log(`client_guard_present=${hasClientGuard ? "OK" : "MISS"}`);

  if (!isApiCartEmpty || !hasClientGuard) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
