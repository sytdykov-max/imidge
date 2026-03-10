const backendUrl = process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ?? "http://127.0.0.1:9000";
const storefrontUrl = process.env.STOREFRONT_URL ?? "http://127.0.0.1:3002";
const publishableKey =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
  "pk_9e839c44d0b8854ecc2d6ef74322c320b78e3fd33eb2cdacc0ffe55e4fdf375d";

async function storeFetch(pathname) {
  const response = await fetch(`${backendUrl}${pathname}`, {
    headers: {
      "x-publishable-api-key": publishableKey,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Store fetch failed: ${response.status} ${pathname}`);
  }

  return response.json();
}

function isVariantInStock(variant) {
  return (
    variant.manage_inventory === false ||
    typeof variant.inventory_quantity !== "number" ||
    variant.inventory_quantity > 0
  );
}

function hasPositivePrice(variant) {
  return (variant.prices ?? []).some((price) => typeof price.amount === "number" && price.amount > 0);
}

function hasCompatibleCurrency(variant, regionCurrencies) {
  return (variant.prices ?? []).some(
    (price) =>
      typeof price.amount === "number" &&
      price.amount > 0 &&
      regionCurrencies.has((price.currency_code ?? "").toLowerCase())
  );
}

async function findMismatchedProductHandle() {
  const regionsData = await storeFetch("/store/regions?limit=100");
  const regionCurrencies = new Set(
    (regionsData.regions ?? [])
      .map((region) => (region.currency_code ?? "").toLowerCase())
      .filter(Boolean)
  );

  const pageLimit = 100;
  const maxPages = 30;

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageLimit;
    const data = await storeFetch(
      `/store/products?limit=${pageLimit}&offset=${offset}&fields=handle,variants.id,variants.manage_inventory,variants.inventory_quantity,variants.prices.amount,variants.prices.currency_code`
    );

    const products = data.products ?? [];
    if (products.length === 0) {
      break;
    }

    for (const product of products) {
      const variants = product.variants ?? [];
      const hasMismatch = variants.some(
        (variant) =>
          isVariantInStock(variant) &&
          hasPositivePrice(variant) &&
          !hasCompatibleCurrency(variant, regionCurrencies)
      );

      if (hasMismatch && product.handle) {
        return product.handle;
      }
    }
  }

  return null;
}

async function main() {
  console.log(`Region price guard check (${new Date().toISOString()})`);

  const handle = await findMismatchedProductHandle();
  if (!handle) {
    console.log("No region/currency mismatch products found; guard check skipped.");
    return;
  }

  const response = await fetch(`${storefrontUrl}/product/${encodeURIComponent(handle)}`, {
    cache: "no-store",
  });

  const html = await response.text();
  const hasGuardMessage = html.includes("цена не настроена для доступных регионов");
  const hasDisabledButton = /class="cta-btn"[^>]*disabled/.test(html);

  console.log(`product=${handle}`);
  console.log(`status=${response.status}, message=${hasGuardMessage ? "OK" : "MISS"}, disabled=${hasDisabledButton ? "OK" : "MISS"}`);

  if (response.status !== 200 || !hasGuardMessage || !hasDisabledButton) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
