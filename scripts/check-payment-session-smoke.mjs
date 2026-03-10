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
  console.log(`Payment session smoke (${new Date().toISOString()})`);

  const regions = await storeFetch("/store/regions?limit=1");
  const regionId = regions.json?.regions?.[0]?.id;
  if (!regions.response.ok || !regionId) {
    console.error(`Failed to get region: status=${regions.response.status}`);
    process.exitCode = 1;
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
    console.error(`Failed to resolve variant: status=${products.response.status}`);
    process.exitCode = 1;
    return;
  }

  const createdCart = await storeFetch("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: regionId }),
  });
  const cartId = createdCart.json?.cart?.id;
  if (!createdCart.response.ok || !cartId) {
    console.error(`Failed to create cart: status=${createdCart.response.status}`);
    process.exitCode = 1;
    return;
  }

  const added = await storeFetch(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: variant.id, quantity: 1 }),
  });
  if (!added.response.ok) {
    console.error(`Failed to add line item: status=${added.response.status}`);
    process.exitCode = 1;
    return;
  }

  const collection = await storeFetch("/store/payment-collections", {
    method: "POST",
    body: JSON.stringify({ cart_id: cartId }),
  });
  const paymentCollectionId = collection.json?.payment_collection?.id;
  const collectionOk = collection.response.ok && Boolean(paymentCollectionId);

  let sessionOk = false;
  if (paymentCollectionId) {
    const session = await storeFetch(`/store/payment-collections/${paymentCollectionId}/payment-sessions`, {
      method: "POST",
      body: JSON.stringify({ provider_id: "pp_system_default" }),
    });
    sessionOk = session.response.ok;
    console.log(`payment_session: status=${session.response.status}, ok=${sessionOk ? "OK" : "MISS"}`);
  }

  console.log(`payment_collection: status=${collection.response.status}, ok=${collectionOk ? "OK" : "MISS"}`);

  if (!collectionOk || !sessionOk) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
