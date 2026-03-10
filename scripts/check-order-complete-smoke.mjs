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
const storefrontUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";

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

async function getFirstRegion() {
  const { response, json } = await storeFetch("/store/regions?limit=1");

  if (!response.ok) {
    throw new Error(`Regions request failed: ${response.status}`);
  }

  const region = json?.regions?.[0];
  const regionId = region?.id;
  const countryCode = region?.countries?.[0]?.iso_2;

  if (!regionId) {
    throw new Error("No region found");
  }

  return {
    id: regionId,
    countryCode: countryCode || "ua",
  };
}

async function getFirstVariantId() {
  const { response, json } = await storeFetch(
    "/store/products?limit=1&fields=title,variants.id,variants.manage_inventory,variants.inventory_quantity"
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
    throw new Error("No product variant available");
  }

  return variant.id;
}

async function main() {
  console.log(`Order complete smoke (${new Date().toISOString()})`);

  const [region, variantId] = await Promise.all([getFirstRegion(), getFirstVariantId()]);

  const createdCart = await storeFetch("/store/carts", {
    method: "POST",
    body: JSON.stringify({ region_id: region.id }),
  });

  const cartId = createdCart.json?.cart?.id;
  if (!createdCart.response.ok || !cartId) {
    throw new Error(`Failed to create cart: status=${createdCart.response.status}`);
  }

  const added = await storeFetch(`/store/carts/${cartId}/line-items`, {
    method: "POST",
    body: JSON.stringify({ variant_id: variantId, quantity: 1 }),
  });

  if (!added.response.ok) {
    throw new Error(`Failed to add line item: status=${added.response.status}`);
  }

  const checkoutData = await storeFetch(`/store/carts/${cartId}`, {
    method: "POST",
    body: JSON.stringify({
      email: "smoke.order.complete@example.com",
      shipping_address: {
        first_name: "Smoke",
        phone: "+380999000000",
        city: "Kyiv",
        address_1: "Test street, 1",
        country_code: region.countryCode,
      },
      billing_address: {
        first_name: "Smoke",
        phone: "+380999000000",
        city: "Kyiv",
        address_1: "Test street, 1",
        country_code: region.countryCode,
      },
    }),
  });

  if (!checkoutData.response.ok) {
    throw new Error(`Failed to attach checkout data: status=${checkoutData.response.status}`);
  }

  const shippingOptions = await storeFetch(`/store/shipping-options?cart_id=${cartId}`);
  const shippingOptionId = shippingOptions.json?.shipping_options?.[0]?.id;

  if (!shippingOptions.response.ok || !shippingOptionId) {
    throw new Error(`Failed to get shipping options: status=${shippingOptions.response.status}`);
  }

  const shippingMethod = await storeFetch(`/store/carts/${cartId}/shipping-methods`, {
    method: "POST",
    body: JSON.stringify({ option_id: shippingOptionId }),
  });

  if (!shippingMethod.response.ok) {
    throw new Error(`Failed to apply shipping method: status=${shippingMethod.response.status}`);
  }

  const paymentCollection = await storeFetch("/store/payment-collections", {
    method: "POST",
    body: JSON.stringify({ cart_id: cartId }),
  });

  const paymentCollectionId = paymentCollection.json?.payment_collection?.id;
  if (!paymentCollection.response.ok || !paymentCollectionId) {
    throw new Error(`Failed to create payment collection: status=${paymentCollection.response.status}`);
  }

  const paymentSession = await storeFetch(`/store/payment-collections/${paymentCollectionId}/payment-sessions`, {
    method: "POST",
    body: JSON.stringify({ provider_id: "pp_system_default" }),
  });

  if (!paymentSession.response.ok) {
    throw new Error(`Failed to create payment session: status=${paymentSession.response.status}`);
  }

  const completed = await storeFetch(`/store/carts/${cartId}/complete`, {
    method: "POST",
    body: JSON.stringify({}),
  });

  const orderId = completed.json?.order?.id;
  const displayId = completed.json?.order?.display_id;
  const completedOk = completed.response.ok && completed.json?.type === "order" && Boolean(orderId);
  console.log(
    `order_complete: status=${completed.response.status}, type=${completed.json?.type ?? "unknown"}, order=${
      completedOk ? "OK" : "MISS"
    }`
  );

  if (!completedOk) {
    throw new Error("Order completion did not return order payload");
  }

  const successQuery = displayId
    ? `displayId=${encodeURIComponent(String(displayId))}&orderId=${encodeURIComponent(orderId)}`
    : `orderId=${encodeURIComponent(orderId)}`;

  const successPage = await fetch(`${storefrontUrl}/checkout/success?${successQuery}`, { cache: "no-store" });
  const successPageOk = successPage.ok;
  console.log(`success_page: status=${successPage.status}, ok=${successPageOk ? "OK" : "MISS"}`);

  if (!successPageOk) {
    throw new Error(`Checkout success page check failed: status=${successPage.status}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});