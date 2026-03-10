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

async function createCartWithOneItem(regionId, variantId) {
  const cart = await storeFetch("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: regionId }),
  });

  const cartId = cart.json?.cart?.id;
  if (!cart.response.ok || !cartId) {
    return null;
  }

  const lineItem = await storeFetch(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
  });

  if (!lineItem.response.ok) {
    return null;
  }

  return cartId;
}

async function main() {
  console.log(`Shipping options fallback smoke (${new Date().toISOString()})`);

  const regions = await storeFetch("/store/regions?limit=100");
  const regionIds = (regions.json?.regions ?? []).map((region) => region.id).filter(Boolean);
  if (!regions.response.ok || regionIds.length === 0) {
    console.error(`Failed to load regions: status=${regions.response.status}`);
    process.exitCode = 1;
    return;
  }

  const products = await storeFetch(
    "/store/products?limit=1&fields=variants.id,variants.manage_inventory,variants.inventory_quantity"
  );
  const variant =
    products.json?.products?.[0]?.variants?.find(
      (item) =>
        item.manage_inventory === false ||
        typeof item.inventory_quantity !== "number" ||
        item.inventory_quantity > 0
    ) ?? products.json?.products?.[0]?.variants?.[0];

  if (!products.response.ok || !variant?.id) {
    console.error(`Failed to resolve variant: status=${products.response.status}`);
    process.exitCode = 1;
    return;
  }

  let successRegion = "";
  let shippingOptionId = "";

  for (const regionId of regionIds) {
    const cartId = await createCartWithOneItem(regionId, variant.id);
    if (!cartId) {
      continue;
    }

    const options = await storeFetch(`/store/shipping-options?cart_id=${cartId}`);
    const optionId = options.json?.shipping_options?.[0]?.id;

    if (options.response.ok && optionId) {
      successRegion = regionId;
      shippingOptionId = optionId;
      console.log(`shipping_options: region=${regionId}, status=${options.response.status}, option=OK`);
      break;
    }

    console.log(`shipping_options: region=${regionId}, status=${options.response.status}, option=MISS`);
  }

  if (!successRegion || !shippingOptionId) {
    console.error("No shipping options available in any region for fallback test.");
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
